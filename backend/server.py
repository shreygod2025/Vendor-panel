from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
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
from io import BytesIO
import httpx

# PDF Generation imports
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'oll-vendor-management-secret-key-2024')
ALGORITHM = "HS256"

# PO Sync Webhook Configuration
PO_SYNC_WEBHOOK_URL = os.environ.get('PO_SYNC_WEBHOOK_URL', '')
PO_SYNC_WEBHOOK_SECRET = os.environ.get('PO_SYNC_WEBHOOK_SECRET', '')

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
    username: str
    password: str

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
    username: Optional[str] = None
    password: Optional[str] = None

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
    custom_po_number: Optional[str] = None  # Optional custom PO number
    school_name: Optional[str] = None  # Optional school name
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
    send_immediately: bool = True  # Default to sending immediately

class POUpdate(BaseModel):
    school_name: Optional[str] = None
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
    school_name: Optional[str] = None
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
    # Distributor tracking fields
    created_by_role: Optional[str] = None
    created_by_name: Optional[str] = None
    distributor_id: Optional[str] = None
    # Rejection reason
    rejection_reason: Optional[str] = None

# Dispatch Models
class DispatchCreate(BaseModel):
    po_id: str
    courier_partner: str
    tracking_id: str
    tracking_url: Optional[str] = None
    dispatch_date: str
    expected_delivery_date: Optional[str] = None
    proof_url: Optional[str] = None
    notes: Optional[str] = None

class DispatchResponse(BaseModel):
    id: str
    po_id: str
    courier_partner: str
    tracking_id: str
    tracking_url: Optional[str] = None
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
class IssueReply(BaseModel):
    message: str
    attachment_url: Optional[str] = None

class IssueReplyResponse(BaseModel):
    id: str
    message: str
    attachment_url: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    created_by_role: str
    created_at: str

class IssueCreate(BaseModel):
    po_id: str
    issue_type: str  # delivery_delay, missing_components, damaged_goods, quality_issue, other
    description: str
    affected_items: List[Dict] = []
    priority: str = "medium"  # low, medium, high, critical
    attachment_url: Optional[str] = None  # Support for attachments

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
    attachment_url: Optional[str] = None
    replies: List[Dict] = []
    created_at: str
    updated_at: str
    created_by: str
    created_by_name: Optional[str] = None
    created_by_role: Optional[str] = None
    resolved_by: Optional[str]

# Vendor Delivery Submission Model
class VendorDeliverySubmit(BaseModel):
    invoice_number: str
    invoice_amount: float
    invoice_date: str
    logistics_cost: float = 0
    invoice_file_url: Optional[str] = None
    logistics_bill_url: Optional[str] = None
    delivery_proof_url: Optional[str] = None
    notes: Optional[str] = None

# Invoice Models
class InvoiceCreate(BaseModel):
    po_id: str
    invoice_number: str
    invoice_date: str
    amount: float
    due_date: Optional[str] = None
    file_url: Optional[str] = None
    logistics_cost: Optional[float] = 0
    logistics_bill_url: Optional[str] = None
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
    file_url: Optional[str] = None
    invoice_url: Optional[str] = None
    logistics_cost: Optional[float] = 0
    logistics_bill_url: Optional[str] = None
    delivery_proof_url: Optional[str] = None
    notes: Optional[str] = None
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

