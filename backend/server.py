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
from datetime import datetime, timezone, timedelta
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
    role: str = "vendor"
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

# Team Member Model
class TeamMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: str
    role: str  # accountant, director, coordinator, etc.

# Bank Details Model
class BankDetails(BaseModel):
    bank_name: str = ""
    branch: str = ""
    ifsc_code: str = ""
    account_number: str = ""
    account_holder_name: str = ""
    cancel_cheque_url: Optional[str] = None

# Vendor Models
class VendorCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    address: str
    gst_number: Optional[str] = None
    contact_person: Optional[str] = None
    is_active: bool = True
    bank_details: Optional[BankDetails] = None
    team_members: List[TeamMember] = []

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    contact_person: Optional[str] = None
    is_active: Optional[bool] = None
    bank_details: Optional[BankDetails] = None
    team_members: Optional[List[TeamMember]] = None

class VendorResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    address: str
    gst_number: Optional[str]
    contact_person: Optional[str]
    is_active: bool
    bank_details: Optional[Dict] = None
    team_members: List[Dict] = []
    created_at: str
    updated_at: str

# Product Models
class ProductCreate(BaseModel):
    name: str
    sku: str
    vendor_id: str
    unit_price: float
    tax_rate: float = 18.0
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
    comment: Optional[str] = None

class POCreate(BaseModel):
    vendor_id: str
    delivery_address: str
    receiver_name: Optional[str] = None
    contact_person: str
    contact_number: str
    delivery_date: str
    line_items: List[POLineItem]
    order_discount_amount: float = 0.0
    order_discount_percent: float = 0.0
    notes: Optional[str] = None
    final_comments: Optional[str] = None

class POUpdate(BaseModel):
    delivery_address: Optional[str] = None
    receiver_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    delivery_date: Optional[str] = None
    line_items: Optional[List[POLineItem]] = None
    order_discount_amount: Optional[float] = None
    order_discount_percent: Optional[float] = None
    notes: Optional[str] = None
    final_comments: Optional[str] = None
    status: Optional[str] = None

# PO Import Model
class POImport(BaseModel):
    vendor_id: str
    delivery_address: str
    receiver_name: Optional[str] = None
    contact_person: str
    contact_number: str
    delivery_date: str
    line_items: List[POLineItem]
    status: str = "delivered"
    notes: Optional[str] = None

class POResponse(BaseModel):
    id: str
    po_number: str
    vendor_id: str
    vendor_name: Optional[str] = None
    delivery_address: str
    receiver_name: Optional[str] = None
    contact_person: str
    contact_number: str
    delivery_date: str
    line_items: List[Dict]
    subtotal: float
    total_discount: float
    total_tax: float
    grand_total: float
    order_discount_amount: float
    order_discount_percent: float
    status: str
    notes: Optional[str]
    final_comments: Optional[str]
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
    expected_delivery_date: Optional[str] = None
    proof_url: Optional[str] = None
    notes: Optional[str] = None

class DispatchResponse(BaseModel):
    id: str
    po_id: str
    courier_partner: str
    tracking_id: str
    dispatch_date: str
    expected_delivery_date: Optional[str]
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

# Issue Models
class IssueCreate(BaseModel):
    po_id: str
    issue_type: str  # delivery_delay, missing_components, damaged_goods, quality_issue, other
    description: str
    affected_items: List[Dict] = []
    priority: str = "medium"  # low, medium, high, critical

class IssueUpdate(BaseModel):
    status: Optional[str] = None
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None

class IssueResponse(BaseModel):
    id: str
    issue_number: str
    po_id: str
    po_number: Optional[str] = None
    vendor_id: str
    vendor_name: Optional[str] = None
    issue_type: str
    description: str
    affected_items: List[Dict]
    priority: str
    status: str
    resolution: Optional[str]
    created_at: str
    updated_at: str
    created_by: str
    resolved_by: Optional[str]

# Invoice Models
class InvoiceCreate(BaseModel):
    po_id: str
    invoice_number: str
    invoice_date: str
    amount: float
    due_date: Optional[str] = None
    file_url: Optional[str] = None
    notes: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: str
    po_id: str
    po_number: Optional[str] = None
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    invoice_number: str
    invoice_date: str
    due_date: Optional[str]
    amount: float
    paid_amount: float = 0
    payment_status: str = "pending"
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

