# OLL Vendor Management System - PRD

## Original Problem Statement
Build a Vendor Management System for OLL organization with the following capabilities:
- Vendor & Product Management
- Purchase Order (PO) Creation with custom PO numbers
- Vendor Actions (Confirm, Reject, Dispatch, Deliver)
- Delivery Tracking & Confirmation
- Invoicing & Returns
- Role-Based Views (Admin, Vendor, Distributor)
- Issues Management with Reply System

## User Personas
1. **OLL Administrator** - Full system access, manages vendors, products, POs, issues
2. **Vendor** - Views assigned POs, confirms/rejects, dispatches, marks delivered, replies to issues
3. **Distributor** - Limited access, creates POs, tracks own orders (no pricing visibility)

## Core Features Implemented

### Phase 1 - MVP (Completed)
- User authentication with JWT
- Vendor & Product CRUD
- Purchase Order creation, editing, status management
- Vendor actions: Confirm, Reject, Dispatch, Deliver
- Invoice management
- Returns/Credit Notes
- Role-based access control

### Phase 2 - Enhancements (Completed)
- Navbar/Sidebar reorganization
- Dashboard KPIs
- PO Management improvements:
  - Custom PO Number field with duplicate validation
  - Delivery date tracking
  - Line-item comments
  - PDF generation with company logo/signature
  - Re-raise rejected POs
- Delivery & Invoicing:
  - Proof upload for dispatch/delivery (mandatory for delivery)
  - Logistics bill upload
  - OLL admin delivery approval
- Vendor Reject Dialog with prefilled reasons
- Tracking URL field in dispatch
- Public tracking page improvements

### Phase 2.5 - Issues System (Completed - Feb 12, 2025)
- **Issues Management**:
  - Create issues with attachments (PNG/JPEG/PDF)
  - View all issues for a specific PO
  - Issue status tracking (Open, In Progress, Resolved)
  - Priority levels (Low, Medium, High, Critical)
- **Reply/Conversation System**:
  - Vendors can reply to issues raised by OLL
  - Replies visible to both parties
  - Attachment support in replies
  - Improved dialog with reply input at top (sticky)
- **UI Improvements**:
  - Clear "Reply" button for vendors
  - Collapsible issue details
  - Conversation history display

## Technical Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Main API server
- MongoDB database via MONGO_URL
- JWT authentication
- PDF generation with reportlab

### Frontend (React)
- `/app/frontend/src/` - React application
- Tailwind CSS + Shadcn/UI components
- Role-based routing

### Key API Endpoints
- `POST /api/purchase-orders` - Create PO with optional custom_po_number
- `GET /api/issues?po_id={id}` - Get issues for a PO
- `POST /api/issues/{id}/reply` - Add reply to issue
- `GET /api/track/{token}` - Public tracking

## Database Schema Updates
- **PurchaseOrder**: Added `custom_po_number` field
- **Issue**: Added `attachment_url`, `replies[]`, `created_by_name`, `created_by_role`
- **IssueReply**: `id`, `message`, `attachment_url`, `created_by`, `created_by_name`, `created_by_role`, `created_at`

## Test Credentials
- Admin: `olladmin` / `olladmin`
- Vendor: `vendor1` / `vendor1`
- Distributor: `distributor` / `distributor`

## Pending Tasks

### P0 - Critical (From Previous Session)
1. ~~Product Import Feature~~ - **FIXED** ✅
2. ~~Distributor Role Bugs~~ - Needs verification

### P1 - High Priority
1. Bulk import for past POs and invoices
2. AuditLogs page implementation

### P2 - Medium Priority
1. Downloadable reports
2. Email notifications (Resend integration)
3. Google Drive integration

## Known Issues
- Product import from XLSX/CSV not functional (backend endpoint missing)
- Distributor role JWT handling needs audit

## Changelog
- Feb 12, 2025: Issues system with replies, Custom PO Number, Vendor UI improvements
- Feb 12, 2025: **Product Import feature fixed** - Bulk import via CSV/XLSX with vendor name mapping, SKU duplicate check, error handling