async def generate_po_number_sequential():
    """Generate sequential PO number like PO-001, PO-002, etc."""
    # Find the highest PO number
    last_po = await db.purchase_orders.find_one(
        {"po_number": {"$regex": "^PO-\\d+$"}},
        {"po_number": 1, "_id": 0},
        sort=[("po_number", -1)]
    )
    
    if last_po and last_po.get("po_number"):
        try:
            # Extract the number part
            last_num = int(last_po["po_number"].split("-")[1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        # Check total count to start from correct number
        count = await db.purchase_orders.count_documents({})
        next_num = count + 1 if count > 0 else 1
    
    return f"PO-{next_num:03d}"

def generate_po_number():
    # Fallback sync version - uses UUID
    return f"PO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

def generate_return_number():
    return f"RET-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

def generate_credit_note_number():
    return f"CN-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

async def generate_issue_number_for_po(po_number: str):
    """Generate issue number like PO-001-ISS-001"""
    # Count existing issues for this PO
    count = await db.issues.count_documents({"po_number": po_number})
    issue_num = count + 1
    return f"{po_number}-ISS-{issue_num:03d}"

def generate_issue_number():
    # Fallback sync version
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

async def trigger_po_sync_webhook():
    """Trigger the PO sync webhook to update external panel"""
    if not PO_SYNC_WEBHOOK_URL or not PO_SYNC_WEBHOOK_SECRET:
        logger.warning("PO sync webhook not configured, skipping sync")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{PO_SYNC_WEBHOOK_URL}?secret={PO_SYNC_WEBHOOK_SECRET}"
            )
            if response.status_code == 200:
                logger.info("PO sync webhook triggered successfully")
                return True
            else:
                logger.error(f"PO sync webhook failed with status {response.status_code}: {response.text}")
                return False
    except Exception as e:
        logger.error(f"PO sync webhook error: {e}")
        return False

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
    
    # Check if username already exists
    existing_user = await db.users.find_one({"username": vendor.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    vendor_dict = vendor.model_dump()
    # Remove password from vendor doc
    password = vendor_dict.pop("password", None)
    username = vendor_dict.pop("username", None)
    
    if vendor_dict.get("bank_details"):
        vendor_dict["bank_details"] = vendor_dict["bank_details"]
    if vendor_dict.get("team_members"):
        vendor_dict["team_members"] = [tm if isinstance(tm, dict) else tm.model_dump() for tm in vendor_dict["team_members"]]
    
    vendor_id = str(uuid.uuid4())
    vendor_doc = {
        "id": vendor_id,
        **vendor_dict,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vendors.insert_one(vendor_doc)
    
    # Create user account for vendor
    user_doc = {
        "id": str(uuid.uuid4()),
        "username": username,
        "password": hash_password(password),
        "role": "vendor",
        "vendor_id": vendor_id,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
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
    
    # Handle password update separately
    password = update_data.pop("password", None)
    username = update_data.pop("username", None)
    
    if "bank_details" in update_data and update_data["bank_details"]:
        update_data["bank_details"] = update_data["bank_details"] if isinstance(update_data["bank_details"], dict) else update_data["bank_details"].model_dump()
    if "team_members" in update_data and update_data["team_members"]:
        update_data["team_members"] = [tm if isinstance(tm, dict) else tm.model_dump() for tm in update_data["team_members"]]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.vendors.update_one({"id": vendor_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Update user account if password or username provided
    if password or username:
        user_update = {}
        if password:
            user_update["password"] = hash_password(password)
        if username:
            # Check if new username already exists
            existing = await db.users.find_one({"username": username, "vendor_id": {"$ne": vendor_id}})
            if existing:
                raise HTTPException(status_code=400, detail="Username already exists")
            user_update["username"] = username
        
        if user_update:
            await db.users.update_one({"vendor_id": vendor_id}, {"$set": user_update})
    
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

class ProductImportItem(BaseModel):
    name: str
    sku: str
    vendor_name: str
    unit_price: float = 0
    tax_rate: float = 18
    description: Optional[str] = ""
    unit: str = "pcs"
    is_active: bool = True

class ProductImportRequest(BaseModel):
    products: List[ProductImportItem]

@api_router.post("/products/import")
async def import_products(import_data: ProductImportRequest, current_user: dict = Depends(get_current_user)):
    """Bulk import products from a list. Maps vendor names to IDs."""
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can import products")
    
    # Get all vendors for mapping
    vendors = await db.vendors.find({}, {"_id": 0}).to_list(1000)
    vendor_map = {v["name"].lower(): v["id"] for v in vendors}
    
    success_count = 0
    fail_count = 0
    errors = []
    imported_products = []
    
    for idx, item in enumerate(import_data.products):
        try:
            # Find vendor by name (case-insensitive)
            vendor_id = vendor_map.get(item.vendor_name.lower())
            
            if not vendor_id:
                fail_count += 1
                errors.append(f"Row {idx + 1}: Vendor '{item.vendor_name}' not found")
                continue
            
            # Check if SKU already exists
            existing = await db.products.find_one({"sku": item.sku}, {"_id": 0})
            if existing:
                fail_count += 1
                errors.append(f"Row {idx + 1}: SKU '{item.sku}' already exists")
                continue
            
            product_doc = {
                "id": str(uuid.uuid4()),
                "name": item.name,
                "sku": item.sku,
                "vendor_id": vendor_id,
                "unit_price": float(item.unit_price),
                "tax_rate": float(item.tax_rate),
                "description": item.description or "",
                "unit": item.unit or "pcs",
                "is_active": item.is_active,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.products.insert_one(product_doc)
            success_count += 1
            imported_products.append({"name": item.name, "sku": item.sku})
            
        except Exception as e:
            fail_count += 1
            errors.append(f"Row {idx + 1}: {str(e)}")
    
    # Create audit log for the import
    await create_audit_log("IMPORT_PRODUCTS", "product", "bulk", current_user, {
        "success_count": success_count,
        "fail_count": fail_count
    })
    
    return {
        "success": True,
        "message": f"Imported {success_count} products. {fail_count} failed." if fail_count else f"Successfully imported {success_count} products.",
        "success_count": success_count,
        "fail_count": fail_count,
        "errors": errors[:10],  # Return first 10 errors
        "imported": imported_products
    }

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
        # Ensure unit field exists
        if "unit" not in p:
            p["unit"] = "pcs"
        # Hide pricing for distributors
        if current_user.get("role") == "distributor":
            p["unit_price"] = 0
            p["tax_rate"] = 0
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
    # Ensure unit field exists
    if "unit" not in product:
        product["unit"] = "pcs"
    
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

@api_router.get("/purchase-orders/next-po-number")
async def get_next_po_number(current_user: dict = Depends(get_current_user)):
    """Get the next sequential PO number for display in form"""
    next_po = await generate_po_number_sequential()
    return {"next_po_number": next_po}

@api_router.post("/purchase-orders", response_model=POResponse)
async def create_purchase_order(po: POCreate, current_user: dict = Depends(get_current_user)):
    # Allow OLL and Distributors to create POs
    if current_user.get("role") not in ["oll", "distributor"]:
        raise HTTPException(status_code=403, detail="Only OLL or Distributors can create purchase orders")
    
    vendor = await db.vendors.find_one({"id": po.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Handle custom PO number or generate sequential
    if po.custom_po_number and po.custom_po_number.strip():
        po_number = po.custom_po_number.strip().upper()
    else:
        po_number = await generate_po_number_sequential()
    
    # Check for duplicate PO number
    existing_po = await db.purchase_orders.find_one({"po_number": po_number}, {"_id": 0})
    if existing_po:
        raise HTTPException(status_code=400, detail=f"PO number '{po_number}' already exists. Please use a unique PO number.")
    
    totals = calculate_po_totals(po.line_items, po.order_discount_amount, po.order_discount_percent)
    
    # Set status based on send_immediately flag - default is "sent"
    initial_status = "sent" if po.send_immediately else "draft"
    
    # Get user details for distributor tracking
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
    user_name = user.get("name") if user else current_user.get("username")
    
    po_doc = {
        "id": str(uuid.uuid4()),
        "po_number": po_number,
        "vendor_id": po.vendor_id,
        "school_name": po.school_name,
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
        "status": initial_status,
        "tracking_token": str(uuid.uuid4()),
        "created_by": current_user["user_id"],
        "created_by_role": current_user.get("role"),
        "created_by_name": user_name,
        "distributor_id": current_user["user_id"] if current_user.get("role") == "distributor" else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **totals
    }
    
    await db.purchase_orders.insert_one(po_doc)
    await create_audit_log("CREATE_PO", "purchase_order", po_doc["id"], current_user, {"po_number": po_doc["po_number"], "status": initial_status})
    
    # Trigger webhook to sync PO data to external panel
    asyncio.create_task(trigger_po_sync_webhook())
    
    po_doc["vendor_name"] = vendor.get("name")
    return POResponse(**po_doc)

@api_router.get("/purchase-orders", response_model=List[POResponse])
async def get_purchase_orders(status: Optional[str] = None, vendor_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    # Filter by role
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    elif current_user.get("role") == "distributor":
        # Distributors can only see POs they created
        query["distributor_id"] = current_user["user_id"]
    
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
        # Add school_name if missing
        if "school_name" not in p:
            p["school_name"] = None
        # Add distributor fields if missing
        if "created_by_role" not in p:
            p["created_by_role"] = "oll"
        if "created_by_name" not in p:
            p["created_by_name"] = None
        if "distributor_id" not in p:
            p["distributor_id"] = None
        # Add rejection reason if missing
        if "rejection_reason" not in p:
            p["rejection_reason"] = None
        result.append(POResponse(**p))
    
    return result

@api_router.get("/purchase-orders/{po_id}", response_model=POResponse)
async def get_purchase_order(po_id: str, current_user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Access control
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != po["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.get("role") == "distributor" and po.get("distributor_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    vendor = await db.vendors.find_one({"id": po["vendor_id"]}, {"_id": 0})
    po["vendor_name"] = vendor.get("name") if vendor else None
    if "final_comments" not in po:
        po["final_comments"] = None
    if "delivery_date" not in po:
        po["delivery_date"] = ""
    if "receiver_name" not in po:
        po["receiver_name"] = None
    # Add school_name if missing
    if "school_name" not in po:
        po["school_name"] = None
    # Add distributor fields if missing
    if "created_by_role" not in po:
        po["created_by_role"] = "oll"
    if "created_by_name" not in po:
        po["created_by_name"] = None
    if "distributor_id" not in po:
        po["distributor_id"] = None
    # Add rejection reason if missing
    if "rejection_reason" not in po:
        po["rejection_reason"] = None
    
    return POResponse(**po)

# PDF Generation function
def generate_po_pdf(po_data: dict, vendor_data: dict) -> BytesIO:
    """Generate a PDF for a Purchase Order"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm, topMargin=10*mm, bottomMargin=10*mm)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='POTitle', fontSize=16, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=2*mm))
    styles.add(ParagraphStyle(name='SubHeader', fontSize=12, fontName='Helvetica-Bold', alignment=TA_LEFT))
    styles.add(ParagraphStyle(name='Normal_R', fontSize=10, fontName='Helvetica', alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='Small', fontSize=9, fontName='Helvetica', alignment=TA_LEFT, leading=12))
    styles.add(ParagraphStyle(name='Bold', fontSize=10, fontName='Helvetica-Bold', alignment=TA_LEFT))
    styles.add(ParagraphStyle(name='Center', fontSize=9, fontName='Helvetica', alignment=TA_CENTER))
    
    elements = []
    
    # Get asset paths
    assets_dir = Path(__file__).parent / "assets"
    logo_path = assets_dir / "oll_logo.png"
    signature_path = assets_dir / "signature.png"
    
    # Header with Logo and PO details
    logo_img = None
    if logo_path.exists():
        try:
            logo_img = Image(str(logo_path), width=40*mm, height=15*mm)
        except:
            logo_img = Paragraph('<b>OLL</b>', styles['POTitle'])
    else:
        logo_img = Paragraph('<b>OLL</b>', styles['POTitle'])
    
    po_date = po_data.get("created_at", "")[:10] if po_data.get("created_at") else ""
    
    header_data = [
        [logo_img, Paragraph('<b>PURCHASE ORDER</b>', styles['POTitle']), Paragraph(f'<b>PO NO:</b> {po_data.get("po_number", "")}', styles['Normal_R'])],
        ['', '', Paragraph(f'<b>Date:</b> {po_date}', styles['Normal_R'])]
    ]
    header_table = Table(header_data, colWidths=[45*mm, 85*mm, 50*mm])
    header_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 3*mm))
    
    # Horizontal line
    elements.append(Table([['']], colWidths=[180*mm], rowHeights=[0.5]))
    elements[-1].setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 1, colors.HexColor('#1e3a8a'))]))
    elements.append(Spacer(1, 5*mm))
    
    # Company Info (OLL)
    company_info = """<b><i>Clonefutura Live Solutions Pvt Ltd.</i></b><br/>
103 1st floor - Kshitij building, Veera Desai Rd,<br/>
Dattaguru Nagar, Azad Nagar, Andheri West,<br/>
Mumbai, Maharashtra 400053<br/>
<b>Phone:</b> +919699188188<br/>
<b>GST No:</b> 27AAKCC1113B1ZC"""
    elements.append(Paragraph(company_info, styles['Small']))
    elements.append(Spacer(1, 6*mm))
    
    # Vendor and Ship To sections
    vendor_info = f"""<b>VENDOR</b><br/>
<b>{vendor_data.get('name', '')}</b><br/>
{vendor_data.get('address', 'N/A')}<br/>
<b>Phone:</b> {vendor_data.get('phone', 'N/A')}<br/>
<b>Email:</b> {vendor_data.get('email', 'N/A')}"""
    
    # Build ship to info with optional school name
    school_name = po_data.get('school_name', '')
    ship_to_lines = ['<b>SHIP TO</b><br/>']
    if school_name:
        ship_to_lines.append(f'<b>{school_name}</b><br/>')
    ship_to_lines.append(f'<b>{po_data.get("contact_person", "")}</b><br/>')
    ship_to_lines.append(f'{po_data.get("delivery_address", "")}<br/>')
    ship_to_lines.append(f'<b>Phone:</b> {po_data.get("contact_number", "N/A")}')
    ship_to_info = ''.join(ship_to_lines)
    
    info_data = [[Paragraph(vendor_info, styles['Small']), Paragraph(ship_to_info, styles['Small'])]]
    info_table = Table(info_data, colWidths=[90*mm, 90*mm])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 4*mm))
    
    # PO Details
    total_qty = sum(item.get('quantity', 0) for item in po_data.get('line_items', []))
    details_data = [[
        Paragraph(f'<b>Total Items:</b> {total_qty}', styles['Small']),
        Paragraph(f'<b>Delivery Date:</b> {po_data.get("delivery_date", "N/A")}', styles['Small'])
    ]]
    details_table = Table(details_data, colWidths=[90*mm, 90*mm])
    elements.append(details_table)
    elements.append(Spacer(1, 4*mm))
    
    # Rupee symbol function
    def fmt_rupee(amount):
        return f"Rs. {amount:,.2f}"
    
    # Line Items Table
    table_data = [['S.No', 'Item', 'Description', 'Qty', 'Unit Price', 'GST %', 'Total']]
    
    for idx, item in enumerate(po_data.get('line_items', []), 1):
        qty = item.get('quantity', 0)
        unit_price = item.get('unit_price', 0)
        tax_rate = item.get('tax_rate', 0)
        item_total = qty * unit_price
        tax_amount = item_total * (tax_rate / 100)
        total_with_tax = item_total + tax_amount
        
        table_data.append([
            str(idx),
            item.get('product_name', ''),
            item.get('comment', '-') or '-',
            str(qty),
            fmt_rupee(unit_price),
            f"{int(tax_rate)}%" if tax_rate else "0%",
            fmt_rupee(total_with_tax)
        ])
    
    items_table = Table(table_data, colWidths=[12*mm, 42*mm, 32*mm, 14*mm, 28*mm, 16*mm, 32*mm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (1, 1), (2, -1), 'LEFT'),
        ('ALIGN', (4, 1), (4, -1), 'RIGHT'),
        ('ALIGN', (6, 1), (6, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 4*mm))
    
    # Summary Section
    subtotal = po_data.get('subtotal', 0)
    total_tax = po_data.get('total_tax', 0)
    total_discount = po_data.get('total_discount', 0)
    grand_total = po_data.get('grand_total', 0)
    
    summary_data = [
        ['', 'SUB TOTAL', fmt_rupee(subtotal)],
        ['', 'GST Amount', fmt_rupee(total_tax)],
        ['', 'DISCOUNT', fmt_rupee(total_discount) if total_discount else '-'],
        ['', 'GRAND TOTAL', fmt_rupee(grand_total)],
    ]
    summary_table = Table(summary_data, colWidths=[100*mm, 40*mm, 40*mm])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (1, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LINEABOVE', (1, -1), (-1, -1), 1, colors.black),
        ('BACKGROUND', (1, -1), (-1, -1), colors.HexColor('#f0f9ff')),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 6*mm))
    
    # Notes
    if po_data.get('notes'):
        elements.append(Paragraph(f'<b>Notes:</b> {po_data.get("notes")}', styles['Small']))
        elements.append(Spacer(1, 4*mm))
    
    # Signature Section with actual signature image
    sig_img = None
    if signature_path.exists():
        try:
            sig_img = Image(str(signature_path), width=35*mm, height=18*mm)
        except:
            sig_img = None
    
    if sig_img:
        sig_data = [
            [sig_img, ''],
            ['_______________________', ''],
            [Paragraph('<b>Authorized Signatory</b>', styles['Center']), ''],
        ]
    else:
        sig_data = [
            ['', ''],
            ['_______________________', ''],
            [Paragraph('<b>Authorized Signatory</b>', styles['Center']), ''],
        ]
    
    sig_table = Table(sig_data, colWidths=[50*mm, 130*mm])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (0, -1), 'BOTTOM'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(sig_table)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer

@api_router.get("/purchase-orders/{po_id}/pdf")
async def download_po_pdf(po_id: str, current_user: dict = Depends(get_current_user)):
    """Download Purchase Order as PDF"""
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Access control
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != po["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.get("role") == "distributor" and po.get("distributor_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    vendor = await db.vendors.find_one({"id": po["vendor_id"]}, {"_id": 0})
    if not vendor:
        vendor = {"name": "Unknown Vendor", "address": "", "phone": "", "email": ""}
    
    # Generate PDF
    pdf_buffer = generate_po_pdf(po, vendor)
    
    # Return as downloadable file
    filename = f"PO-{po['po_number']}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

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
    
    # OLL can only edit draft, sent, confirmed, or rejected POs
    if current_user.get("role") == "oll":
        if existing["status"] not in ["draft", "sent", "confirmed", "rejected"]:
            raise HTTPException(status_code=400, detail="Only draft, sent, confirmed, or rejected POs can be edited")
    
    update_data = {k: v for k, v in po_update.model_dump().items() if v is not None}
    
    if "line_items" in update_data:
        line_items = [POLineItem(**item) for item in update_data["line_items"]]
        totals = calculate_po_totals(
            line_items,
            update_data.get("order_discount_amount", existing.get("order_discount_amount", 0)),
            update_data.get("order_discount_percent", existing.get("order_discount_percent", 0))
        )
        update_data.update(totals)
    
    # If OLL edits a confirmed, sent, or rejected PO, reset status to "sent" for vendor reconfirmation
    if current_user.get("role") == "oll" and existing["status"] in ["confirmed", "sent", "rejected"]:
        update_data["status"] = "sent"
        # Add note about edit/re-raise
        existing_notes = existing.get("notes", "") or ""
        if existing["status"] == "rejected":
            if "[Re-raised by OLL" not in existing_notes:
                update_data["notes"] = existing_notes + " [Re-raised by OLL after rejection]"
        elif "[Edited by OLL" not in existing_notes:
            update_data["notes"] = existing_notes + " [Edited by OLL - Requires reconfirmation]"
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.purchase_orders.update_one({"id": po_id}, {"$set": update_data})
    await create_audit_log("UPDATE_PO", "purchase_order", po_id, current_user, update_data)
    
    # Trigger webhook to sync PO data to external panel
    asyncio.create_task(trigger_po_sync_webhook())
    
    updated = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    vendor = await db.vendors.find_one({"id": updated["vendor_id"]}, {"_id": 0})
    updated["vendor_name"] = vendor.get("name") if vendor else None
    if "final_comments" not in updated:
        updated["final_comments"] = None
    if "delivery_date" not in updated:
        updated["delivery_date"] = ""
    if "receiver_name" not in updated:
        updated["receiver_name"] = None
    
    return POResponse(**updated)

@api_router.delete("/purchase-orders/{po_id}")
async def delete_purchase_order(po_id: str, force: bool = False, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can delete POs")
    
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # TEMPORARY: Allow force delete for any status (for cleaning test data)
    if force:
        # Delete related data
        deleted_invoices = await db.invoices.delete_many({"po_id": po_id})
        deleted_dispatches = await db.dispatches.delete_many({"po_id": po_id})
        deleted_payments = await db.payments.delete_many({"po_id": po_id})
        deleted_issues = await db.issues.delete_many({"po_id": po_id})
        
        await db.purchase_orders.delete_one({"id": po_id})
        await create_audit_log("FORCE_DELETE_PO", "purchase_order", po_id, current_user, {
            "deleted_invoices": deleted_invoices.deleted_count,
            "deleted_dispatches": deleted_dispatches.deleted_count,
            "deleted_payments": deleted_payments.deleted_count,
            "deleted_issues": deleted_issues.deleted_count
        })
        
        return {
            "message": "Purchase order and all related data deleted successfully",
            "deleted_invoices": deleted_invoices.deleted_count,
            "deleted_dispatches": deleted_dispatches.deleted_count,
            "deleted_payments": deleted_payments.deleted_count,
            "deleted_issues": deleted_issues.deleted_count
        }
    
    # Normal delete - only for certain statuses
    if po["status"] not in ["draft", "sent", "confirmed", "rejected"]:
        raise HTTPException(status_code=400, detail="Only draft, sent, confirmed, or rejected POs can be deleted. Use force=true for delivered POs.")
    
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
    
    # Trigger webhook to sync PO data
    asyncio.create_task(trigger_po_sync_webhook())
    
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
    
    # Trigger webhook to sync PO data
    asyncio.create_task(trigger_po_sync_webhook())
    
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

@api_router.post("/purchase-orders/{po_id}/vendor-deliver")
async def vendor_submit_delivery(po_id: str, delivery: VendorDeliverySubmit, current_user: dict = Depends(get_current_user)):
    """Vendor submits delivery - marks PO as pending_approval, creates invoice"""
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Only vendor can mark their own PO as delivered
    if current_user.get("role") == "vendor" and current_user.get("vendor_id") != po["vendor_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if po["status"] != "dispatched":
        raise HTTPException(status_code=400, detail="Only dispatched POs can be marked as delivered")
    
    # Update PO status to pending_approval
    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {
            "status": "pending_approval",
            "delivery_submitted_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create the invoice automatically
    invoice_doc = {
        "id": str(uuid.uuid4()),
        "po_id": po_id,
        "vendor_id": po["vendor_id"],
        "invoice_number": delivery.invoice_number,
        "invoice_date": delivery.invoice_date,
        "amount": delivery.invoice_amount,
        "logistics_cost": delivery.logistics_cost,
        "file_url": delivery.invoice_file_url,
        "invoice_url": delivery.invoice_file_url,
        "logistics_bill_url": delivery.logistics_bill_url,
        "delivery_proof_url": delivery.delivery_proof_url,
        "due_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()[:10],
        "paid_amount": 0,
        "payment_status": "pending",
        "notes": delivery.notes,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.invoices.insert_one(invoice_doc)
    
    await create_audit_log("VENDOR_SUBMIT_DELIVERY", "purchase_order", po_id, current_user, {
        "invoice_number": delivery.invoice_number,
        "invoice_amount": delivery.invoice_amount
    })
    
    # Trigger webhook to sync PO data
    asyncio.create_task(trigger_po_sync_webhook())
    
    return {"message": "Delivery submitted for approval", "invoice_id": invoice_doc["id"]}

@api_router.post("/purchase-orders/{po_id}/approve-delivery")
async def approve_delivery(po_id: str, current_user: dict = Depends(get_current_user)):
    """OLL admin approves the vendor's delivery - marks PO as delivered"""
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can approve deliveries")
    
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po["status"] != "pending_approval":
        raise HTTPException(status_code=400, detail="Only pending approval POs can be approved")
    
    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {
            "status": "delivered",
            "delivery_approved_at": datetime.now(timezone.utc).isoformat(),
            "delivery_approved_by": current_user["user_id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await create_audit_log("APPROVE_DELIVERY", "purchase_order", po_id, current_user)
    
    # Trigger webhook to sync PO data
    asyncio.create_task(trigger_po_sync_webhook())
    
    return {"message": "Delivery approved successfully"}

@api_router.post("/purchase-orders/{po_id}/reject-delivery")
async def reject_delivery(po_id: str, reason: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """OLL admin rejects the delivery - marks PO back to dispatched"""
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can reject deliveries")
    
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po["status"] != "pending_approval":
        raise HTTPException(status_code=400, detail="Only pending approval POs can be rejected")
    
    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {
            "status": "dispatched",
            "delivery_rejection_reason": reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Delete the auto-created invoice
    await db.invoices.delete_many({"po_id": po_id, "payment_status": "pending"})
    
    await create_audit_log("REJECT_DELIVERY", "purchase_order", po_id, current_user, {"reason": reason})
    return {"message": "Delivery rejected"}

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
    query = {"status": {"$in": ["confirmed", "dispatched", "pending_approval"]}}
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    elif current_user.get("role") == "distributor":
        # Distributors can only see deliveries for their POs
        query["distributor_id"] = current_user["user_id"]
    
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
        item = {
            "id": p["id"],
            "po_number": p["po_number"],
            "vendor_name": vendor_map.get(p["vendor_id"]),
            "delivery_date": p.get("delivery_date", ""),
            "delivery_address": p["delivery_address"],
            "contact_person": p["contact_person"],
            "status": p["status"],
            "dispatch": dispatch,
            "items_count": len(p.get("line_items", []))
        }
        # Hide pricing for distributors
        if current_user.get("role") != "distributor":
            item["grand_total"] = p["grand_total"]
        result.append(item)
    
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
    
    # Get creator info
    creator = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
    creator_name = creator.get("name") or creator.get("username") if creator else None
    
    # Generate issue number based on PO number
    po_number = po.get("po_number", "UNKNOWN")
    issue_number = await generate_issue_number_for_po(po_number)
    
    issue_doc = {
        "id": str(uuid.uuid4()),
        "issue_number": issue_number,
        "po_id": issue.po_id,
        "po_number": po_number,  # Store PO number for reference
        "vendor_id": po["vendor_id"],
        "issue_type": issue.issue_type,
        "description": issue.description,
        "affected_items": issue.affected_items,
        "priority": issue.priority,
        "status": "open",
        "resolution": None,
        "attachment_url": issue.attachment_url,
        "replies": [],
        "created_by": current_user["user_id"],
        "created_by_name": creator_name,
        "created_by_role": current_user.get("role", "oll"),
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
async def get_issues(status: Optional[str] = None, priority: Optional[str] = None, po_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if po_id:
        query["po_id"] = po_id
    
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        query["vendor_id"] = current_user["vendor_id"]
    elif current_user.get("role") == "distributor":
        # Distributors can only see issues for their POs
        distributor_pos = await db.purchase_orders.find(
            {"distributor_id": current_user["user_id"]},
            {"id": 1, "_id": 0}
        ).to_list(1000)
        distributor_po_ids = [p["id"] for p in distributor_pos]
        query["po_id"] = {"$in": distributor_po_ids}
    
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
        # Ensure new fields have defaults
        if "attachment_url" not in i:
            i["attachment_url"] = None
        if "replies" not in i:
            i["replies"] = []
        if "created_by_name" not in i:
            i["created_by_name"] = None
        if "created_by_role" not in i:
            i["created_by_role"] = "oll"
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
    # Ensure new fields have defaults
    if "attachment_url" not in issue:
        issue["attachment_url"] = None
    if "replies" not in issue:
        issue["replies"] = []
    if "created_by_name" not in issue:
        issue["created_by_name"] = None
    if "created_by_role" not in issue:
        issue["created_by_role"] = "oll"
    
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
    # Ensure new fields have defaults
    if "attachment_url" not in updated:
        updated["attachment_url"] = None
    if "replies" not in updated:
        updated["replies"] = []
    if "created_by_name" not in updated:
        updated["created_by_name"] = None
    if "created_by_role" not in updated:
        updated["created_by_role"] = "oll"
    
    return IssueResponse(**updated)

@api_router.post("/issues/{issue_id}/reply", response_model=IssueResponse)
async def add_issue_reply(issue_id: str, reply: IssueReply, current_user: dict = Depends(get_current_user)):
    """Add a reply to an issue. Both OLL and vendors can reply."""
    issue = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    # Vendors can only reply to their own issues
    if current_user.get("role") == "vendor" and current_user.get("vendor_id"):
        if issue["vendor_id"] != current_user["vendor_id"]:
            raise HTTPException(status_code=403, detail="You can only reply to your own issues")
    
    # Get replier info
    replier = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0})
    replier_name = replier.get("name") or replier.get("username") if replier else None
    
    reply_doc = {
        "id": str(uuid.uuid4()),
        "message": reply.message,
        "attachment_url": reply.attachment_url,
        "created_by": current_user["user_id"],
        "created_by_name": replier_name,
        "created_by_role": current_user.get("role", "oll"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add reply to issue
    await db.issues.update_one(
        {"id": issue_id},
        {
            "$push": {"replies": reply_doc},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    await create_audit_log("ADD_ISSUE_REPLY", "issue", issue_id, current_user, {"reply_id": reply_doc["id"]})
    
    # Return updated issue
    updated = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    vendor = await db.vendors.find_one({"id": updated["vendor_id"]}, {"_id": 0})
    po = await db.purchase_orders.find_one({"id": updated["po_id"]}, {"_id": 0})
    
    updated["vendor_name"] = vendor.get("name") if vendor else None
    updated["po_number"] = po.get("po_number") if po else None
    if "attachment_url" not in updated:
        updated["attachment_url"] = None
    if "replies" not in updated:
        updated["replies"] = []
    if "created_by_name" not in updated:
        updated["created_by_name"] = None
    if "created_by_role" not in updated:
        updated["created_by_role"] = "oll"
    
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
    invoice = await db.invoices.find_one({"po_id": po["id"]}, {"_id": 0})
    
    # Build status timeline
    timeline = [
        {"status": "created", "label": "Order Created", "date": po["created_at"], "completed": True}
    ]
    
    # Map status for timeline (handle pending_approval as dispatched)
    current_status = po["status"]
    if current_status == "pending_approval":
        current_status = "dispatched"  # Treat as dispatched for timeline purposes
    
    status_order = ["created", "sent", "confirmed", "dispatched", "delivered", "closed"]
    status_labels = {
        "created": "Order Created",
        "sent": "Sent to Vendor", 
        "confirmed": "Confirmed by Vendor",
        "dispatched": "Dispatched",
        "delivered": "Delivered",
        "closed": "Completed"
    }
    
    current_idx = status_order.index(current_status) if current_status in status_order else 0
    
    for idx, status in enumerate(status_order[1:], 1):
        timeline.append({
            "status": status,
            "label": status_labels.get(status, status.replace("_", " ").title()),
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
    
    # Get delivery info
    delivery_info = None
    if invoice:
        delivery_info = {
            "invoice_number": invoice.get("invoice_number"),
            "logistics_cost": invoice.get("logistics_cost", 0),
            "delivery_proof_url": invoice.get("delivery_proof_url"),
            "delivered_at": invoice.get("created_at")
        }
    
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
            "tracking_url": dispatch.get("tracking_url") if dispatch else None,
            "dispatch_date": dispatch.get("dispatch_date") if dispatch else None,
            "expected_delivery_date": dispatch.get("expected_delivery_date") if dispatch else None,
            "proof_url": dispatch.get("proof_url") if dispatch else None,
            "notes": dispatch.get("notes") if dispatch else None
        } if dispatch else None,
        "delivery": delivery_info,
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
        if "logistics_cost" not in inv:
            inv["logistics_cost"] = 0
        if "logistics_bill_url" not in inv:
            inv["logistics_bill_url"] = None
        if "delivery_proof_url" not in inv:
            inv["delivery_proof_url"] = None
        if "invoice_url" not in inv:
            inv["invoice_url"] = inv.get("file_url")
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
    
    vendor_id = invoice.get("vendor_id")
    
    # If payment mode is credit, validate vendor has enough credit
    if payment.payment_mode == "credit":
        # Get vendor credit
        returns = await db.returns.find({
            "vendor_id": vendor_id,
            "status": "credit_issued"
        }, {"_id": 0}).to_list(1000)
        total_credit = sum(r.get("credit_amount") or r.get("total_value", 0) for r in returns)
        
        # Get used credit
        credit_payments = await db.payments.find({
            "payment_mode": "credit",
            "vendor_id": vendor_id
        }, {"_id": 0}).to_list(1000)
        used_credit = sum(p.get("amount", 0) for p in credit_payments)
        
        available_credit = total_credit - used_credit
        
        if payment.amount > available_credit:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credit. Available: ₹{available_credit:.2f}, Requested: ₹{payment.amount:.2f}"
            )
    
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
        "vendor_id": vendor_id,
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

@api_router.get("/vendors/{vendor_id}/credit")
async def get_vendor_credit(vendor_id: str, current_user: dict = Depends(get_current_user)):
    """Get available credit for a vendor based on approved returns minus used credits"""
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Calculate total credit from approved returns (use total_value or credit_amount)
    returns = await db.returns.find({
        "vendor_id": vendor_id,
        "status": "credit_issued"
    }, {"_id": 0}).to_list(1000)
    
    total_credit = sum(r.get("credit_amount") or r.get("total_value", 0) for r in returns)
    
    # Calculate used credit from payments with mode "credit"
    payments = await db.payments.find({
        "payment_mode": "credit",
        "vendor_id": vendor_id
    }, {"_id": 0}).to_list(1000)
    
    used_credit = sum(p.get("amount", 0) for p in payments)
    
    available_credit = max(0, total_credit - used_credit)
    
    return {
        "vendor_id": vendor_id,
        "vendor_name": vendor.get("name"),
        "total_credit": total_credit,
        "used_credit": used_credit,
        "available_credit": available_credit,
        "returns": [{"id": r["id"], "credit_note_number": r.get("credit_note_number"), "credit_amount": r.get("credit_amount") or r.get("total_value", 0)} for r in returns]
    }

@api_router.get("/credits/by-vendor")
async def get_all_vendors_credit(current_user: dict = Depends(get_current_user)):
    """Get credit summary for all vendors"""
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can view all vendor credits")
    
    vendors = await db.vendors.find({}, {"_id": 0}).to_list(1000)
    
    # Get all credit_issued returns
    returns = await db.returns.find({"status": "credit_issued"}, {"_id": 0}).to_list(1000)
    
    # Get all credit payments
    payments = await db.payments.find({"payment_mode": "credit"}, {"_id": 0}).to_list(1000)
    
    # Calculate credit per vendor
    vendor_credits = {}
    for r in returns:
        vid = r.get("vendor_id")
        if vid not in vendor_credits:
            vendor_credits[vid] = {"total": 0, "used": 0}
        # Use credit_amount if set, otherwise use total_value
        vendor_credits[vid]["total"] += r.get("credit_amount") or r.get("total_value", 0)
    
    for p in payments:
        vid = p.get("vendor_id")
        if vid in vendor_credits:
            vendor_credits[vid]["used"] += p.get("amount", 0)
    
    result = []
    for v in vendors:
        vid = v["id"]
        credit_info = vendor_credits.get(vid, {"total": 0, "used": 0})
        available = max(0, credit_info["total"] - credit_info["used"])
        if credit_info["total"] > 0 or available > 0:
            result.append({
                "vendor_id": vid,
                "vendor_name": v.get("name"),
                "total_credit": credit_info["total"],
                "used_credit": credit_info["used"],
                "available_credit": available
            })
    
    return result

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
    elif current_user.get("role") == "distributor":
        # Distributor dashboard - filtered to their POs only
        distributor_id = current_user["user_id"]
        total_pos = await db.purchase_orders.count_documents({"distributor_id": distributor_id})
        
        po_by_status = {}
        for status in ["sent", "confirmed", "dispatched", "delivered", "closed"]:
            po_by_status[status] = await db.purchase_orders.count_documents({"distributor_id": distributor_id, "status": status})
        
        # Upcoming deliveries
        upcoming_deliveries = await db.purchase_orders.find(
            {"distributor_id": distributor_id, "status": {"$in": ["confirmed", "dispatched"]}},
            {"_id": 0, "grand_total": 0, "subtotal": 0, "total_tax": 0, "total_discount": 0}  # Hide pricing
        ).sort("delivery_date", 1).to_list(5)
        
        # Pending issues (for distributor's POs)
        distributor_pos = await db.purchase_orders.find(
            {"distributor_id": distributor_id},
            {"id": 1, "_id": 0}
        ).to_list(1000)
        distributor_po_ids = [p["id"] for p in distributor_pos]
        pending_issues = await db.issues.count_documents({"po_id": {"$in": distributor_po_ids}, "status": "open"})
        
        return {
            "total_pos": total_pos,
            "po_by_status": po_by_status,
            "upcoming_deliveries": upcoming_deliveries,
            "pending_issues": pending_issues
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
# SCHOOLS API (External)
# ========================

SCHOOLS_API_URL = os.environ.get('SCHOOLS_API_URL', '')
SCHOOLS_API_KEY = os.environ.get('SCHOOLS_API_KEY', '')

@api_router.get("/schools/search")
async def search_schools(q: str = "", limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Search schools from external API and return suggestions"""
    if not SCHOOLS_API_URL or not SCHOOLS_API_KEY:
        raise HTTPException(status_code=500, detail="Schools API not configured")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Fetch all schools (up to 500) from external API
            response = await client.get(
                SCHOOLS_API_URL,
                params={"limit": 500},
                headers={"X-API-Key": SCHOOLS_API_KEY}
            )
            response.raise_for_status()
            data = response.json()
            
            schools = data.get("data", [])
            
            # Filter by search query if provided
            if q:
                q_lower = q.lower()
                schools = [
                    s for s in schools 
                    if q_lower in s.get("school_name", "").lower()
                ]
            
            # Transform to simpler format for frontend
            results = []
            for school in schools[:limit]:
                results.append({
                    "id": school.get("id"),
                    "school_name": school.get("school_name", ""),
                    "address": school.get("location", {}).get("address") or "",
                    "city": school.get("location", {}).get("city") or "",
                    "state": school.get("location", {}).get("state") or "",
                    "contact_name": school.get("contact", {}).get("name") or "",
                    "contact_phone": school.get("contact", {}).get("phone") or "",
                    "contact_email": school.get("contact", {}).get("email") or "",
                })
            
            return {"schools": results, "total": len(schools)}
            
    except httpx.RequestError as e:
        logger.error(f"Schools API request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to schools API")
    except httpx.HTTPStatusError as e:
        logger.error(f"Schools API status error: {e}")
        raise HTTPException(status_code=500, detail="Schools API returned an error")

@api_router.get("/schools/{school_id}")
async def get_school_details(school_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed school info by ID"""
    if not SCHOOLS_API_URL or not SCHOOLS_API_KEY:
        raise HTTPException(status_code=500, detail="Schools API not configured")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{SCHOOLS_API_URL}/{school_id}",
                headers={"X-API-Key": SCHOOLS_API_KEY}
            )
            response.raise_for_status()
            school = response.json()
            
            return {
                "id": school.get("id"),
                "school_name": school.get("school_name", ""),
                "address": school.get("location", {}).get("address") or "",
                "city": school.get("location", {}).get("city") or "",
                "state": school.get("location", {}).get("state") or "",
                "contact_name": school.get("contact", {}).get("name") or "",
                "contact_phone": school.get("contact", {}).get("phone") or "",
                "contact_email": school.get("contact", {}).get("email") or "",
            }
            
    except httpx.RequestError as e:
        logger.error(f"Schools API request error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to schools API")
    except httpx.HTTPStatusError as e:
        logger.error(f"Schools API status error: {e}")
        raise HTTPException(status_code=404, detail="School not found")

# ========================
# PO SYNC WEBHOOK TRIGGER (Manual)
# ========================

@api_router.post("/sync/trigger-po-webhook")
async def manual_trigger_po_sync(current_user: dict = Depends(get_current_user)):
    """Manually trigger PO sync webhook (Admin only)"""
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL can trigger sync")
    
    success = await trigger_po_sync_webhook()
    if success:
        return {"message": "PO sync webhook triggered successfully", "status": "success"}
    else:
        return {"message": "PO sync webhook failed or not configured", "status": "failed"}

@api_router.post("/sync/cron-trigger")
async def cron_trigger_po_sync(secret: str = ""):
    """Cron endpoint to trigger PO sync (requires secret)"""
    if secret != PO_SYNC_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")
    
    success = await trigger_po_sync_webhook()
    return {"triggered": success, "timestamp": datetime.now(timezone.utc).isoformat()}

# ========================
# API KEY MANAGEMENT
# ========================

import secrets

class APIKeyCreate(BaseModel):
    name: str
    description: Optional[str] = None

class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    description: Optional[str] = None
    is_active: bool
    created_at: str
    created_by: str
    last_used_at: Optional[str] = None

@api_router.post("/api-keys")
async def create_api_key(key_data: APIKeyCreate, current_user: dict = Depends(get_current_user)):
    """Generate a new API key (Admin only)"""
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL admin can manage API keys")
    
    # Generate a secure API key
    raw_key = f"oll_ext_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:16] + "..."
    
    api_key_doc = {
        "id": str(uuid.uuid4()),
        "name": key_data.name,
        "description": key_data.description,
        "key": raw_key,  # Store the full key (in production, you might hash this)
        "key_prefix": key_prefix,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["user_id"],
        "created_by_name": current_user.get("username", "Unknown"),
        "last_used_at": None
    }
    
    await db.api_keys.insert_one(api_key_doc)
    
    # Return the full key only once during creation
    return {
        "id": api_key_doc["id"],
        "name": api_key_doc["name"],
        "key": raw_key,  # Full key shown only on creation
        "key_prefix": key_prefix,
        "description": api_key_doc["description"],
        "is_active": True,
        "created_at": api_key_doc["created_at"],
        "message": "Save this key securely - it won't be shown again!"
    }

@api_router.get("/api-keys")
async def list_api_keys(current_user: dict = Depends(get_current_user)):
    """List all API keys (Admin only)"""
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL admin can view API keys")
    
    keys = await db.api_keys.find({}, {"_id": 0, "key": 0}).sort("created_at", -1).to_list(100)
    return keys

@api_router.patch("/api-keys/{key_id}/toggle")
async def toggle_api_key(key_id: str, current_user: dict = Depends(get_current_user)):
    """Enable or disable an API key (Admin only)"""
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL admin can manage API keys")
    
    key = await db.api_keys.find_one({"id": key_id})
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    new_status = not key.get("is_active", True)
    await db.api_keys.update_one({"id": key_id}, {"$set": {"is_active": new_status}})
    
    return {"id": key_id, "is_active": new_status, "message": f"API key {'enabled' if new_status else 'disabled'}"}

@api_router.delete("/api-keys/{key_id}")
async def delete_api_key(key_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an API key (Admin only)"""
    if current_user.get("role") != "oll":
        raise HTTPException(status_code=403, detail="Only OLL admin can manage API keys")
    
    result = await db.api_keys.delete_one({"id": key_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return {"message": "API key deleted successfully"}

# ========================
# EXTERNAL API (for other applications)
# ========================

# External API Key for third-party access (fallback to env var)
EXTERNAL_API_KEY = os.environ.get('EXTERNAL_API_KEY', '')

async def verify_external_api_key(x_api_key: str = Header(None, alias="X-API-Key")):
    """Verify external API key for third-party applications"""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required. Use X-API-Key header.")
    
    # First check database for active keys
    db_key = await db.api_keys.find_one({"key": x_api_key, "is_active": True})
    if db_key:
        # Update last used timestamp
        await db.api_keys.update_one(
            {"id": db_key["id"]}, 
            {"$set": {"last_used_at": datetime.now(timezone.utc).isoformat()}}
        )
        return True
    
    # Fallback to environment variable key
    if EXTERNAL_API_KEY and x_api_key == EXTERNAL_API_KEY:
        return True
    
    raise HTTPException(status_code=401, detail="Invalid or inactive API key")

class ExternalPOResponse(BaseModel):
    """Response model for external PO API"""
    po_id: str
    po_number: str
    status: str
    created_at: str
    updated_at: str
    
    # School/Delivery Details
    school_name: Optional[str] = None
    delivery_address: str
    contact_person: str
    contact_number: str
    delivery_date: Optional[str] = None
    
    # Vendor Info
    vendor_id: str
    vendor_name: Optional[str] = None
    
    # Order Totals
    subtotal: float
    total_discount: float
    total_tax: float
    grand_total: float
    
    # Dispatch Details
    dispatch_info: Optional[Dict] = None
    tracking_link: Optional[str] = None
    
    # Invoice Details
    invoice_info: Optional[Dict] = None
    
    # Public tracking URL
    public_tracking_url: Optional[str] = None
    
    # File URLs
    po_pdf_url: Optional[str] = None
    invoice_file_url: Optional[str] = None
    logistics_bill_url: Optional[str] = None
    delivery_proof_url: Optional[str] = None

@api_router.get("/external/po/{po_number}", response_model=ExternalPOResponse)
async def get_po_external(po_number: str, _: bool = Depends(verify_external_api_key)):
    """
    External API to get PO details by PO number.
    
    Use this endpoint from other applications to fetch:
    - PO status and dates
    - School/contact details
    - Tracking link and dispatch info
    - Invoice amount and status
    - Logistics cost
    
    Authentication: Requires X-API-Key header
    """
    # Find PO by po_number
    po = await db.purchase_orders.find_one({"po_number": po_number.upper()}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase order '{po_number}' not found")
    
    # Get vendor details
    vendor = await db.vendors.find_one({"id": po["vendor_id"]}, {"_id": 0})
    vendor_name = vendor.get("name") if vendor else None
    
    # Get dispatch details
    dispatch = await db.dispatches.find_one({"po_id": po["id"]}, {"_id": 0})
    dispatch_info = None
    tracking_link = None
    if dispatch:
        dispatch_info = {
            "courier_partner": dispatch.get("courier_partner"),
            "tracking_id": dispatch.get("tracking_id"),
            "tracking_url": dispatch.get("tracking_url"),
            "dispatch_date": dispatch.get("dispatch_date"),
            "expected_delivery_date": dispatch.get("expected_delivery_date"),
            "proof_url": dispatch.get("proof_url"),
            "notes": dispatch.get("notes")
        }
        tracking_link = dispatch.get("tracking_url")
    
    # Get invoice details
    invoice = await db.invoices.find_one({"po_id": po["id"]}, {"_id": 0})
    invoice_info = None
    if invoice:
        invoice_info = {
            "invoice_number": invoice.get("invoice_number"),
            "invoice_date": invoice.get("invoice_date"),
            "invoice_amount": invoice.get("amount", 0),
            "logistics_cost": invoice.get("logistics_cost", 0),
            "total_amount": (invoice.get("amount", 0) + invoice.get("logistics_cost", 0)),
            "paid_amount": invoice.get("paid_amount", 0),
            "payment_status": invoice.get("payment_status", "pending"),
            "due_date": invoice.get("due_date"),
            "invoice_url": invoice.get("file_url") or invoice.get("invoice_url"),
            "logistics_bill_url": invoice.get("logistics_bill_url"),
            "delivery_proof_url": invoice.get("delivery_proof_url")
        }
    
    # Build public tracking URL
    app_base_url = os.environ.get('APP_BASE_URL', '')
    public_tracking_url = f"{app_base_url}/track/{po.get('tracking_token')}" if app_base_url and po.get('tracking_token') else None
    
    return ExternalPOResponse(
        po_id=po["id"],
        po_number=po["po_number"],
        status=po["status"],
        created_at=po["created_at"],
        updated_at=po["updated_at"],
        school_name=po.get("school_name"),
        delivery_address=po["delivery_address"],
        contact_person=po["contact_person"],
        contact_number=po["contact_number"],
        delivery_date=po.get("delivery_date"),
        vendor_id=po["vendor_id"],
        vendor_name=vendor_name,
        subtotal=po.get("subtotal", 0),
        total_discount=po.get("total_discount", 0),
        total_tax=po.get("total_tax", 0),
        grand_total=po.get("grand_total", 0),
        dispatch_info=dispatch_info,
        tracking_link=tracking_link,
        invoice_info=invoice_info,
        public_tracking_url=public_tracking_url,
        # File URLs
        po_pdf_url=f"{app_base_url}/api/purchase-orders/{po['id']}/pdf" if app_base_url else None,
        invoice_file_url=invoice.get("file_url") or invoice.get("invoice_url") if invoice else None,
        logistics_bill_url=invoice.get("logistics_bill_url") if invoice else None,
        delivery_proof_url=invoice.get("delivery_proof_url") if invoice else None
    )

@api_router.get("/external/po")
async def list_pos_external(
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    school_name: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    _: bool = Depends(verify_external_api_key)
):
    """
    External API to list POs with filters.
    
    Query Parameters:
    - status: Filter by PO status (sent, confirmed, dispatched, delivered, etc.)
    - vendor_id: Filter by vendor ID
    - school_name: Filter by school name (partial match)
    - from_date: Filter POs created on or after this date (YYYY-MM-DD)
    - to_date: Filter POs created on or before this date (YYYY-MM-DD)
    - limit: Maximum number of results (default: 50, max: 100)
    - offset: Pagination offset
    
    Authentication: Requires X-API-Key header
    """
    query = {}
    
    if status:
        query["status"] = status
    if vendor_id:
        query["vendor_id"] = vendor_id
    if school_name:
        query["school_name"] = {"$regex": school_name, "$options": "i"}
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = to_date + "T23:59:59"
        else:
            query["created_at"] = {"$lte": to_date + "T23:59:59"}
    
    # Enforce max limit
    limit = min(limit, 100)
    
    # Get total count
    total = await db.purchase_orders.count_documents(query)
    
    # Get POs
    pos = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Get vendor names
    vendor_ids = list(set(p["vendor_id"] for p in pos))
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(1000)
    vendor_map = {v["id"]: v["name"] for v in vendors}
    
    # Build response
    results = []
    for po in pos:
        results.append({
            "po_id": po["id"],
            "po_number": po["po_number"],
            "status": po["status"],
            "school_name": po.get("school_name"),
            "vendor_name": vendor_map.get(po["vendor_id"]),
            "grand_total": po.get("grand_total", 0),
            "delivery_date": po.get("delivery_date"),
            "created_at": po["created_at"],
            "contact_person": po["contact_person"],
            "contact_number": po["contact_number"]
        })
    
    return {
        "data": results,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total
        }
    }

@api_router.get("/external/po/{po_number}/line-items")
async def get_po_line_items_external(po_number: str, _: bool = Depends(verify_external_api_key)):
    """
    External API to get PO line items (products ordered).
    
    Returns detailed list of products with quantities and prices.
    
    Authentication: Requires X-API-Key header
    """
    po = await db.purchase_orders.find_one({"po_number": po_number.upper()}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase order '{po_number}' not found")
    
    return {
        "po_number": po["po_number"],
        "line_items": po.get("line_items", []),
        "subtotal": po.get("subtotal", 0),
        "total_discount": po.get("total_discount", 0),
        "total_tax": po.get("total_tax", 0),
        "grand_total": po.get("grand_total", 0)
    }

@api_router.get("/external/po/{po_number}/pdf")
async def get_po_pdf_external(po_number: str, _: bool = Depends(verify_external_api_key)):
    """
    External API to download PO as PDF.
    
    Authentication: Requires X-API-Key header
    """
    po = await db.purchase_orders.find_one({"po_number": po_number.upper()}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail=f"Purchase order '{po_number}' not found")
    
    vendor = await db.vendors.find_one({"id": po["vendor_id"]}, {"_id": 0})
    if not vendor:
        vendor = {"name": "Unknown Vendor", "address": "", "phone": "", "email": ""}
    
    # Generate PDF
    pdf_buffer = generate_po_pdf(po, vendor)
    
    # Return as downloadable file
    filename = f"PO-{po['po_number']}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

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
    
    # Create Distributor User
    distributor_user = {
        "id": str(uuid.uuid4()),
        "username": "distributor",
        "password": hash_password("distributor"),
        "email": "distributor@oll.com",
        "role": "distributor",
        "vendor_id": None,
        "name": "ABC School Distributor",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(distributor_user)
    
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
            "vendor2": "supreme/supreme",
            "distributor": "distributor/distributor"
        }
    }

# ========================
# EXTERNAL INTEGRATION ENDPOINTS
# ========================
# These endpoints are designed for external apps to integrate with this Vendor Management System

# Integration Models
class IntegrationLineItem(BaseModel):
    """Line item for integration PO creation"""
    product_name: str
    sku: Optional[str] = None
    quantity: int
    unit_price: float
    tax_rate: float = 18.0
    description: Optional[str] = None

class IntegrationPOCreate(BaseModel):
    """
    Model for external apps to raise a PO.
    Can include student/school/model data as metadata.
    """
    vendor_name: str  # Will be matched to existing vendor
    delivery_address: str
    receiver_name: str
    contact_person: str
    contact_number: str
    delivery_date: str  # Format: YYYY-MM-DD
    line_items: List[IntegrationLineItem]
    notes: Optional[str] = None
    # Metadata fields for external app data
    external_reference_id: Optional[str] = None  # Reference ID from calling app
    student_count: Optional[int] = None
    school_name: Optional[str] = None
    model_name: Optional[str] = None
    batch_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None  # Any additional custom data

class IntegrationPOResponse(BaseModel):
    """Response for integration PO creation"""
    success: bool
    po_id: str
    po_number: str
    tracking_token: str
    tracking_url: str
    status: str
    grand_total: float
    message: str

class BulkTrackingRequest(BaseModel):
    """Request model for getting multiple tracking links"""
    po_ids: Optional[List[str]] = None
    po_numbers: Optional[List[str]] = None
    external_reference_ids: Optional[List[str]] = None

class TrackingLinkResponse(BaseModel):
    """Response for tracking link"""
    po_id: str
    po_number: str
    tracking_token: str
    tracking_url: str
    status: str
    delivery_date: Optional[str]
    dispatch_info: Optional[Dict] = None

# API Key validation for integration endpoints
INTEGRATION_API_KEY = os.environ.get('INTEGRATION_API_KEY', 'oll-integration-key-2024')

async def verify_integration_api_key(x_api_key: str = Header(None, alias="X-API-Key")):
    """Verify API key for integration endpoints"""
    if not x_api_key or x_api_key != INTEGRATION_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return True

@api_router.post("/integration/raise-po", response_model=IntegrationPOResponse)
async def integration_raise_po(
    po_data: IntegrationPOCreate,
    api_key_valid: bool = Depends(verify_integration_api_key)
):
    """
    External Integration Endpoint: Raise a Purchase Order
    
    This endpoint allows external apps to create POs by providing:
    - Vendor name (will be matched to existing vendors)
    - Delivery details
    - Line items with product details
    - Optional metadata (student count, school name, model, etc.)
    
    Authentication: Requires X-API-Key header
    """
    # Find vendor by name (case-insensitive partial match)
    vendor = await db.vendors.find_one(
        {"name": {"$regex": po_data.vendor_name, "$options": "i"}},
        {"_id": 0}
    )
    if not vendor:
        raise HTTPException(
            status_code=404, 
            detail=f"Vendor '{po_data.vendor_name}' not found. Please check vendor name."
        )
    
    # Build line items - try to match products or create generic entries
    processed_line_items = []
    for item in po_data.line_items:
        # Try to find matching product
        product = None
        if item.sku:
            product = await db.products.find_one(
                {"sku": item.sku, "vendor_id": vendor["id"]},
                {"_id": 0}
            )
        if not product and item.product_name:
            product = await db.products.find_one(
                {"name": {"$regex": item.product_name, "$options": "i"}, "vendor_id": vendor["id"]},
                {"_id": 0}
            )
        
        processed_line_items.append({
            "product_id": product["id"] if product else str(uuid.uuid4()),
            "product_name": item.product_name,
            "sku": item.sku or (product["sku"] if product else f"EXT-{uuid.uuid4().hex[:8].upper()}"),
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "tax_rate": item.tax_rate,
            "discount_amount": 0.0,
            "discount_percent": 0.0,
            "comment": item.description
        })
    
    # Calculate totals
    subtotal = sum(item["quantity"] * item["unit_price"] for item in processed_line_items)
    total_tax = sum(
        item["quantity"] * item["unit_price"] * (item["tax_rate"] / 100) 
        for item in processed_line_items
    )
    grand_total = subtotal + total_tax
    
    # Build metadata/notes
    notes_parts = []
    if po_data.notes:
        notes_parts.append(po_data.notes)
    if po_data.external_reference_id:
        notes_parts.append(f"External Ref: {po_data.external_reference_id}")
    if po_data.student_count:
        notes_parts.append(f"Student Count: {po_data.student_count}")
    if po_data.school_name:
        notes_parts.append(f"School: {po_data.school_name}")
    if po_data.model_name:
        notes_parts.append(f"Model: {po_data.model_name}")
    if po_data.batch_id:
        notes_parts.append(f"Batch ID: {po_data.batch_id}")
    
    # Generate PO number
    count = await db.purchase_orders.count_documents({})
    po_number = f"PO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{count + 1:04d}"
    
    tracking_token = str(uuid.uuid4())
    
    # Create PO document
    po_doc = {
        "id": str(uuid.uuid4()),
        "po_number": po_number,
        "vendor_id": vendor["id"],
        "delivery_address": po_data.delivery_address,
        "receiver_name": po_data.receiver_name,
        "contact_person": po_data.contact_person,
        "contact_number": po_data.contact_number,
        "delivery_date": po_data.delivery_date,
        "line_items": processed_line_items,
        "order_discount_amount": 0.0,
        "order_discount_percent": 0.0,
        "notes": " | ".join(notes_parts) if notes_parts else None,
        "final_comments": None,
        "status": "sent",  # Directly send to vendor
        "tracking_token": tracking_token,
        "subtotal": subtotal,
        "total_discount": 0.0,
        "total_tax": total_tax,
        "grand_total": grand_total,
        "created_by": "integration_api",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        # Store integration metadata
        "integration_metadata": {
            "external_reference_id": po_data.external_reference_id,
            "student_count": po_data.student_count,
            "school_name": po_data.school_name,
            "model_name": po_data.model_name,
            "batch_id": po_data.batch_id,
            "custom_metadata": po_data.metadata,
            "source": "external_integration"
        }
    }
    
    await db.purchase_orders.insert_one(po_doc)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "CREATE_PO_VIA_INTEGRATION",
        "entity_type": "purchase_order",
        "entity_id": po_doc["id"],
        "user_id": "integration_api",
        "user_name": "External Integration",
        "details": {
            "po_number": po_number,
            "external_reference_id": po_data.external_reference_id,
            "vendor_name": vendor["name"]
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Build tracking URL (base URL from environment or default)
    base_url = os.environ.get('APP_BASE_URL', 'https://procureway.preview.emergentagent.com')
    tracking_url = f"{base_url}/track/{tracking_token}"
    
    return IntegrationPOResponse(
        success=True,
        po_id=po_doc["id"],
        po_number=po_number,
        tracking_token=tracking_token,
        tracking_url=tracking_url,
        status="sent",
        grand_total=grand_total,
        message=f"PO {po_number} created successfully and sent to vendor {vendor['name']}"
    )

@api_router.get("/integration/tracking/{identifier}")
async def integration_get_tracking(
    identifier: str,
    by: str = Query("po_id", description="Search by: po_id, po_number, tracking_token, or external_ref"),
    api_key_valid: bool = Depends(verify_integration_api_key)
):
    """
    External Integration Endpoint: Get Tracking Information
    
    Retrieve tracking link and status for a PO.
    
    Parameters:
    - identifier: The value to search for
    - by: Field to search by (po_id, po_number, tracking_token, external_ref)
    
    Authentication: Requires X-API-Key header
    """
    # Build query based on search field
    query = {}
    if by == "po_id":
        query["id"] = identifier
    elif by == "po_number":
        query["po_number"] = identifier
    elif by == "tracking_token":
        query["tracking_token"] = identifier
    elif by == "external_ref":
        query["integration_metadata.external_reference_id"] = identifier
    else:
        raise HTTPException(status_code=400, detail="Invalid 'by' parameter")
    
    po = await db.purchase_orders.find_one(query, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Get dispatch info if available
    dispatch = await db.dispatches.find_one({"po_id": po["id"]}, {"_id": 0})
    
    base_url = os.environ.get('APP_BASE_URL', 'https://procureway.preview.emergentagent.com')
    tracking_url = f"{base_url}/track/{po['tracking_token']}"
    
    return TrackingLinkResponse(
        po_id=po["id"],
        po_number=po["po_number"],
        tracking_token=po["tracking_token"],
        tracking_url=tracking_url,
        status=po["status"],
        delivery_date=po.get("delivery_date"),
        dispatch_info={
            "courier_partner": dispatch.get("courier_partner"),
            "tracking_id": dispatch.get("tracking_id"),
            "dispatch_date": dispatch.get("dispatch_date"),
            "expected_delivery_date": dispatch.get("expected_delivery_date")
        } if dispatch else None
    )

@api_router.post("/integration/tracking/bulk")
async def integration_get_bulk_tracking(
    request: BulkTrackingRequest,
    api_key_valid: bool = Depends(verify_integration_api_key)
):
    """
    External Integration Endpoint: Get Multiple Tracking Links
    
    Retrieve tracking information for multiple POs at once.
    
    Can search by:
    - po_ids: List of PO IDs
    - po_numbers: List of PO numbers
    - external_reference_ids: List of external reference IDs
    
    Authentication: Requires X-API-Key header
    """
    results = []
    errors = []
    
    base_url = os.environ.get('APP_BASE_URL', 'https://procureway.preview.emergentagent.com')
    
    # Search by PO IDs
    if request.po_ids:
        for po_id in request.po_ids:
            po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
            if po:
                dispatch = await db.dispatches.find_one({"po_id": po["id"]}, {"_id": 0})
                results.append({
                    "po_id": po["id"],
                    "po_number": po["po_number"],
                    "tracking_token": po["tracking_token"],
                    "tracking_url": f"{base_url}/track/{po['tracking_token']}",
                    "status": po["status"],
                    "delivery_date": po.get("delivery_date"),
                    "dispatch_info": {
                        "courier_partner": dispatch.get("courier_partner"),
                        "tracking_id": dispatch.get("tracking_id")
                    } if dispatch else None
                })
            else:
                errors.append({"identifier": po_id, "type": "po_id", "error": "Not found"})
    
    # Search by PO Numbers
    if request.po_numbers:
        for po_number in request.po_numbers:
            po = await db.purchase_orders.find_one({"po_number": po_number}, {"_id": 0})
            if po:
                dispatch = await db.dispatches.find_one({"po_id": po["id"]}, {"_id": 0})
                results.append({
                    "po_id": po["id"],
                    "po_number": po["po_number"],
                    "tracking_token": po["tracking_token"],
                    "tracking_url": f"{base_url}/track/{po['tracking_token']}",
                    "status": po["status"],
                    "delivery_date": po.get("delivery_date"),
                    "dispatch_info": {
                        "courier_partner": dispatch.get("courier_partner"),
                        "tracking_id": dispatch.get("tracking_id")
                    } if dispatch else None
                })
            else:
                errors.append({"identifier": po_number, "type": "po_number", "error": "Not found"})
    
    # Search by External Reference IDs
    if request.external_reference_ids:
        for ext_ref in request.external_reference_ids:
            po = await db.purchase_orders.find_one(
                {"integration_metadata.external_reference_id": ext_ref}, 
                {"_id": 0}
            )
            if po:
                dispatch = await db.dispatches.find_one({"po_id": po["id"]}, {"_id": 0})
                results.append({
                    "po_id": po["id"],
                    "po_number": po["po_number"],
                    "external_reference_id": ext_ref,
                    "tracking_token": po["tracking_token"],
                    "tracking_url": f"{base_url}/track/{po['tracking_token']}",
                    "status": po["status"],
                    "delivery_date": po.get("delivery_date"),
                    "dispatch_info": {
                        "courier_partner": dispatch.get("courier_partner"),
                        "tracking_id": dispatch.get("tracking_id")
                    } if dispatch else None
                })
            else:
                errors.append({"identifier": ext_ref, "type": "external_reference_id", "error": "Not found"})
    
    return {
        "success": True,
        "total_found": len(results),
        "total_errors": len(errors),
        "tracking_links": results,
        "errors": errors if errors else None
    }

@api_router.get("/integration/vendors")
async def integration_list_vendors(
    api_key_valid: bool = Depends(verify_integration_api_key)
):
    """
    External Integration Endpoint: List Available Vendors
    
    Returns a list of active vendors that can receive POs.
    Useful for external apps to validate vendor names before raising POs.
    
    Authentication: Requires X-API-Key header
    """
    vendors = await db.vendors.find({"is_active": True}, {"_id": 0}).to_list(100)
    return {
        "success": True,
        "vendors": [
            {
                "id": v["id"],
                "name": v["name"],
                "contact_person": v.get("contact_person"),
                "email": v.get("email"),
                "phone": v.get("phone")
            }
            for v in vendors
        ]
    }

@api_router.get("/integration/products")
async def integration_list_products(
    vendor_id: Optional[str] = None,
    vendor_name: Optional[str] = None,
    api_key_valid: bool = Depends(verify_integration_api_key)
):
    """
    External Integration Endpoint: List Available Products
    
    Returns a list of active products, optionally filtered by vendor.
    Useful for external apps to get product SKUs and prices.
    
    Authentication: Requires X-API-Key header
    """
    query = {"is_active": True}
    
    if vendor_id:
        query["vendor_id"] = vendor_id
    elif vendor_name:
        vendor = await db.vendors.find_one(
            {"name": {"$regex": vendor_name, "$options": "i"}},
            {"_id": 0}
        )
        if vendor:
            query["vendor_id"] = vendor["id"]
    
    products = await db.products.find(query, {"_id": 0}).to_list(500)
    
    # Get vendor names
    vendor_ids = list(set(p["vendor_id"] for p in products))
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}, {"_id": 0}).to_list(100)
    vendor_map = {v["id"]: v["name"] for v in vendors}
    
    return {
        "success": True,
        "products": [
            {
                "id": p["id"],
                "name": p["name"],
                "sku": p["sku"],
                "vendor_id": p["vendor_id"],
                "vendor_name": vendor_map.get(p["vendor_id"]),
                "unit_price": p["unit_price"],
                "tax_rate": p["tax_rate"],
                "unit": p.get("unit", "pcs"),
                "description": p.get("description")
            }
            for p in products
        ]
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
