from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'oll-vendor-management-secret-key-2024')
ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="OLL Vendor Management System")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ========================
# PYDANTIC MODELS
# ========================

# Auth Models
class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    role: str = "vendor"  # "oll" or "vendor"
    vendor_id: Optional[str] = None
    name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str]
    role: str
    vendor_id: Optional[str]
    name: Optional[str]

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Vendor Models
class VendorCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    address: str
    gst_number: Optional[str] = None
    contact_person: Optional[str] = None
    is_active: bool = True

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    contact_person: Optional[str] = None
    is_active: Optional[bool] = None

class VendorResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    address: str
    gst_number: Optional[str]
    contact_person: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str

# Product Models
class ProductCreate(BaseModel):
    name: str
    sku: str
    vendor_id: str
    unit_price: float
    tax_rate: float = 18.0  # GST percentage
    description: Optional[str] = None
    unit: str = "pcs"
    is_active: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    vendor_id: Optional[str] = None
    unit_price: Optional[float] = None
    tax_rate: Optional[float] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    sku: str
    vendor_id: str
    vendor_name: Optional[str] = None
    unit_price: float
    tax_rate: float
    description: Optional[str]
    unit: str
    is_active: bool
    created_at: str
    updated_at: str

# Purchase Order Models
class POLineItem(BaseModel):
    product_id: str
    product_name: str
    sku: str
    quantity: int
    unit_price: float
    tax_rate: float
    discount_amount: float = 0.0
    discount_percent: float = 0.0

class POCreate(BaseModel):
    vendor_id: str
    delivery_address: str
    contact_person: str
    contact_number: str
    line_items: List[POLineItem]
    order_discount_amount: float = 0.0
    order_discount_percent: float = 0.0
    notes: Optional[str] = None

class POUpdate(BaseModel):
    delivery_address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    line_items: Optional[List[POLineItem]] = None
    order_discount_amount: Optional[float] = None
    order_discount_percent: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class POResponse(BaseModel):
    id: str
    po_number: str
    vendor_id: str
    vendor_name: Optional[str] = None
    delivery_address: str
    contact_person: str
    contact_number: str
    line_items: List[POLineItem]
    subtotal: float
    total_discount: float
    total_tax: float
    grand_total: float
    order_discount_amount: float
    order_discount_percent: float
    status: str
    notes: Optional[str]
    tracking_token: str
    created_at: str
    updated_at: str
    created_by: str

# Dispatch Models
class DispatchCreate(BaseModel):
    po_id: str
    courier_partner: str
    tracking_id: str
    dispatch_date: str
    proof_url: Optional[str] = None
    notes: Optional[str] = None

class DispatchResponse(BaseModel):
    id: str
    po_id: str
    courier_partner: str
    tracking_id: str
    dispatch_date: str
    proof_url: Optional[str]
    notes: Optional[str]
    created_at: str
    created_by: str

# Delivery Confirmation Models
class DeliveryItem(BaseModel):
    product_id: str
    received_quantity: int
    is_damaged: bool = False
    is_missing: bool = False
    notes: Optional[str] = None

class DeliveryConfirmation(BaseModel):
    po_id: str
    items: List[DeliveryItem]
    notes: Optional[str] = None

# Invoice Models
class InvoiceCreate(BaseModel):
    po_id: str
    invoice_number: str
    invoice_date: str
    amount: float
    file_url: Optional[str] = None
    notes: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: str
    po_id: str
    invoice_number: str
    invoice_date: str
    amount: float
    file_url: Optional[str]
    notes: Optional[str]
    created_at: str
    created_by: str

# Payment Models
class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    payment_date: str
    payment_mode: str
    reference_id: str
    notes: Optional[str] = None

class PaymentResponse(BaseModel):
    id: str
    invoice_id: str
    po_id: str
    amount: float
    payment_date: str
    payment_mode: str
    reference_id: str
    payment_status: str
    notes: Optional[str]
    created_at: str
    created_by: str

