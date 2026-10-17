"""
Multi-Cluster MongoDB Storage Manager
Transparently routes writes to Secondary Cluster (MONGO_URL_2) when Primary Cluster storage reaches > 490 MB.
Automatically creates collections on Secondary Cluster if not present.
Allows transparent reads, lookups, updates, and indexing across both clusters.
"""

import os
import time
import asyncio
import logging
from typing import Optional, List, Dict, Any, Union, Set
from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorDatabase,
    AsyncIOMotorCollection,
)

logger = logging.getLogger("multidb")

# Configure DNS resolver to avoid Windows SRV lookup timeouts on inactive adapter addresses
try:
    import dns.resolver
    resolver = dns.resolver.get_default_resolver()
    resolver.timeout = 4.0
    resolver.lifetime = 12.0
    current_ns = [ns for ns in resolver.nameservers if ns not in ("0.0.0.0", "127.0.0.1")]
    resolver.nameservers = ["1.1.1.1", "8.8.8.8"] + [ns for ns in current_ns if ns not in ("1.1.1.1", "8.8.8.8")]
except Exception:
    pass

def _create_motor_client(uri: str) -> AsyncIOMotorClient:
    """Create AsyncIOMotorClient with retry logic for SRV DNS resolution."""
    last_err = None
    for attempt in range(3):
        try:
            return AsyncIOMotorClient(uri)
        except Exception as e:
            last_err = e
            time.sleep(1.0)
    raise last_err

STORAGE_THRESHOLD_MB = 490.0  # Threshold in megabytes

class MultiClusterCursor:
    """Cursor that queries and merges documents across both MongoDB clusters."""
    def __init__(self, col_name: str, manager: 'MultiClusterManager', filter_dict: dict, *args, **kwargs):
        self.col_name = col_name
        self.manager = manager
        self.filter_dict = filter_dict or {}
        self.args = args
        self.kwargs = kwargs
        self._sort = None
        self._skip = 0
        self._limit = 0

    def sort(self, key_or_list, direction=None):
        if direction is not None:
            self._sort = [(key_or_list, direction)]
        elif isinstance(key_or_list, list):
            self._sort = key_or_list
        else:
            self._sort = [key_or_list]
        return self

    def skip(self, skip: int):
        self._skip = skip
        return self

    def limit(self, limit: int):
        self._limit = limit
        return self

    async def to_list(self, length: Optional[int] = 1000) -> List[dict]:
        limit_val = length if length is not None else 1000
        if self._limit and self._limit < limit_val:
            limit_val = self._limit

        cols = self.manager.get_read_collections(self.col_name)
        if len(cols) == 1:
            c = cols[0].find(self.filter_dict, *self.args, **self.kwargs)
            if self._sort:
                c = c.sort(self._sort)
            if self._skip:
                c = c.skip(self._skip)
            if self._limit:
                c = c.limit(self._limit)
            return await c.to_list(length)

        # Multi-cluster fetch
        fetch_tasks = []
        for col in cols:
            c = col.find(self.filter_dict, *self.args, **self.kwargs)
            if self._sort:
                c = c.sort(self._sort)
            fetch_tasks.append(c.to_list(limit_val + self._skip))

        results = await asyncio.gather(*fetch_tasks, return_exceptions=True)
        merged: List[dict] = []
        seen_ids: Set[Any] = set()

        for res in results:
            if isinstance(res, list):
                for doc in res:
                    doc_id = doc.get("id") or str(doc.get("_id"))
                    if doc_id not in seen_ids:
                        seen_ids.add(doc_id)
                        merged.append(doc)

        # Apply sorting in Python if sort was specified
        if self._sort and merged:
            for sort_field, direction in reversed(self._sort):
                reverse = direction in (-1, "desc", "DESC")
                merged.sort(
                    key=lambda d: (
                        d.get(sort_field) is None,
                        d.get(sort_field)
                    ),
                    reverse=reverse
                )

        # Apply skip & limit
        if self._skip:
            merged = merged[self._skip:]
        if self._limit and len(merged) > self._limit:
            merged = merged[:self._limit]
        elif length and len(merged) > length:
            merged = merged[:length]

        return merged

    def __aiter__(self):
        return self._generator()

    async def _generator(self):
        docs = await self.to_list(length=10000)
        for doc in docs:
            yield doc