# Return Models with Credit Note
class ReturnItemCreate(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
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
    po_number: Optional[str] = None
    vendor_id: str
    vendor_name: Optional[str] = None
    items: List[Dict]
    total_value: float
    status: str
    credit_note_number: Optional[str]
    credit_note_date: Optional[str]
    notes: Optional[str]
    created_at: str
    updated_at: str
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
        "exp": datetime.now(timezone.utc).timestamp() + 86400
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

def generate_issue_number():
    return f"ISS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

def calculate_po_totals(line_items: List[POLineItem], order_discount_amount: float = 0, order_discount_percent: float = 0):
    subtotal = 0
    total_item_discount = 0
    total_tax = 0
    
    for item in line_items:
        item_total = item.quantity * item.unit_price
        if item.discount_percent > 0:
            item_discount = item_total * (item.discount_percent / 100)
        else:
            item_discount = item.discount_amount
        total_item_discount += item_discount
        item_after_discount = item_total - item_discount
        item_tax = item_after_discount * (item.tax_rate / 100)
        total_tax += item_tax
        subtotal += item_total
    
    if order_discount_percent > 0:
        order_discount = (subtotal - total_item_discount) * (order_discount_percent / 100)
    else:
        order_discount = order_discount_amount
    
    total_discount = total_item_discount + order_discount
    taxable_amount = subtotal - total_discount
    total_tax = taxable_amount * 0.18
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
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL admins can create users")
    
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
    
    return UserResponse(**{k: v for k, v in user.items() if k != "password"})

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
    
    vendor_dict = vendor.model_dump()
    if vendor_dict.get("bank_details"):
        vendor_dict["bank_details"] = vendor_dict["bank_details"]
    if vendor_dict.get("team_members"):
        vendor_dict["team_members"] = [tm if isinstance(tm, dict) else tm.model_dump() for tm in vendor_dict["team_members"]]
    
    vendor_doc = {
        "id": str(uuid.uuid4()),
        **vendor_dict,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vendors.insert_one(vendor_doc)
    await create_audit_log("CREATE_VENDOR", "vendor", vendor_doc["id"], current_user, {"name": vendor.name})
    
    return VendorResponse(**vendor_doc)

@api_router.get("/vendors", response_model=List[VendorResponse])
async def get_vendors(is_active: Optional[bool] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["id"] = current_user["vendor_id"]
    
    vendors = await db.vendors.find(query, {"_id": 0}).to_list(1000)
    return [VendorResponse(**v) for v in vendors]

@api_router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(vendor_id: str, current_user: dict = Depends(get_current_user)):
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
    if "bank_details" in update_data and update_data["bank_details"]:
        update_data["bank_details"] = update_data["bank_details"] if isinstance(update_data["bank_details"], dict) else update_data["bank_details"].model_dump()
    if "team_members" in update_data and update_data["team_members"]:
        update_data["team_members"] = [tm if isinstance(tm, dict) else tm.model_dump() for tm in update_data["team_members"]]
    
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
async def get_products(vendor_id: Optional[str] = None, is_active: Optional[bool] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if vendor_id:
        query["vendor_id"] = vendor_id
    if is_active is not None:
        query["is_active"] = is_active
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    
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
    
    vendor = await db.vendors.find_one({"id": po.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    totals = calculate_po_totals(po.line_items, po.order_discount_amount, po.order_discount_percent)
    
    po_doc = {
        "id": str(uuid.uuid4()),
        "po_number": generate_po_number(),
        "vendor_id": po.vendor_id,
        "delivery_address": po.delivery_address,
        "receiver_name": po.receiver_name,
        "contact_person": po.contact_person,
        "contact_number": po.contact_number,
        "delivery_date": po.delivery_date,
        "line_items": [item.model_dump() for item in po.line_items],
        "order_discount_amount": po.order_discount_amount,
        "order_discount_percent": po.order_discount_percent,
        "notes": po.notes,
        "final_comments": po.final_comments,
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
async def get_purchase_orders(status: Optional[str] = None, vendor_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    pos = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    vendor_ids = list(set(p["vendor_id"] for p in pos))
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(1000)
    vendor_map = {v["id"]: v["name"] for v in vendors}
    
    result = []
    for p in pos:
        p["vendor_name"] = vendor_map.get(p["vendor_id"])
        if "final_comments" not in p:
            p["final_comments"] = None
        if "delivery_date" not in p:
            p["delivery_date"] = ""
        if "receiver_name" not in p:
            p["receiver_name"] = None
        result.append(POResponse(**p))
    
    return result

@api_router.get("/purchase-orders/{po_id}", response_model=POResponse)
async def get_purchase_order(po_id: str, current_user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != po["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    vendor = await db.vendors.find_one({"id": po["vendor_id"]}, {"_id": 0})
    po["vendor_name"] = vendor.get("name") if vendor else None
    if "final_comments" not in po:
        po["final_comments"] = None
    if "delivery_date" not in po:
        po["delivery_date"] = ""
    if "receiver_name" not in po:
        po["receiver_name"] = None
    
    return POResponse(**po)

@api_router.put("/purchase-orders/{po_id}", response_model=POResponse)
async def update_purchase_order(po_id: str, po_update: POUpdate, current_user: dict = Depends(get_current_user)):
    existing = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if current_user.get("role") == "vendor":
        if current_user.get("vendor_id") != existing["vendor_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        if po_update.status not in ["confirmed", "rejected"]:
            raise HTTPException(status_code=403, detail="Vendors can only confirm or reject POs")
    
    update_data = {k: v for k, v in po_update.model_dump().items() if v is not None}
    
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
    if "final_comments" not in updated:
        updated["final_comments"] = None
    if "delivery_date" not in updated:
        updated["delivery_date"] = ""
    
    return POResponse(**updated)

@api_router.delete("/purchase-orders/{po_id}")
async def delete_purchase_order(po_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can delete POs")
    
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Only draft or rejected POs can be deleted")
    
    await db.purchase_orders.delete_one({"id": po_id})
    await create_audit_log("DELETE_PO", "purchase_order", po_id, current_user)
    
    return {"message": "Purchase order deleted successfully"}

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

@api_router.post("/purchase-orders/{po_id}/deliver")
async def confirm_delivery(po_id: str, confirmation: DeliveryConfirmation, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can confirm delivery")
    
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po["status"] != "dispatched":
        raise HTTPException(status_code=400, detail="Only dispatched POs can be marked as delivered")
    
    delivery_doc = {
        "id": str(uuid.uuid4()),
        "po_id": po_id,
        "items": [item.model_dump() for item in confirmation.items],
        "notes": confirmation.notes,
        "confirmed_by": current_user["user_id"],
        "confirmed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.delivery_confirmations.insert_one(delivery_doc)
    
    has_issues = any(item.is_damaged or item.is_missing for item in confirmation.items)
    
    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {
            "status": "delivered",
            "has_delivery_issues": has_issues,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Auto-create issue if there are problems
    if has_issues:
        affected_items = []
        for item in confirmation.items:
            if item.is_damaged or item.is_missing:
                affected_items.append({
                    "product_id": item.product_id,
                    "is_damaged": item.is_damaged,
                    "is_missing": item.is_missing,
                    "received_quantity": item.received_quantity,
                    "notes": item.notes
                })
        
        issue_doc = {
            "id": str(uuid.uuid4()),
            "issue_number": generate_issue_number(),
            "po_id": po_id,
            "vendor_id": po["vendor_id"],
            "issue_type": "delivery_issue",
            "description": "Issues found during delivery confirmation",
            "affected_items": affected_items,
            "priority": "high",
            "status": "open",
            "resolution": None,
            "created_by": current_user["user_id"],
            "resolved_by": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.issues.insert_one(issue_doc)
    
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

@api_router.post("/purchase-orders/import", response_model=POResponse)
async def import_purchase_order(po: POImport, current_user: dict = Depends(get_current_user)):
    """Import historical purchase order (for bulk import feature)"""
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can import purchase orders")
    
    vendor = await db.vendors.find_one({"id": po.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    totals = calculate_po_totals(po.line_items, 0, 0)
    
    po_doc = {
        "id": str(uuid.uuid4()),
        "po_number": generate_po_number(),
        "vendor_id": po.vendor_id,
        "delivery_address": po.delivery_address,
        "receiver_name": po.receiver_name,
        "contact_person": po.contact_person,
        "contact_number": po.contact_number,
        "delivery_date": po.delivery_date,
        "line_items": [item.model_dump() for item in po.line_items],
        "order_discount_amount": 0,
        "order_discount_percent": 0,
        "notes": po.notes or "Imported historical PO",
        "final_comments": None,
        "status": po.status,
        "tracking_token": str(uuid.uuid4()),
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **totals
    }
    
    await db.purchase_orders.insert_one(po_doc)
    await create_audit_log("IMPORT_PO", "purchase_order", po_doc["id"], current_user, {"po_number": po_doc["po_number"]})
    
    po_doc["vendor_name"] = vendor.get("name")
    return POResponse(**po_doc)

# ========================
# DELIVERIES ENDPOINTS
# ========================

@api_router.get("/deliveries/upcoming")
async def get_upcoming_deliveries(current_user: dict = Depends(get_current_user)):
    query = {"status": {"$in": ["confirmed", "dispatched"]}}
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    pos = await db.purchase_orders.find(query, {"_id": 0}).sort("delivery_date", 1).to_list(100)
    
    vendor_ids = list(set(p["vendor_id"] for p in pos))
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(1000)
    vendor_map = {v["id"]: v["name"] for v in vendors}
    
    # Get dispatch info
    po_ids = [p["id"] for p in pos]
    dispatches = await db.dispatches.find({"po_id": {"$in": po_ids}}, {"_id": 0}).to_list(1000)
    dispatch_map = {d["po_id"]: d for d in dispatches}
    
    result = []
    for p in pos:
        dispatch = dispatch_map.get(p["id"])
        result.append({
            "id": p["id"],
            "po_number": p["po_number"],
            "vendor_name": vendor_map.get(p["vendor_id"]),
            "delivery_date": p.get("delivery_date", ""),
            "delivery_address": p["delivery_address"],
            "contact_person": p["contact_person"],
            "status": p["status"],
            "grand_total": p["grand_total"],
            "dispatch": dispatch,
            "items_count": len(p.get("line_items", []))
        })
    
    return result

# ========================
# DISPATCH ENDPOINTS
# ========================

@api_router.post("/dispatch", response_model=DispatchResponse)
async def create_dispatch(dispatch: DispatchCreate, current_user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one({"id": dispatch.po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
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
# ISSUES ENDPOINTS
# ========================

@api_router.post("/issues", response_model=IssueResponse)
async def create_issue(issue: IssueCreate, current_user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one({"id": issue.po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    issue_doc = {
        "id": str(uuid.uuid4()),
        "issue_number": generate_issue_number(),
        "po_id": issue.po_id,
        "vendor_id": po["vendor_id"],
        "issue_type": issue.issue_type,
        "description": issue.description,
        "affected_items": issue.affected_items,
        "priority": issue.priority,
        "status": "open",
        "resolution": None,
        "created_by": current_user["user_id"],
        "resolved_by": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.issues.insert_one(issue_doc)
    await create_audit_log("CREATE_ISSUE", "issue", issue_doc["id"], current_user, {"po_id": issue.po_id})
    
    vendor = await db.vendors.find_one({"id": po["vendor_id"]}, {"_id": 0})
    issue_doc["vendor_name"] = vendor.get("name") if vendor else None
    issue_doc["po_number"] = po["po_number"]
    
    return IssueResponse(**issue_doc)

@api_router.get("/issues", response_model=List[IssueResponse])
async def get_issues(status: Optional[str] = None, priority: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    issues = await db.issues.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get vendor and PO info
    vendor_ids = list(set(i["vendor_id"] for i in issues))
    po_ids = list(set(i["po_id"] for i in issues))
    
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(1000)
    pos = await db.purchase_orders.find({"id": {"$in": po_ids}}, {"_id": 0}).to_list(1000)
    
    vendor_map = {v["id"]: v["name"] for v in vendors}
    po_map = {p["id"]: p["po_number"] for p in pos}
    
    result = []
    for i in issues:
        i["vendor_name"] = vendor_map.get(i["vendor_id"])
        i["po_number"] = po_map.get(i["po_id"])
        result.append(IssueResponse(**i))
    
    return result

@api_router.get("/issues/{issue_id}", response_model=IssueResponse)
async def get_issue(issue_id: str, current_user: dict = Depends(get_current_user)):
    issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    vendor = await db.vendors.find_one({"id": issue["vendor_id"]}, {"_id": 0})
    po = await db.purchase_orders.find_one({"id": issue["po_id"]}, {"_id": 0})
    
    issue["vendor_name"] = vendor.get("name") if vendor else None
    issue["po_number"] = po.get("po_number") if po else None
    
    return IssueResponse(**issue)

@api_router.put("/issues/{issue_id}", response_model=IssueResponse)
async def update_issue(issue_id: str, issue_update: IssueUpdate, current_user: dict = Depends(get_current_user)):
    existing = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    update_data = {k: v for k, v in issue_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if update_data.get("status") == "resolved":
        update_data["resolved_by"] = current_user["user_id"]
    
    await db.issues.update_one({"id": issue_id}, {"$set": update_data})
    await create_audit_log("UPDATE_ISSUE", "issue", issue_id, current_user, update_data)
    
    updated = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    vendor = await db.vendors.find_one({"id": updated["vendor_id"]}, {"_id": 0})
    po = await db.purchase_orders.find_one({"id": updated["po_id"]}, {"_id": 0})
    
    updated["vendor_name"] = vendor.get("name") if vendor else None
    updated["po_number"] = po.get("po_number") if po else None
    
    return IssueResponse(**updated)

@api_router.delete("/issues/{issue_id}")
async def delete_issue(issue_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can delete issues")
    
    result = await db.issues.delete_one({"id": issue_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    await create_audit_log("DELETE_ISSUE", "issue", issue_id, current_user)
    return {"message": "Issue deleted successfully"}

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
    
    # Line items without prices
    items_public = []
    for item in po.get("line_items", []):
        items_public.append({
            "product_name": item.get("product_name"),
            "sku": item.get("sku"),
            "quantity": item.get("quantity")
        })
    
    return {
        "po_number": po["po_number"],
        "status": po["status"],
        "vendor_name": vendor.get("name") if vendor else None,
        "delivery_address": po["delivery_address"],
        "contact_person": po["contact_person"],
        "delivery_date": po.get("delivery_date", ""),
        "line_items": items_public,
        "dispatch": {
            "courier_partner": dispatch.get("courier_partner") if dispatch else None,
            "tracking_id": dispatch.get("tracking_id") if dispatch else None,
            "dispatch_date": dispatch.get("dispatch_date") if dispatch else None,
            "expected_delivery_date": dispatch.get("expected_delivery_date") if dispatch else None
        } if dispatch else None,
        "timeline": timeline
    }

# ========================
# INVOICE ENDPOINTS
# ========================

@api_router.post("/invoices", response_model=InvoiceResponse)
async def create_invoice(invoice: InvoiceCreate, current_user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one({"id": invoice.po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != po["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    invoice_doc = {
        "id": str(uuid.uuid4()),
        "po_id": invoice.po_id,
        "vendor_id": po["vendor_id"],
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date,
        "due_date": invoice.due_date,
        "amount": invoice.amount,
        "paid_amount": 0,
        "payment_status": "pending",
        "file_url": invoice.file_url,
        "notes": invoice.notes,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.invoices.insert_one(invoice_doc)
    await create_audit_log("CREATE_INVOICE", "invoice", invoice_doc["id"], current_user, {"po_id": invoice.po_id})
    
    invoice_doc["po_number"] = po["po_number"]
    vendor = await db.vendors.find_one({"id": po["vendor_id"]}, {"_id": 0})
    invoice_doc["vendor_name"] = vendor.get("name") if vendor else None
    
    return InvoiceResponse(**invoice_doc)

@api_router.get("/invoices", response_model=List[InvoiceResponse])
async def get_invoices(po_id: Optional[str] = None, payment_status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if po_id:
        query["po_id"] = po_id
    if payment_status:
        query["payment_status"] = payment_status
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get PO and vendor info
    po_ids = list(set(i["po_id"] for i in invoices))
    vendor_ids = list(set(i.get("vendor_id") for i in invoices if i.get("vendor_id")))
    
    pos = await db.purchase_orders.find({"id": {"$in": po_ids}}, {"_id": 0}).to_list(1000)
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(1000)
    
    po_map = {p["id"]: p["po_number"] for p in pos}
    vendor_map = {v["id"]: v["name"] for v in vendors}
    
    result = []
    for inv in invoices:
        inv["po_number"] = po_map.get(inv["po_id"])
        inv["vendor_name"] = vendor_map.get(inv.get("vendor_id"))
        if "paid_amount" not in inv:
            inv["paid_amount"] = 0
        if "due_date" not in inv:
            inv["due_date"] = None
        result.append(InvoiceResponse(**inv))
    
    return result

@api_router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    po = await db.purchase_orders.find_one({"id": invoice["po_id"]}, {"_id": 0})
    vendor = await db.vendors.find_one({"id": invoice.get("vendor_id")}, {"_id": 0})
    
    invoice["po_number"] = po.get("po_number") if po else None
    invoice["vendor_name"] = vendor.get("name") if vendor else None
    if "paid_amount" not in invoice:
        invoice["paid_amount"] = 0
    if "due_date" not in invoice:
        invoice["due_date"] = None
    
    return InvoiceResponse(**invoice)

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can delete invoices")
    
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    await create_audit_log("DELETE_INVOICE", "invoice", invoice_id, current_user)
    return {"message": "Invoice deleted successfully"}

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
    
    existing_payments = await db.payments.find({"invoice_id": payment.invoice_id}, {"_id": 0}).to_list(1000)
    total_paid = sum(p["amount"] for p in existing_payments) + payment.amount
    
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
    
    # Update invoice
    await db.invoices.update_one(
        {"id": payment.invoice_id},
        {"$set": {"paid_amount": total_paid, "payment_status": payment_status}}
    )
    
    await create_audit_log("CREATE_PAYMENT", "payment", payment_doc["id"], current_user, {"invoice_id": payment.invoice_id})
    
    return PaymentResponse(**payment_doc)

@api_router.get("/payments", response_model=List[PaymentResponse])
async def get_payments(invoice_id: Optional[str] = None, po_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if invoice_id:
        query["invoice_id"] = invoice_id
    if po_id:
        query["po_id"] = po_id
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        vendor_invoices = await db.invoices.find({"vendor_id": current_user["vendor_id"]}, {"id": 1, "_id": 0}).to_list(1000)
        invoice_ids = [i["id"] for i in vendor_invoices]
        query["invoice_id"] = {"$in": invoice_ids}
    
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [PaymentResponse(**p) for p in payments]

@api_router.get("/payments/pending")
async def get_pending_payments(current_user: dict = Depends(get_current_user)):
    query = {"payment_status": {"$in": ["pending", "partially_paid"]}}
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("due_date", 1).to_list(100)
    
    # Get PO and vendor info
    po_ids = list(set(i["po_id"] for i in invoices))
    vendor_ids = list(set(i.get("vendor_id") for i in invoices if i.get("vendor_id")))
    
    pos = await db.purchase_orders.find({"id": {"$in": po_ids}}, {"_id": 0}).to_list(1000)
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(1000)
    
    po_map = {p["id"]: p["po_number"] for p in pos}
    vendor_map = {v["id"]: v["name"] for v in vendors}
    
    result = []
    for inv in invoices:
        result.append({
            "id": inv["id"],
            "invoice_number": inv["invoice_number"],
            "po_number": po_map.get(inv["po_id"]),
            "vendor_name": vendor_map.get(inv.get("vendor_id")),
            "amount": inv["amount"],
            "paid_amount": inv.get("paid_amount", 0),
            "pending_amount": inv["amount"] - inv.get("paid_amount", 0),
            "due_date": inv.get("due_date"),
            "payment_status": inv.get("payment_status", "pending")
        })
    
    return result

@api_router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can delete payments")
    
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Update invoice
    invoice = await db.invoices.find_one({"id": payment["invoice_id"]}, {"_id": 0})
    if invoice:
        new_paid = invoice.get("paid_amount", 0) - payment["amount"]
        new_status = "pending" if new_paid <= 0 else "partially_paid"
        await db.invoices.update_one(
            {"id": payment["invoice_id"]},
            {"$set": {"paid_amount": max(0, new_paid), "payment_status": new_status}}
        )
    
    await db.payments.delete_one({"id": payment_id})
    await create_audit_log("DELETE_PAYMENT", "payment", payment_id, current_user)
    
    return {"message": "Payment deleted successfully"}

# ========================
# RETURNS WITH CREDIT NOTES
# ========================

@api_router.post("/returns", response_model=ReturnResponse)
async def create_return(return_req: ReturnCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can create returns")
    
    po = await db.purchase_orders.find_one({"id": return_req.po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    vendor = await db.vendors.find_one({"id": return_req.vendor_id}, {"_id": 0})
    
    # Calculate total value
    total_value = sum(item.quantity * item.unit_price for item in return_req.items)
    
    # Auto-generate credit note
    credit_note_number = generate_credit_note_number()
    
    return_doc = {
        "id": str(uuid.uuid4()),
        "return_number": generate_return_number(),
        "po_id": return_req.po_id,
        "vendor_id": return_req.vendor_id,
        "items": [item.model_dump() for item in return_req.items],
        "total_value": total_value,
        "status": "credit_issued",
        "credit_note_number": credit_note_number,
        "credit_note_date": datetime.now(timezone.utc).isoformat(),
        "notes": return_req.notes,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.returns.insert_one(return_doc)
    await create_audit_log("CREATE_RETURN", "return", return_doc["id"], current_user, {"po_id": return_req.po_id})
    
    return_doc["vendor_name"] = vendor.get("name") if vendor else None
    return_doc["po_number"] = po["po_number"]
    
    return ReturnResponse(**return_doc)

@api_router.get("/returns", response_model=List[ReturnResponse])
async def get_returns(vendor_id: Optional[str] = None, status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if vendor_id:
        query["vendor_id"] = vendor_id
    if status:
        query["status"] = status
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    
    returns = await db.returns.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    vendor_ids = list(set(r["vendor_id"] for r in returns))
    po_ids = list(set(r["po_id"] for r in returns))
    
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(1000)
    pos = await db.purchase_orders.find({"id": {"$in": po_ids}}, {"_id": 0}).to_list(1000)
    
    vendor_map = {v["id"]: v["name"] for v in vendors}
    po_map = {p["id"]: p["po_number"] for p in pos}
    
    result = []
    for r in returns:
        r["vendor_name"] = vendor_map.get(r["vendor_id"])
        r["po_number"] = po_map.get(r["po_id"])
        if "total_value" not in r:
            r["total_value"] = 0
        if "credit_note_number" not in r:
            r["credit_note_number"] = None
        if "credit_note_date" not in r:
            r["credit_note_date"] = None
        result.append(ReturnResponse(**r))
    
    return result

@api_router.get("/returns/{return_id}", response_model=ReturnResponse)
async def get_return(return_id: str, current_user: dict = Depends(get_current_user)):
    ret = await db.returns.find_one({"id": return_id}, {"_id": 0})
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    
    vendor = await db.vendors.find_one({"id": ret["vendor_id"]}, {"_id": 0})
    po = await db.purchase_orders.find_one({"id": ret["po_id"]}, {"_id": 0})
    
    ret["vendor_name"] = vendor.get("name") if vendor else None
    ret["po_number"] = po.get("po_number") if po else None
    if "total_value" not in ret:
        ret["total_value"] = 0
    if "credit_note_number" not in ret:
        ret["credit_note_number"] = None
    if "credit_note_date" not in ret:
        ret["credit_note_date"] = None
    
    return ReturnResponse(**ret)

@api_router.delete("/returns/{return_id}")
async def delete_return(return_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can delete returns")
    
    result = await db.returns.delete_one({"id": return_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Return not found")
    
    await create_audit_log("DELETE_RETURN", "return", return_id, current_user)
    return {"message": "Return deleted successfully"}

# ========================
# AUDIT LOG ENDPOINTS
# ========================

@api_router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(entity_type: Optional[str] = None, entity_id: Optional[str] = None, limit: int = 100, current_user: dict = Depends(get_current_user)):
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
        total_vendors = await db.vendors.count_documents({})
        active_vendors = await db.vendors.count_documents({"is_active": True})
        total_products = await db.products.count_documents({})
        total_pos = await db.purchase_orders.count_documents({})
        
        po_by_status = {}
        for status in ["draft", "sent", "confirmed", "dispatched", "delivered", "closed", "rejected"]:
            po_by_status[status] = await db.purchase_orders.count_documents({"status": status})
        
        # Upcoming deliveries
        upcoming_deliveries = await db.purchase_orders.find(
            {"status": {"$in": ["confirmed", "dispatched"]}},
            {"_id": 0}
        ).sort("delivery_date", 1).to_list(5)
        
        # Pending issues
        pending_issues = await db.issues.count_documents({"status": "open"})
        open_issues = await db.issues.find({"status": "open"}, {"_id": 0}).sort("created_at", -1).to_list(5)
        
        # Pending payments
        pending_invoices = await db.invoices.find(
            {"payment_status": {"$in": ["pending", "partially_paid"]}},
            {"_id": 0}
        ).to_list(100)
        total_pending_amount = sum(inv["amount"] - inv.get("paid_amount", 0) for inv in pending_invoices)
        
        return {
            "total_vendors": total_vendors,
            "active_vendors": active_vendors,
            "total_products": total_products,
            "total_pos": total_pos,
            "po_by_status": po_by_status,
            "upcoming_deliveries": upcoming_deliveries,
            "pending_issues": pending_issues,
            "open_issues": open_issues,
            "pending_payment_count": len(pending_invoices),
            "total_pending_amount": total_pending_amount
        }
    else:
        vendor_id = current_user.get("vendor_id")
        total_pos = await db.purchase_orders.count_documents({"vendor_id": vendor_id})
        
        po_by_status = {}
        for status in ["sent", "confirmed", "dispatched", "delivered", "closed"]:
            po_by_status[status] = await db.purchase_orders.count_documents({"vendor_id": vendor_id, "status": status})
        
        pending_pos = await db.purchase_orders.count_documents({"vendor_id": vendor_id, "status": "sent"})
        
        upcoming_deliveries = await db.purchase_orders.find(
            {"vendor_id": vendor_id, "status": {"$in": ["confirmed", "dispatched"]}},
            {"_id": 0}
        ).sort("delivery_date", 1).to_list(5)
        
        pending_issues = await db.issues.count_documents({"vendor_id": vendor_id, "status": "open"})
        
        pending_invoices = await db.invoices.find(
            {"vendor_id": vendor_id, "payment_status": {"$in": ["pending", "partially_paid"]}},
            {"_id": 0}
        ).to_list(100)
        total_pending_amount = sum(inv["amount"] - inv.get("paid_amount", 0) for inv in pending_invoices)
        
        return {
            "total_pos": total_pos,
            "po_by_status": po_by_status,
            "pending_pos": pending_pos,
            "upcoming_deliveries": upcoming_deliveries,
            "pending_issues": pending_issues,
            "pending_payment_count": len(pending_invoices),
            "total_pending_amount": total_pending_amount
        }

# ========================
# USERS MANAGEMENT
# ========================

@api_router.get("/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can view users")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can delete users")
    
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await create_audit_log("DELETE_USER", "user", user_id, current_user)
    return {"message": "User deleted successfully"}

# ========================
# SEED DATA
# ========================

@api_router.post("/seed")
async def seed_data():
    existing_users = await db.users.count_documents({})
    if existing_users > 0:
        return {"message": "Data already seeded"}
    
    # Create OLL Admin
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
    
    # Create Vendors with bank details and team members
    vendors_data = [
        {
            "id": str(uuid.uuid4()),
            "name": "TechParts Industries Pvt Ltd",
            "email": "sales@techparts.com",
            "phone": "+91 9876543210",
            "address": "123 Industrial Area, Phase 2, Mumbai, Maharashtra 400001",
            "gst_number": "27AABCU9603R1ZM",
            "contact_person": "Rajesh Kumar",
            "is_active": True,
            "bank_details": {
                "bank_name": "HDFC Bank",
                "branch": "Andheri West",
                "ifsc_code": "HDFC0001234",
                "account_number": "50100123456789",
                "account_holder_name": "TechParts Industries Pvt Ltd",
                "cancel_cheque_url": None
            },
            "team_members": [
                {"id": str(uuid.uuid4()), "name": "Rajesh Kumar", "phone": "+91 9876543210", "email": "rajesh@techparts.com", "role": "Director"},
                {"id": str(uuid.uuid4()), "name": "Priya Sharma", "phone": "+91 9876543211", "email": "priya@techparts.com", "role": "Accountant"},
                {"id": str(uuid.uuid4()), "name": "Amit Singh", "phone": "+91 9876543212", "email": "amit@techparts.com", "role": "Coordinator"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Supreme Electronics Ltd",
            "email": "info@supremeelec.com",
            "phone": "+91 9988776655",
            "address": "456 Electronic City, Bangalore, Karnataka 560100",
            "gst_number": "29AABCS1234R1ZP",
            "contact_person": "Suresh Menon",
            "is_active": True,
            "bank_details": {
                "bank_name": "ICICI Bank",
                "branch": "Electronic City",
                "ifsc_code": "ICIC0005678",
                "account_number": "123456789012",
                "account_holder_name": "Supreme Electronics Ltd",
                "cancel_cheque_url": None
            },
            "team_members": [
                {"id": str(uuid.uuid4()), "name": "Suresh Menon", "phone": "+91 9988776655", "email": "suresh@supremeelec.com", "role": "Director"},
                {"id": str(uuid.uuid4()), "name": "Kavitha R", "phone": "+91 9988776656", "email": "kavitha@supremeelec.com", "role": "Accountant"}
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for vendor in vendors_data:
        await db.vendors.insert_one(vendor)
    
    # Create Vendor Users
    vendor_user1 = {
        "id": str(uuid.uuid4()),
        "username": "vendor",
        "password": hash_password("vendor"),
        "email": "sales@techparts.com",
        "role": "vendor",
        "vendor_id": vendors_data[0]["id"],
        "name": "TechParts Vendor",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(vendor_user1)
    
    vendor_user2 = {
        "id": str(uuid.uuid4()),
        "username": "supreme",
        "password": hash_password("supreme"),
        "email": "info@supremeelec.com",
        "role": "vendor",
        "vendor_id": vendors_data[1]["id"],
        "name": "Supreme Vendor",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(vendor_user2)
    
    # Create Products
    products_data = [
        {"name": "Industrial Pump A100", "sku": "PUMP-A100", "vendor_id": vendors_data[0]["id"], "unit_price": 15000.00, "tax_rate": 18.0, "description": "High-performance industrial pump", "unit": "pcs"},
        {"name": "Control Valve V200", "sku": "VALVE-V200", "vendor_id": vendors_data[0]["id"], "unit_price": 8500.00, "tax_rate": 18.0, "description": "Precision control valve", "unit": "pcs"},
        {"name": "Pressure Sensor PS50", "sku": "SENSOR-PS50", "vendor_id": vendors_data[0]["id"], "unit_price": 3200.00, "tax_rate": 18.0, "description": "Digital pressure sensor", "unit": "pcs"},
        {"name": "Flow Meter FM300", "sku": "METER-FM300", "vendor_id": vendors_data[0]["id"], "unit_price": 12000.00, "tax_rate": 18.0, "description": "Ultrasonic flow meter", "unit": "pcs"},
        {"name": "Circuit Board CB101", "sku": "CB-101", "vendor_id": vendors_data[1]["id"], "unit_price": 2500.00, "tax_rate": 18.0, "description": "Custom PCB assembly", "unit": "pcs"},
        {"name": "Power Supply PS500", "sku": "PS-500", "vendor_id": vendors_data[1]["id"], "unit_price": 4500.00, "tax_rate": 18.0, "description": "500W industrial power supply", "unit": "pcs"},
        {"name": "LED Display LD200", "sku": "LD-200", "vendor_id": vendors_data[1]["id"], "unit_price": 6000.00, "tax_rate": 18.0, "description": "Industrial LED display panel", "unit": "pcs"},
    ]
    
    for product in products_data:
        product["id"] = str(uuid.uuid4())
        product["is_active"] = True
        product["created_at"] = datetime.now(timezone.utc).isoformat()
        product["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.products.insert_one(product)
    
    # Create sample POs
    po1 = {
        "id": str(uuid.uuid4()),
        "po_number": "PO-20250107-ABC123",
        "vendor_id": vendors_data[0]["id"],
        "delivery_address": "OLL Warehouse, Plot 45, Sector 18, Gurugram, Haryana 122001",
        "contact_person": "Vikram Patel",
        "contact_number": "+91 9123456789",
        "delivery_date": (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d"),
        "line_items": [
            {"product_id": products_data[0]["id"], "product_name": products_data[0]["name"], "sku": products_data[0]["sku"], "quantity": 5, "unit_price": 15000.00, "tax_rate": 18.0, "discount_amount": 0, "discount_percent": 5, "comment": "Urgent requirement"},
            {"product_id": products_data[1]["id"], "product_name": products_data[1]["name"], "sku": products_data[1]["sku"], "quantity": 10, "unit_price": 8500.00, "tax_rate": 18.0, "discount_amount": 0, "discount_percent": 0, "comment": None}
        ],
        "order_discount_amount": 0,
        "order_discount_percent": 2,
        "notes": "Please ensure proper packaging",
        "final_comments": "Delivery required before project deadline",
        "status": "confirmed",
        "tracking_token": str(uuid.uuid4()),
        "created_by": oll_admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "subtotal": 160000.00,
        "total_discount": 6650.00,
        "total_tax": 27603.00,
        "grand_total": 180953.00
    }
    await db.purchase_orders.insert_one(po1)
    
    po2 = {
        "id": str(uuid.uuid4()),
        "po_number": "PO-20250107-DEF456",
        "vendor_id": vendors_data[1]["id"],
        "delivery_address": "OLL Plant, Industrial Estate, Chennai, Tamil Nadu 600001",
        "contact_person": "Arun Kumar",
        "contact_number": "+91 9234567890",
        "delivery_date": (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d"),
        "line_items": [
            {"product_id": products_data[4]["id"], "product_name": products_data[4]["name"], "sku": products_data[4]["sku"], "quantity": 20, "unit_price": 2500.00, "tax_rate": 18.0, "discount_amount": 0, "discount_percent": 0, "comment": None},
            {"product_id": products_data[5]["id"], "product_name": products_data[5]["name"], "sku": products_data[5]["sku"], "quantity": 5, "unit_price": 4500.00, "tax_rate": 18.0, "discount_amount": 500, "discount_percent": 0, "comment": "Need warranty certificate"}
        ],
        "order_discount_amount": 0,
        "order_discount_percent": 0,
        "notes": None,
        "final_comments": None,
        "status": "dispatched",
        "tracking_token": str(uuid.uuid4()),
        "created_by": oll_admin["id"],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "subtotal": 72500.00,
        "total_discount": 500.00,
        "total_tax": 12960.00,
        "grand_total": 84960.00
    }
    await db.purchase_orders.insert_one(po2)
    
    # Create dispatch for PO2
    dispatch = {
        "id": str(uuid.uuid4()),
        "po_id": po2["id"],
        "courier_partner": "Delhivery",
        "tracking_id": "DL789456123",
        "dispatch_date": (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d"),
        "expected_delivery_date": (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%d"),
        "proof_url": None,
        "notes": "Fragile items - Handle with care",
        "created_by": vendor_user2["id"],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    }
    await db.dispatches.insert_one(dispatch)
    
    # Create an issue
    issue = {
        "id": str(uuid.uuid4()),
        "issue_number": "ISS-20250106-XYZ789",
        "po_id": po2["id"],
        "vendor_id": vendors_data[1]["id"],
        "issue_type": "delivery_delay",
        "description": "Expected delivery delayed by 2 days due to logistics issues",
        "affected_items": [],
        "priority": "medium",
        "status": "open",
        "resolution": None,
        "created_by": oll_admin["id"],
        "resolved_by": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.issues.insert_one(issue)
    
    # Create invoice
    invoice = {
        "id": str(uuid.uuid4()),
        "po_id": po1["id"],
        "vendor_id": vendors_data[0]["id"],
        "invoice_number": "INV-TP-2025-001",
        "invoice_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "due_date": (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d"),
        "amount": 180953.00,
        "paid_amount": 50000.00,
        "payment_status": "partially_paid",
        "file_url": None,
        "notes": None,
        "created_by": vendor_user1["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.invoices.insert_one(invoice)
    
    # Create payment
    payment = {
        "id": str(uuid.uuid4()),
        "invoice_id": invoice["id"],
        "po_id": po1["id"],
        "amount": 50000.00,
        "payment_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "payment_mode": "neft",
        "reference_id": "NEFT123456789",
        "payment_status": "partially_paid",
        "notes": "Advance payment",
        "created_by": oll_admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(payment)
    
    # Create more sample POs with different statuses
    # PO3 - Draft status
    po3 = {
        "id": str(uuid.uuid4()),
        "po_number": "PO-20250107-GHI789",
        "vendor_id": vendors_data[0]["id"],
        "delivery_address": "OLL Head Office, Cyber City, Gurugram, Haryana 122002",
        "contact_person": "Rahul Verma",
        "contact_number": "+91 9345678901",
        "delivery_date": (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%d"),
        "line_items": [
            {"product_id": products_data[2]["id"], "product_name": products_data[2]["name"], "sku": products_data[2]["sku"], "quantity": 15, "unit_price": 3200.00, "tax_rate": 18.0, "discount_amount": 0, "discount_percent": 0, "comment": None},
            {"product_id": products_data[3]["id"], "product_name": products_data[3]["name"], "sku": products_data[3]["sku"], "quantity": 3, "unit_price": 12000.00, "tax_rate": 18.0, "discount_amount": 0, "discount_percent": 10, "comment": "Bulk order discount"}
        ],
        "order_discount_amount": 0,
        "order_discount_percent": 0,
        "notes": "Draft order for Q1 requirements",
        "final_comments": None,
        "status": "draft",
        "tracking_token": str(uuid.uuid4()),
        "created_by": oll_admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "subtotal": 84000.00,
        "total_discount": 3600.00,
        "total_tax": 14472.00,
        "grand_total": 94872.00
    }
    await db.purchase_orders.insert_one(po3)
    
    # PO4 - Sent status (awaiting confirmation)
    po4 = {
        "id": str(uuid.uuid4()),
        "po_number": "PO-20250106-JKL012",
        "vendor_id": vendors_data[1]["id"],
        "delivery_address": "OLL Distribution Center, Whitefield, Bangalore, Karnataka 560066",
        "contact_person": "Meera Nair",
        "contact_number": "+91 9456789012",
        "delivery_date": (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d"),
        "line_items": [
            {"product_id": products_data[4]["id"], "product_name": products_data[4]["name"], "sku": products_data[4]["sku"], "quantity": 50, "unit_price": 2500.00, "tax_rate": 18.0, "discount_amount": 0, "discount_percent": 5, "comment": "High volume order"},
            {"product_id": products_data[6]["id"], "product_name": products_data[6]["name"], "sku": products_data[6]["sku"], "quantity": 10, "unit_price": 6000.00, "tax_rate": 18.0, "discount_amount": 0, "discount_percent": 0, "comment": None}
        ],
        "order_discount_amount": 2000,
        "order_discount_percent": 0,
        "notes": "Urgent requirement for new facility",
        "final_comments": "Please ensure timely delivery",
        "status": "sent",
        "tracking_token": str(uuid.uuid4()),
        "created_by": oll_admin["id"],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "subtotal": 185000.00,
        "total_discount": 8250.00,
        "total_tax": 31815.00,
        "grand_total": 208565.00
    }
    await db.purchase_orders.insert_one(po4)
    
    # PO5 - Delivered status
    po5 = {
        "id": str(uuid.uuid4()),
        "po_number": "PO-20250102-MNO345",
        "vendor_id": vendors_data[0]["id"],
        "delivery_address": "OLL Manufacturing Unit, MIDC, Pune, Maharashtra 411057",
        "contact_person": "Sanjay Kulkarni",
        "contact_number": "+91 9567890123",
        "delivery_date": (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d"),
        "line_items": [
            {"product_id": products_data[0]["id"], "product_name": products_data[0]["name"], "sku": products_data[0]["sku"], "quantity": 2, "unit_price": 15000.00, "tax_rate": 18.0, "discount_amount": 0, "discount_percent": 0, "comment": "Standard replacement"},
            {"product_id": products_data[1]["id"], "product_name": products_data[1]["name"], "sku": products_data[1]["sku"], "quantity": 5, "unit_price": 8500.00, "tax_rate": 18.0, "discount_amount": 0, "discount_percent": 0, "comment": None}
        ],
        "order_discount_amount": 0,
        "order_discount_percent": 0,
        "notes": None,
        "final_comments": "Delivery completed successfully",
        "status": "delivered",
        "tracking_token": str(uuid.uuid4()),
        "created_by": oll_admin["id"],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat(),
        "updated_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        "subtotal": 72500.00,
        "total_discount": 0,
        "total_tax": 13050.00,
        "grand_total": 85550.00
    }
    await db.purchase_orders.insert_one(po5)
    
    # Add dispatch for PO5
    dispatch5 = {
        "id": str(uuid.uuid4()),
        "po_id": po5["id"],
        "courier_partner": "Blue Dart",
        "tracking_id": "BD456789012",
        "dispatch_date": (datetime.now(timezone.utc) - timedelta(days=5)).strftime("%Y-%m-%d"),
        "expected_delivery_date": (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d"),
        "proof_url": None,
        "notes": None,
        "created_by": vendor_user1["id"],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    }
    await db.dispatches.insert_one(dispatch5)
    
    # Create a return
    return_doc = {
        "id": str(uuid.uuid4()),
        "return_number": "RET-20250105-ABC001",
        "po_id": po5["id"],
        "vendor_id": vendors_data[0]["id"],
        "items": [
            {"product_id": products_data[1]["id"], "product_name": products_data[1]["name"], "quantity": 1, "unit_price": 8500.00, "reason": "Defective unit received"}
        ],
        "total_value": 8500.00,
        "status": "credit_issued",
        "credit_note_number": "CN-20250105-XYZ001",
        "credit_note_date": datetime.now(timezone.utc).isoformat(),
        "notes": "Replacement requested",
        "created_by": oll_admin["id"],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.returns.insert_one(return_doc)
    
    return {
        "message": "Data seeded successfully with comprehensive sample data",
        "credentials": {
            "oll_admin": "olladmin/olladmin",
            "vendor1": "vendor/vendor",
            "vendor2": "supreme/supreme"
        }
    }

# Include the router
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