# Return Models
class ReturnItemCreate(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    reason: str

class ReturnCreate(BaseModel):
    po_id: str
    vendor_id: str
    items: List[ReturnItemCreate]
    notes: Optional[str] = None

class ReturnResponse(BaseModel):
    id: str
    return_number: str
    po_id: str
    vendor_id: str
    vendor_name: Optional[str] = None
    items: List[Dict]
    status: str
    notes: Optional[str]
    created_at: str
    created_by: str

# Credit Note Models
class CreditNoteCreate(BaseModel):
    return_id: str
    items: List[Dict]  # product_id, quantity, price, total
    total_value: float
    notes: Optional[str] = None

class CreditNoteResponse(BaseModel):
    id: str
    credit_note_number: str
    return_id: str
    po_id: str
    vendor_id: str
    items: List[Dict]
    total_value: float
    status: str
    notes: Optional[str]
    created_at: str
    created_by: str

# Audit Log
class AuditLogResponse(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: str
    user_id: str
    username: str
    details: Dict
    timestamp: str

# ========================
# HELPER FUNCTIONS
# ========================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, username: str, role: str, vendor_id: Optional[str] = None) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "vendor_id": vendor_id,
        "exp": datetime.now(timezone.utc).timestamp() + 86400  # 24 hours
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def create_audit_log(action: str, entity_type: str, entity_id: str, user: dict, details: dict = None):
    log = {
        "id": str(uuid.uuid4()),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_id": user.get("user_id"),
        "username": user.get("username"),
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(log)

def generate_po_number():
    return f"PO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

def generate_return_number():
    return f"RET-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

def generate_credit_note_number():
    return f"CN-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

def calculate_po_totals(line_items: List[POLineItem], order_discount_amount: float = 0, order_discount_percent: float = 0):
    subtotal = 0
    total_item_discount = 0
    total_tax = 0
    
    for item in line_items:
        item_total = item.quantity * item.unit_price
        
        # Apply item-level discount
        if item.discount_percent > 0:
            item_discount = item_total * (item.discount_percent / 100)
        else:
            item_discount = item.discount_amount
        
        total_item_discount += item_discount
        item_after_discount = item_total - item_discount
        
        # Calculate tax on discounted price
        item_tax = item_after_discount * (item.tax_rate / 100)
        total_tax += item_tax
        subtotal += item_total
    
    # Apply order-level discount
    if order_discount_percent > 0:
        order_discount = (subtotal - total_item_discount) * (order_discount_percent / 100)
    else:
        order_discount = order_discount_amount
    
    total_discount = total_item_discount + order_discount
    
    # Recalculate tax after order discount
    taxable_amount = subtotal - total_discount
    total_tax = taxable_amount * 0.18  # Simplified: use average tax rate
    
    grand_total = subtotal - total_discount + total_tax
    
    return {
        "subtotal": round(subtotal, 2),
        "total_discount": round(total_discount, 2),
        "total_tax": round(total_tax, 2),
        "grand_total": round(grand_total, 2)
    }

# ========================
# AUTH ENDPOINTS
# ========================

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["username"], user["role"], user.get("vendor_id"))
    
    await create_audit_log("LOGIN", "user", user["id"], {"user_id": user["id"], "username": user["username"]})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            email=user.get("email"),
            role=user["role"],
            vendor_id=user.get("vendor_id"),
            name=user.get("name")
        )
    )

@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    # Only OLL admins can create new users
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL admins can create users")
    
    # Check if username exists
    existing = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "email": user_data.email,
        "role": user_data.role,
        "vendor_id": user_data.vendor_id,
        "name": user_data.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    await create_audit_log("CREATE_USER", "user", user["id"], current_user, {"username": user["username"]})
    
    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user.get("email"),
        role=user["role"],
        vendor_id=user.get("vendor_id"),
        name=user.get("name")
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

# ========================
# VENDOR ENDPOINTS
# ========================