class MultiClusterAggregationCursor:
    """Cursor that queries and aggregates documents across both MongoDB clusters."""
    def __init__(self, col_name: str, manager: 'MultiClusterManager', pipeline: list, *args, **kwargs):
        self.col_name = col_name
        self.manager = manager
        self.pipeline = pipeline
        self.args = args
        self.kwargs = kwargs

    async def to_list(self, length: Optional[int] = 1000) -> List[dict]:
        cols = self.manager.get_read_collections(self.col_name)
        if len(cols) == 1:
            return await cols[0].aggregate(self.pipeline, *self.args, **self.kwargs).to_list(length)

        fetch_tasks = []
        for col in cols:
            fetch_tasks.append(col.aggregate(self.pipeline, *self.args, **self.kwargs).to_list(length))

        results = await asyncio.gather(*fetch_tasks, return_exceptions=True)
        prim_docs = results[0] if len(results) > 0 and isinstance(results[0], list) else []
        sec_docs = results[1] if len(results) > 1 and isinstance(results[1], list) else []

        if not sec_docs:
            return prim_docs[:length] if length else prim_docs
        if not prim_docs:
            return sec_docs[:length] if length else sec_docs

        has_group = any("$group" in stage for stage in self.pipeline if isinstance(stage, dict))
        if has_group:
            merged_map = {}
            for doc in prim_docs:
                key = str(doc.get("_id")) if doc.get("_id") is not None else "__none__"
                merged_map[key] = dict(doc)

            for doc in sec_docs:
                key = str(doc.get("_id")) if doc.get("_id") is not None else "__none__"
                if key in merged_map:
                    existing = merged_map[key]
                    for k, v in doc.items():
                        if k == "_id":
                            continue
                        if isinstance(v, (int, float)) and isinstance(existing.get(k), (int, float)):
                            existing[k] = existing[k] + v
                else:
                    merged_map[key] = dict(doc)

            merged = list(merged_map.values())
            return merged[:length] if length else merged
        else:
            merged = []
            seen_ids = set()
            for doc in prim_docs + sec_docs:
                doc_id = doc.get("id") or str(doc.get("_id"))
                if doc_id not in seen_ids:
                    seen_ids.add(doc_id)
                    merged.append(doc)
            return merged[:length] if length else merged

    def __aiter__(self):
        return self._generator()

    async def _generator(self):
        docs = await self.to_list(length=10000)
        for doc in docs:
            yield doc


class MultiClusterCollection:
    """Collection wrapper that routes writes based on storage quota and reads across clusters."""
    def __init__(self, name: str, manager: 'MultiClusterManager'):
        self.name = name
        self.manager = manager

    @property
    def primary_col(self) -> AsyncIOMotorCollection:
        return self.manager.primary_db[self.name]

    @property
    def secondary_col(self) -> Optional[AsyncIOMotorCollection]:
        if self.manager.secondary_db is not None:
            return self.manager.secondary_db[self.name]
        return None

    async def _get_write_col(self) -> AsyncIOMotorCollection:
        target_db, is_secondary = await self.manager.get_write_db_with_flag()
        if is_secondary:
            await self.manager.ensure_collection_exists(self.name)
        return target_db[self.name]

    async def insert_one(self, document: dict, *args, **kwargs):
        col = await self._get_write_col()
        return await col.insert_one(document, *args, **kwargs)

    async def insert_many(self, documents: list, *args, **kwargs):
        col = await self._get_write_col()
        return await col.insert_many(documents, *args, **kwargs)

    async def find_one(self, filter: Optional[dict] = None, *args, **kwargs):
        filter = filter or {}
        # Check write cluster first, then fallback cluster
        cols = self.manager.get_read_collections_ordered(self.name)
        for col in cols:
            doc = await col.find_one(filter, *args, **kwargs)
            if doc is not None:
                return doc
        return None

    def find(self, filter: Optional[dict] = None, *args, **kwargs) -> MultiClusterCursor:
        return MultiClusterCursor(self.name, self.manager, filter, *args, **kwargs)

    async def update_one(self, filter: dict, update: dict, *args, upsert: bool = False, **kwargs):
        # Check if doc exists in secondary first
        if self.secondary_col is not None:
            doc_sec = await self.secondary_col.find_one(filter, {"_id": 1})
            if doc_sec:
                return await self.secondary_col.update_one(filter, update, *args, upsert=False, **kwargs)

        # Check primary
        doc_prim = await self.primary_col.find_one(filter, {"_id": 1})
        if doc_prim:
            return await self.primary_col.update_one(filter, update, *args, upsert=False, **kwargs)

        # If not matched anywhere and upsert is True, route to active write collection
        if upsert:
            col = await self._get_write_col()
            return await col.update_one(filter, update, *args, upsert=True, **kwargs)

        # Fallback normal update on primary
        return await self.primary_col.update_one(filter, update, *args, upsert=False, **kwargs)

    async def update_many(self, filter: dict, update: dict, *args, **kwargs):
        res1 = await self.primary_col.update_many(filter, update, *args, **kwargs)
        if self.secondary_col is not None:
            res2 = await self.secondary_col.update_many(filter, update, *args, **kwargs)
            res1.raw_result["nModified"] = res1.modified_count + res2.modified_count
            res1.raw_result["n"] = res1.matched_count + res2.matched_count
        return res1

    async def delete_one(self, filter: dict, *args, **kwargs):
        if self.secondary_col is not None:
            res_sec = await self.secondary_col.delete_one(filter, *args, **kwargs)
            if res_sec.deleted_count > 0:
                return res_sec
        return await self.primary_col.delete_one(filter, *args, **kwargs)

    async def delete_many(self, filter: dict, *args, **kwargs):
        res1 = await self.primary_col.delete_many(filter, *args, **kwargs)
        if self.secondary_col is not None:
            res2 = await self.secondary_col.delete_many(filter, *args, **kwargs)
            res1.raw_result["n"] = res1.deleted_count + res2.deleted_count
        return res1

    async def count_documents(self, filter: Optional[dict] = None, *args, **kwargs) -> int:
        filter = filter or {}
        c1 = await self.primary_col.count_documents(filter, *args, **kwargs)
        c2 = 0
        if self.secondary_col is not None:
            try:
                c2 = await self.secondary_col.count_documents(filter, *args, **kwargs)
            except Exception:
                pass
        return c1 + c2

    async def create_index(self, keys, *args, **kwargs):
        res = await self.primary_col.create_index(keys, *args, **kwargs)
        if self.secondary_col is not None:
            try:
                await self.manager.ensure_collection_exists(self.name)
                await self.secondary_col.create_index(keys, *args, **kwargs)
            except Exception as e:
                logger.warning(f"Could not create index on secondary for {self.name}: {e}")
        return res

    async def distinct(self, key: str, filter: Optional[dict] = None, *args, **kwargs) -> list:
        filter = filter or {}
        v1 = await self.primary_col.distinct(key, filter, *args, **kwargs)
        if self.secondary_col is not None:
            try:
                v2 = await self.secondary_col.distinct(key, filter, *args, **kwargs)
                return list(set(v1 + v2))
            except Exception:
                pass
        return v1

    def aggregate(self, pipeline: list, *args, **kwargs) -> MultiClusterAggregationCursor:
        return MultiClusterAggregationCursor(self.name, self.manager, pipeline, *args, **kwargs)