@api_router.post("/vendors", response_model=VendorResponse)
async def create_vendor(vendor: VendorCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can create vendors")
    
    vendor_doc = {
        "id": str(uuid.uuid4()),
        **vendor.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vendors.insert_one(vendor_doc)
    await create_audit_log("CREATE_VENDOR", "vendor", vendor_doc["id"], current_user, {"name": vendor.name})
    
    return VendorResponse(**vendor_doc)

@api_router.get("/vendors", response_model=List[VendorResponse])
async def get_vendors(
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    # Vendors can only see their own vendor record
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["id"] = current_user["vendor_id"]
    
    vendors = await db.vendors.find(query, {"_id": 0}).to_list(1000)
    return [VendorResponse(**v) for v in vendors]

@api_router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(vendor_id: str, current_user: dict = Depends(get_current_user)):
    # Vendors can only see their own vendor record
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != vendor_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return VendorResponse(**vendor)

@api_router.put("/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(vendor_id: str, vendor: VendorUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can update vendors")
    
    update_data = {k: v for k, v in vendor.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.vendors.update_one({"id": vendor_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    await create_audit_log("UPDATE_VENDOR", "vendor", vendor_id, current_user, update_data)
    
    updated = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    return VendorResponse(**updated)

@api_router.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can delete vendors")
    
    result = await db.vendors.delete_one({"id": vendor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    await create_audit_log("DELETE_VENDOR", "vendor", vendor_id, current_user)
    return {"message": "Vendor deleted successfully"}

# ========================
# PRODUCT ENDPOINTS
# ========================

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can create products")
    
    # Check if vendor exists
    vendor = await db.vendors.find_one({"id": product.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    product_doc = {
        "id": str(uuid.uuid4()),
        **product.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.products.insert_one(product_doc)
    await create_audit_log("CREATE_PRODUCT", "product", product_doc["id"], current_user, {"name": product.name})
    
    product_doc["vendor_name"] = vendor.get("name")
    return ProductResponse(**product_doc)

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products(
    vendor_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if vendor_id:
        query["vendor_id"] = vendor_id
    if is_active is not None:
        query["is_active"] = is_active
    
    # Vendors can only see their own products
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    
    # Fetch vendor names
    vendor_ids = list(set(p["vendor_id"] for p in products))
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(1000)
    vendor_map = {v["id"]: v["name"] for v in vendors}
    
    result = []
    for p in products:
        p["vendor_name"] = vendor_map.get(p["vendor_id"])
        result.append(ProductResponse(**p))
    
    return result

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, current_user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Vendors can only see their own products
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != product["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    vendor = await db.vendors.find_one({"id": product["vendor_id"]}, {"_id": 0})
    product["vendor_name"] = vendor.get("name") if vendor else None
    
    return ProductResponse(**product)

@api_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product: ProductUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can update products")
    
    update_data = {k: v for k, v in product.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.products.update_one({"id": product_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await create_audit_log("UPDATE_PRODUCT", "product", product_id, current_user, update_data)
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    vendor = await db.vendors.find_one({"id": updated["vendor_id"]}, {"_id": 0})
    updated["vendor_name"] = vendor.get("name") if vendor else None
    
    return ProductResponse(**updated)

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can delete products")
    
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await create_audit_log("DELETE_PRODUCT", "product", product_id, current_user)
    return {"message": "Product deleted successfully"}

# ========================
# PURCHASE ORDER ENDPOINTS
# ========================

@api_router.post("/purchase-orders", response_model=POResponse)
async def create_purchase_order(po: POCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can create purchase orders")
    
    # Validate vendor
    vendor = await db.vendors.find_one({"id": po.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Calculate totals
    totals = calculate_po_totals(po.line_items, po.order_discount_amount, po.order_discount_percent)
    
    po_doc = {
        "id": str(uuid.uuid4()),
        "po_number": generate_po_number(),
        "vendor_id": po.vendor_id,
        "delivery_address": po.delivery_address,
        "contact_person": po.contact_person,
        "contact_number": po.contact_number,
        "line_items": [item.model_dump() for item in po.line_items],
        "order_discount_amount": po.order_discount_amount,
        "order_discount_percent": po.order_discount_percent,
        "notes": po.notes,
        "status": "draft",
        "tracking_token": str(uuid.uuid4()),
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **totals
    }
    
    await db.purchase_orders.insert_one(po_doc)
    await create_audit_log("CREATE_PO", "purchase_order", po_doc["id"], current_user, {"po_number": po_doc["po_number"]})
    
    po_doc["vendor_name"] = vendor.get("name")
    return POResponse(**po_doc)

@api_router.get("/purchase-orders", response_model=List[POResponse])
async def get_purchase_orders(
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    # Vendors can only see their own POs
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    pos = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Fetch vendor names
    vendor_ids = list(set(p["vendor_id"] for p in pos))
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(1000)
    vendor_map = {v["id"]: v["name"] for v in vendors}
    
    result = []
    for p in pos:
        p["vendor_name"] = vendor_map.get(p["vendor_id"])
        result.append(POResponse(**p))
    
    return result

@api_router.get("/purchase-orders/{po_id}", response_model=POResponse)
async def get_purchase_order(po_id: str, current_user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Vendors can only see their own POs
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != po["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    vendor = await db.vendors.find_one({"id": po["vendor_id"]}, {"_id": 0})
    po["vendor_name"] = vendor.get("name") if vendor else None
    
    return POResponse(**po)

@api_router.put("/purchase-orders/{po_id}", response_model=POResponse)
async def update_purchase_order(po_id: str, po_update: POUpdate, current_user: dict = Depends(get_current_user)):
    existing = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Vendors can only update status (confirm/reject)
    if current_user.get("role") == "vendor":
        if current_user.get("vendor_id") != existing["vendor_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        # Vendors can only change status
        if po_update.status not in ["confirmed", "rejected"]:
            raise HTTPException(status_code=403, detail="Vendors can only confirm or reject POs")
    
    update_data = {k: v for k, v in po_update.model_dump().items() if v is not None}
    
    # Recalculate totals if line items changed
    if "line_items" in update_data:
        line_items = [POLineItem(**item) for item in update_data["line_items"]]
        totals = calculate_po_totals(
            line_items,
            update_data.get("order_discount_amount", existing.get("order_discount_amount", 0)),
            update_data.get("order_discount_percent", existing.get("order_discount_percent", 0))
        )
        update_data.update(totals)
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.purchase_orders.update_one({"id": po_id}, {"$set": update_data})
    await create_audit_log("UPDATE_PO", "purchase_order", po_id, current_user, update_data)
    
    updated = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    vendor = await db.vendors.find_one({"id": updated["vendor_id"]}, {"_id": 0})
    updated["vendor_name"] = vendor.get("name") if vendor else None
    
    return POResponse(**updated)

@api_router.post("/purchase-orders/{po_id}/send")
async def send_po_to_vendor(po_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can send POs")
    
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft POs can be sent")
    
    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {"status": "sent", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_audit_log("SEND_PO", "purchase_order", po_id, current_user)
    
    return {"message": "PO sent to vendor successfully"}

@api_router.post("/purchase-orders/{po_id}/confirm")
async def confirm_po(po_id: str, current_user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Vendors can only confirm their own POs
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != po["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if po["status"] != "sent":
        raise HTTPException(status_code=400, detail="Only sent POs can be confirmed")
    
    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {"status": "confirmed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_audit_log("CONFIRM_PO", "purchase_order", po_id, current_user)
    
    return {"message": "PO confirmed successfully"}

@api_router.post("/purchase-orders/{po_id}/reject")
async def reject_po(po_id: str, reason: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Vendors can only reject their own POs
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != po["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if po["status"] != "sent":
        raise HTTPException(status_code=400, detail="Only sent POs can be rejected")
    
    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await create_audit_log("REJECT_PO", "purchase_order", po_id, current_user, {"reason": reason})
    
    return {"message": "PO rejected"}

# ========================
# DISPATCH ENDPOINTS
# ========================

@api_router.post("/dispatch", response_model=DispatchResponse)
async def create_dispatch(dispatch: DispatchCreate, current_user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one({"id": dispatch.po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Vendors can only dispatch their own POs
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != po["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if po["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed POs can be dispatched")
    
    dispatch_doc = {
        "id": str(uuid.uuid4()),
        **dispatch.model_dump(),
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.dispatches.insert_one(dispatch_doc)
    
    # Update PO status
    await db.purchase_orders.update_one(
        {"id": dispatch.po_id},
        {"$set": {"status": "dispatched", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_audit_log("CREATE_DISPATCH", "dispatch", dispatch_doc["id"], current_user, {"po_id": dispatch.po_id})
    
    return DispatchResponse(**dispatch_doc)

@api_router.get("/dispatch/{po_id}", response_model=DispatchResponse)
async def get_dispatch(po_id: str, current_user: dict = Depends(get_current_user)):
    dispatch = await db.dispatches.find_one({"po_id": po_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    return DispatchResponse(**dispatch)

# ========================
# PUBLIC TRACKING ENDPOINT
# ========================

@api_router.get("/track/{tracking_token}")
async def track_order(tracking_token: str):
    po = await db.purchase_orders.find_one({"tracking_token": tracking_token}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Order not found")
    
    vendor = await db.vendors.find_one({"id": po["vendor_id"]}, {"_id": 0})
    dispatch = await db.dispatches.find_one({"po_id": po["id"]}, {"_id": 0})
    
    # Build status timeline
    timeline = [
        {"status": "draft", "label": "Order Created", "date": po["created_at"], "completed": True}
    ]
    
    status_order = ["draft", "sent", "confirmed", "dispatched", "delivered", "closed"]
    current_idx = status_order.index(po["status"]) if po["status"] in status_order else 0
    
    for idx, status in enumerate(status_order[1:], 1):
        timeline.append({
            "status": status,
            "label": status.replace("_", " ").title(),
            "date": po["updated_at"] if idx <= current_idx else None,
            "completed": idx <= current_idx
        })
    
    return {
        "po_number": po["po_number"],
        "status": po["status"],
        "vendor_name": vendor.get("name") if vendor else None,
        "delivery_address": po["delivery_address"],
        "contact_person": po["contact_person"],
        "line_items": po["line_items"],
        "grand_total": po["grand_total"],
        "dispatch": dispatch,
        "timeline": timeline
    }

# ========================
# DELIVERY CONFIRMATION
# ========================

@api_router.post("/purchase-orders/{po_id}/deliver")
async def confirm_delivery(po_id: str, confirmation: DeliveryConfirmation, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can confirm delivery")
    
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po["status"] != "dispatched":
        raise HTTPException(status_code=400, detail="Only dispatched POs can be marked as delivered")
    
    # Store delivery confirmation
    delivery_doc = {
        "id": str(uuid.uuid4()),
        "po_id": po_id,
        "items": [item.model_dump() for item in confirmation.items],
        "notes": confirmation.notes,
        "confirmed_by": current_user["user_id"],
        "confirmed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.delivery_confirmations.insert_one(delivery_doc)
    
    # Check for issues
    has_issues = any(item.is_damaged or item.is_missing for item in confirmation.items)
    
    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {
            "status": "delivered",
            "has_delivery_issues": has_issues,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await create_audit_log("CONFIRM_DELIVERY", "purchase_order", po_id, current_user, {"has_issues": has_issues})
    
    return {"message": "Delivery confirmed", "has_issues": has_issues}

@api_router.post("/purchase-orders/{po_id}/close")
async def close_po(po_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can close POs")
    
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Only delivered POs can be closed")
    
    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {"status": "closed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_audit_log("CLOSE_PO", "purchase_order", po_id, current_user)
    
    return {"message": "PO closed successfully"}

# ========================
# INVOICE ENDPOINTS
# ========================

@api_router.post("/invoices", response_model=InvoiceResponse)
async def create_invoice(invoice: InvoiceCreate, current_user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one({"id": invoice.po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Vendors can only create invoices for their own POs
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != po["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    invoice_doc = {
        "id": str(uuid.uuid4()),
        **invoice.model_dump(),
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.invoices.insert_one(invoice_doc)
    await create_audit_log("CREATE_INVOICE", "invoice", invoice_doc["id"], current_user, {"po_id": invoice.po_id})
    
    return InvoiceResponse(**invoice_doc)

@api_router.get("/invoices", response_model=List[InvoiceResponse])
async def get_invoices(
    po_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if po_id:
        query["po_id"] = po_id
    
    # Vendors can only see invoices for their POs
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        vendor_pos = await db.purchase_orders.find(
            {"vendor_id": current_user["vendor_id"]},
            {"id": 1, "_id": 0}
        ).to_list(1000)
        po_ids = [p["id"] for p in vendor_pos]
        query["po_id"] = {"$in": po_ids}
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [InvoiceResponse(**inv) for inv in invoices]

@api_router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return InvoiceResponse(**invoice)

# ========================
# PAYMENT ENDPOINTS
# ========================

@api_router.post("/payments", response_model=PaymentResponse)
async def create_payment(payment: PaymentCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can record payments")
    
    invoice = await db.invoices.find_one({"id": payment.invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get existing payments for this invoice
    existing_payments = await db.payments.find({"invoice_id": payment.invoice_id}, {"_id": 0}).to_list(1000)
    total_paid = sum(p["amount"] for p in existing_payments) + payment.amount
    
    # Determine payment status
    if total_paid >= invoice["amount"]:
        payment_status = "fully_paid"
    else:
        payment_status = "partially_paid"
    
    payment_doc = {
        "id": str(uuid.uuid4()),
        "invoice_id": payment.invoice_id,
        "po_id": invoice["po_id"],
        "amount": payment.amount,
        "payment_date": payment.payment_date,
        "payment_mode": payment.payment_mode,
        "reference_id": payment.reference_id,
        "payment_status": payment_status,
        "notes": payment.notes,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payments.insert_one(payment_doc)
    await create_audit_log("CREATE_PAYMENT", "payment", payment_doc["id"], current_user, {"invoice_id": payment.invoice_id})
    
    return PaymentResponse(**payment_doc)

@api_router.get("/payments", response_model=List[PaymentResponse])
async def get_payments(
    invoice_id: Optional[str] = None,
    po_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if invoice_id:
        query["invoice_id"] = invoice_id
    if po_id:
        query["po_id"] = po_id
    
    # Vendors can only see payments for their POs
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        vendor_pos = await db.purchase_orders.find(
            {"vendor_id": current_user["vendor_id"]},
            {"id": 1, "_id": 0}
        ).to_list(1000)
        po_ids = [p["id"] for p in vendor_pos]
        query["po_id"] = {"$in": po_ids}
    
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [PaymentResponse(**p) for p in payments]

# ========================
# RETURNS ENDPOINTS
# ========================

@api_router.post("/returns", response_model=ReturnResponse)
async def create_return(return_req: ReturnCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can create returns")
    
    po = await db.purchase_orders.find_one({"id": return_req.po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    vendor = await db.vendors.find_one({"id": return_req.vendor_id}, {"_id": 0})
    
    return_doc = {
        "id": str(uuid.uuid4()),
        "return_number": generate_return_number(),
        "po_id": return_req.po_id,
        "vendor_id": return_req.vendor_id,
        "items": [item.model_dump() for item in return_req.items],
        "status": "pending",
        "notes": return_req.notes,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.returns.insert_one(return_doc)
    await create_audit_log("CREATE_RETURN", "return", return_doc["id"], current_user, {"po_id": return_req.po_id})
    
    return_doc["vendor_name"] = vendor.get("name") if vendor else None
    return ReturnResponse(**return_doc)

@api_router.get("/returns", response_model=List[ReturnResponse])
async def get_returns(
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if vendor_id:
        query["vendor_id"] = vendor_id
    if status:
        query["status"] = status
    
    # Vendors can only see their own returns
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    returns = await db.returns.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Fetch vendor names
    vendor_ids = list(set(r["vendor_id"] for r in returns))
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(1000)
    vendor_map = {v["id"]: v["name"] for v in vendors}
    
    result = []
    for r in returns:
        r["vendor_name"] = vendor_map.get(r["vendor_id"])
        result.append(ReturnResponse(**r))
    
    return result

@api_router.get("/returns/{return_id}", response_model=ReturnResponse)
async def get_return(return_id: str, current_user: dict = Depends(get_current_user)):
    ret = await db.returns.find_one({"id": return_id}, {"_id": 0})
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    
    vendor = await db.vendors.find_one({"id": ret["vendor_id"]}, {"_id": 0})
    ret["vendor_name"] = vendor.get("name") if vendor else None
    
    return ReturnResponse(**ret)

# ========================
# CREDIT NOTE ENDPOINTS
# ========================

@api_router.post("/credit-notes", response_model=CreditNoteResponse)
async def create_credit_note(credit_note: CreditNoteCreate, current_user: dict = Depends(get_current_user)):
    # Vendors can create credit notes for their returns
    ret = await db.returns.find_one({"id": credit_note.return_id}, {"_id": 0})
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != ret["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    cn_doc = {
        "id": str(uuid.uuid4()),
        "credit_note_number": generate_credit_note_number(),
        "return_id": credit_note.return_id,
        "po_id": ret["po_id"],
        "vendor_id": ret["vendor_id"],
        "items": credit_note.items,
        "total_value": credit_note.total_value,
        "status": "issued",
        "notes": credit_note.notes,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.credit_notes.insert_one(cn_doc)
    
    # Update return status
    await db.returns.update_one({"id": credit_note.return_id}, {"$set": {"status": "credit_issued"}})
    
    await create_audit_log("CREATE_CREDIT_NOTE", "credit_note", cn_doc["id"], current_user, {"return_id": credit_note.return_id})
    
    return CreditNoteResponse(**cn_doc)

@api_router.get("/credit-notes", response_model=List[CreditNoteResponse])
async def get_credit_notes(
    vendor_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    # Vendors can only see their own credit notes
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    credit_notes = await db.credit_notes.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [CreditNoteResponse(**cn) for cn in credit_notes]

# ========================
# AUDIT LOG ENDPOINTS
# ========================

@api_router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can view audit logs")
    
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return [AuditLogResponse(**log) for log in logs]

# ========================
# DASHBOARD / ANALYTICS
# ========================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") == "oll":
        # OLL dashboard stats
        total_vendors = await db.vendors.count_documents({})
        active_vendors = await db.vendors.count_documents({"is_active": True})
        total_products = await db.products.count_documents({})
        total_pos = await db.purchase_orders.count_documents({})
        
        # PO status breakdown
        po_by_status = {}
        for status in ["draft", "sent", "confirmed", "dispatched", "delivered", "closed", "rejected"]:
            po_by_status[status] = await db.purchase_orders.count_documents({"status": status})
        
        # Recent POs
        recent_pos = await db.purchase_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
        
        # Pending returns
        pending_returns = await db.returns.count_documents({"status": "pending"})
        
        return {
            "total_vendors": total_vendors,
            "active_vendors": active_vendors,
            "total_products": total_products,
            "total_pos": total_pos,
            "po_by_status": po_by_status,
            "recent_pos": recent_pos,
            "pending_returns": pending_returns
        }
    else:
        # Vendor dashboard stats
        vendor_id = current_user.get("vendor_id")
        total_pos = await db.purchase_orders.count_documents({"vendor_id": vendor_id})
        
        po_by_status = {}
        for status in ["sent", "confirmed", "dispatched", "delivered", "closed"]:
            po_by_status[status] = await db.purchase_orders.count_documents({"vendor_id": vendor_id, "status": status})
        
        # Pending actions
        pending_pos = await db.purchase_orders.count_documents({"vendor_id": vendor_id, "status": "sent"})
        pending_returns = await db.returns.count_documents({"vendor_id": vendor_id, "status": "pending"})
        
        # Recent POs
        recent_pos = await db.purchase_orders.find(
            {"vendor_id": vendor_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(5)
        
        return {
            "total_pos": total_pos,
            "po_by_status": po_by_status,
            "pending_pos": pending_pos,
            "pending_returns": pending_returns,
            "recent_pos": recent_pos
        }

# ========================
# USERS MANAGEMENT
# ========================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can view users")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

# ========================
# SEED DATA
# ========================

@api_router.post("/seed")
async def seed_data():
    """Seed initial data - only run once"""
    
    # Check if already seeded
    existing_users = await db.users.count_documents({})
    if existing_users > 0:
        return {"message": "Data already seeded"}
    
    # Create OLL Admin user
    oll_admin = {
        "id": str(uuid.uuid4()),
        "username": "olladmin",
        "password": hash_password("olladmin"),
        "email": "admin@oll.com",
        "role": "oll",
        "vendor_id": None,
        "name": "OLL Administrator",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(oll_admin)
    
    # Create a sample vendor
    vendor = {
        "id": str(uuid.uuid4()),
        "name": "Sample Vendor Co.",
        "email": "vendor@sample.com",
        "phone": "+91 9876543210",
        "address": "123 Vendor Street, Mumbai, Maharashtra 400001",
        "gst_number": "27AABCU9603R1ZM",
        "contact_person": "Vendor Contact",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.vendors.insert_one(vendor)
    
    # Create Vendor user
    vendor_user = {
        "id": str(uuid.uuid4()),
        "username": "vendor",
        "password": hash_password("vendor"),
        "email": "vendor@sample.com",
        "role": "vendor",
        "vendor_id": vendor["id"],
        "name": "Vendor User",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(vendor_user)
    
    # Create sample products
    products = [
        {
            "id": str(uuid.uuid4()),
            "name": "Industrial Pump A100",
            "sku": "PUMP-A100",
            "vendor_id": vendor["id"],
            "unit_price": 15000.00,
            "tax_rate": 18.0,
            "description": "High-performance industrial pump",
            "unit": "pcs",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Control Valve V200",
            "sku": "VALVE-V200",
            "vendor_id": vendor["id"],
            "unit_price": 8500.00,
            "tax_rate": 18.0,
            "description": "Precision control valve",
            "unit": "pcs",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Pressure Sensor PS50",
            "sku": "SENSOR-PS50",
            "vendor_id": vendor["id"],
            "unit_price": 3200.00,
            "tax_rate": 18.0,
            "description": "Digital pressure sensor",
            "unit": "pcs",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for product in products:
        await db.products.insert_one(product)
    
    return {"message": "Data seeded successfully", "oll_user": "olladmin/olladmin", "vendor_user": "vendor/vendor"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