class MultiClusterManager:
    """Coordinates Primary and Secondary MongoDB clusters with automatic failover at 490 MB."""
    def __init__(self, primary_url: str, secondary_url: Optional[str], db_name: str, threshold_mb: float = STORAGE_THRESHOLD_MB):
        self.primary_url = primary_url
        self.secondary_url = secondary_url
        self.db_name = db_name
        self.threshold_mb = threshold_mb

        self.primary_client = _create_motor_client(primary_url)
        self.primary_db = self.primary_client[db_name]

        self.secondary_client: Optional[AsyncIOMotorClient] = None
        self.secondary_db: Optional[AsyncIOMotorDatabase] = None
        if secondary_url:
            self.secondary_client = _create_motor_client(secondary_url)
            self.secondary_db = self.secondary_client[db_name]

        self._last_check_time: float = 0
        self._check_interval: float = 60.0  # Cache dbstats for 60 seconds
        self._primary_storage_mb: float = 0.0
        self._primary_data_mb: float = 0.0
        self._is_primary_full: bool = False
        self._secondary_known_collections: Set[str] = set()

    async def check_primary_storage(self, force: bool = False) -> Dict[str, Any]:
        """Query dbstats from Primary cluster to measure total storage consumed."""
        now = time.time()
        if not force and (now - self._last_check_time < self._check_interval):
            return {
                "storage_mb": self._primary_storage_mb,
                "data_mb": self._primary_data_mb,
                "is_full": self._is_primary_full,
                "threshold_mb": self.threshold_mb
            }

        try:
            stats = await self.primary_db.command("dbstats")
            # Calculate storage using storageSize or dataSize
            storage_bytes = stats.get("storageSize") or stats.get("dataSize") or 0
            data_bytes = stats.get("dataSize") or 0
            
            self._primary_storage_mb = round(storage_bytes / (1024 * 1024), 2)
            self._primary_data_mb = round(data_bytes / (1024 * 1024), 2)
            self._last_check_time = now

            effective_mb = max(self._primary_storage_mb, self._primary_data_mb)
            if effective_mb >= self.threshold_mb and self.secondary_db is not None:
                if not self._is_primary_full:
                    logger.warning(
                        f"[MultiDB] Primary MongoDB reached {effective_mb:.2f} MB (>= {self.threshold_mb} MB threshold). "
                        f"Active write target SWITCHED to Secondary Cluster (MONGO_URL_2)."
                    )
                self._is_primary_full = True
            else:
                self._is_primary_full = False

        except Exception as e:
            logger.error(f"[MultiDB] Failed to query primary dbstats: {e}")

        return {
            "storage_mb": self._primary_storage_mb,
            "data_mb": self._primary_data_mb,
            "is_full": self._is_primary_full,
            "threshold_mb": self.threshold_mb
        }

    async def get_write_db_with_flag(self) -> tuple[AsyncIOMotorDatabase, bool]:
        """Return (target_database, is_secondary_boolean)."""
        await self.check_primary_storage()
        if self._is_primary_full and self.secondary_db is not None:
            return self.secondary_db, True
        return self.primary_db, False

    async def ensure_collection_exists(self, collection_name: str):
        """Ensure collection exists in the Secondary database before inserting documents."""
        if self.secondary_db is None:
            return
        if collection_name in self._secondary_known_collections:
            return
        try:
            existing = await self.secondary_db.list_collection_names()
            if collection_name not in existing:
                await self.secondary_db.create_collection(collection_name)
                logger.info(f"[MultiDB] Auto-created collection '{collection_name}' on Secondary Cluster.")
            self._secondary_known_collections.add(collection_name)
        except Exception as e:
            # Collection may already exist or was created concurrently
            self._secondary_known_collections.add(collection_name)

    def get_read_collections(self, collection_name: str) -> List[AsyncIOMotorCollection]:
        cols = [self.primary_db[collection_name]]
        if self.secondary_db is not None:
            cols.append(self.secondary_db[collection_name])
        return cols

    def get_read_collections_ordered(self, collection_name: str) -> List[AsyncIOMotorCollection]:
        if self._is_primary_full and self.secondary_db is not None:
            return [self.secondary_db[collection_name], self.primary_db[collection_name]]
        cols = [self.primary_db[collection_name]]
        if self.secondary_db is not None:
            cols.append(self.secondary_db[collection_name])
        return cols

    async def get_status(self) -> Dict[str, Any]:
        """Full system diagnostic for both clusters."""
        prim_stat = await self.check_primary_storage(force=True)
        sec_stat = None
        if self.secondary_db is not None:
            try:
                s = await self.secondary_db.command("dbstats")
                sec_stat = {
                    "storage_mb": round((s.get("storageSize") or s.get("dataSize") or 0) / (1024 * 1024), 2),
                    "data_mb": round((s.get("dataSize") or 0) / (1024 * 1024), 2),
                    "collections": await self.secondary_db.list_collection_names()
                }
            except Exception as e:
                sec_stat = {"error": str(e)}

        return {
            "threshold_mb": self.threshold_mb,
            "active_write_target": "secondary (MONGO_URL_2)" if self._is_primary_full else "primary (MONGO_URL)",
            "primary": {
                "configured": True,
                "storage_mb": prim_stat["storage_mb"],
                "data_mb": prim_stat["data_mb"],
                "is_full": prim_stat["is_full"]
            },
            "secondary": {
                "configured": self.secondary_db is not None,
                "stats": sec_stat
            }
        }

    def close(self):
        """Close connections to both MongoDB clusters cleanly."""
        try:
            if self.primary_client:
                self.primary_client.close()
        except Exception as e:
            logger.warning(f"Error closing primary MongoDB client: {e}")

        try:
            if self.secondary_client:
                self.secondary_client.close()
        except Exception as e:
            logger.warning(f"Error closing secondary MongoDB client: {e}")


class MultiClusterDatabase:
    """Drop-in replacement for AsyncIOMotorDatabase supporting transparent dual-cluster switching."""
    def __init__(self, manager: MultiClusterManager):
        self._manager = manager
        self._collections: Dict[str, MultiClusterCollection] = {}

    def __getattr__(self, name: str) -> MultiClusterCollection:
        if name.startswith("_"):
            return super().__getattribute__(name)
        if name not in self._collections:
            self._collections[name] = MultiClusterCollection(name, self._manager)
        return self._collections[name]

    def __getitem__(self, name: str) -> MultiClusterCollection:
        if name not in self._collections:
            self._collections[name] = MultiClusterCollection(name, self._manager)
        return self._collections[name]

    async def list_collection_names(self, *args, **kwargs) -> List[str]:
        cols1 = await self._manager.primary_db.list_collection_names(*args, **kwargs)
        if self._manager.secondary_db is not None:
            try:
                cols2 = await self._manager.secondary_db.list_collection_names(*args, **kwargs)
                return sorted(list(set(cols1 + cols2)))
            except Exception:
                pass
        return sorted(cols1)

    async def command(self, *args, **kwargs):
        return await self._manager.primary_db.command(*args, **kwargs)

    async def create_collection(self, name: str, *args, **kwargs):
        target_db, is_sec = await self._manager.get_write_db_with_flag()
        return await target_db.create_collection(name, *args, **kwargs)

    @property
    def manager(self) -> MultiClusterManager:
        return self._manager
