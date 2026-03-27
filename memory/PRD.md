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
  - **School Name field with search & auto-fill** ✅
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

### Phase 2.6 - School Search Integration (Completed - Feb 13, 2025)
- **School Search API Integration**:
  - External Schools API from skill-hub-59.preview.emergentagent.com
  - Search endpoint: GET /api/schools/search?q=searchterm
  - Results include: school_name, address, city, state, contact_name, contact_phone, contact_email
- **Auto-fill Functionality**:
  - Type 2+ characters to trigger search with 300ms debounce
  - Click school from dropdown to auto-fill fields
  - Auto-fills: school_name, delivery_address, contact_person, contact_number
  - Toast notification on successful selection
  - Manual entry still supported for custom school names

### Phase 2.7 - Enhanced Returns Feature (Completed - Feb 16, 2025) ✅
- **OLL Admin - Create Return Form**:
  - Select delivered POs with PO value display
  - **Mandatory return proof upload** (photo/document of returned items)
  - Item-level costing with original price from PO
  - Deduction amounts with reason fields
  - Real-time credit amount calculation (Total - Deductions)
  - Summary card showing total return value, deductions, and final credit amount
- **Returns Status Tracking**:
  - Status flow: `sent` → `confirmed` or `rejected`
  - OLL admin creates return (status: sent)
  - Vendor can confirm (with credit note upload) or reject (with reason)
- **Vendor Returns Management**:
  - View all return requests from OLL
  - Summary cards: Pending Review, Credit Notes Issued, Rejected
  - View return details with proof, items, deductions
  - **Confirm flow**: Upload credit note document, enter credit note number
  - **Reject flow**: Provide rejection reason
- **Credit Note Integration**:
  - Confirmed returns create negative payment entries (credits)
  - Credit notes appear in Credit Notes tab
  - Integration with Payments system

### Phase 2.8 - Public PO Request Feature (Completed - Mar 9, 2025) ✅
- **Public PO Request Form** (`/add`):
  - No login required for external users
  - Form fields: requester_name, school_name (with auto-search), delivery_address, contact_person, contact_number, delivery_date, products list, notes
  - School search integration with auto-fill
  - Product list with add/remove functionality
  - Upon submission, returns tracking_token for status tracking
- **Public Tracking Page** (`/track/:token`):
  - View order status timeline (Created → Sent → Confirmed → Dispatched → Delivered → Completed)
  - Shows order details: PO number, vendor (if assigned), delivery address, products
  - No authentication required
- **Admin Requests Tab** (Purchase Orders page):
  - New "Requests" tab shows pending external PO requests
  - Table columns: Request #, Requester, School, Products, Delivery Date, Vendor status
  - "Not Assigned" badge for requests without vendor
  - "Edit & Assign" button to open edit form
- **Admin Workflow**:
  - View incoming requests in Requests tab
  - Edit request: assign vendor, add product pricing/SKUs, update details
  - Approve request: changes status from "request" to "sent", notifies vendor
- **Backend Endpoints**:
  - `POST /api/public/po-request` - Create request without auth
  - `POST /api/purchase-orders/{id}/approve-request` - Approve and send to vendor

## Technical Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Main API server
- MongoDB database via MONGO_URL
- JWT authentication
- PDF generation with reportlab
- External API integration with httpx

### Frontend (React)
- `/app/frontend/src/` - React application
- Tailwind CSS + Shadcn/UI components
- Role-based routing

### Key API Endpoints
- `POST /api/purchase-orders` - Create PO with optional custom_po_number, school_name
- `POST /api/public/po-request` - **Public** - Create PO request without authentication
- `POST /api/purchase-orders/{id}/approve-request` - Approve request and send to vendor
- `GET /api/schools/search?q={query}&limit={limit}` - Search schools from external API
- `GET /api/schools/{school_id}` - Get single school details
- `GET /api/issues?po_id={id}` - Get issues for a PO
- `POST /api/issues/{id}/reply` - Add reply to issue
- `GET /api/track/{token}` - Public tracking
- **Returns API**:
  - `GET /api/returns` - List all returns (filtered by role)
  - `POST /api/returns` - Create return (OLL only, requires return_proof_url)
  - `POST /api/returns/{id}/confirm` - Vendor confirms with credit note
  - `POST /api/returns/{id}/reject` - Vendor rejects with reason
  - `DELETE /api/returns/{id}` - Delete return (OLL only)

## Database Schema Updates
- **PurchaseOrder**: Added `custom_po_number`, `school_name` fields
- **Issue**: Added `attachment_url`, `replies[]`, `created_by_name`, `created_by_role`
- **IssueReply**: `id`, `message`, `attachment_url`, `created_by`, `created_by_name`, `created_by_role`, `created_at`
- **Return** (Enhanced):
  - `return_number`, `po_id`, `vendor_id`
  - `items[]` - with `product_id`, `product_name`, `quantity`, `original_price`, `deduction_amount`, `deduction_reason`, `reason`
  - `total_value`, `total_deductions`, `credit_amount`
  - `status` - "sent", "confirmed", "rejected"
  - `return_proof_url` (mandatory)
  - `credit_note_number`, `credit_note_url`, `credit_note_date`
  - `rejection_reason`

## Environment Variables
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name
- `SCHOOLS_API_URL` - External Schools API URL
- `SCHOOLS_API_KEY` - External Schools API Key

## Test Credentials
- Admin: `olladmin` / `olladmin`
- Vendor: `vendor1` / `vendor1`
- Distributor: `distributor` / `distributor`

## Pending Tasks

### P0 - Critical
1. ~~Public PO Request Feature~~ - **COMPLETED Mar 9, 2025** ✅
2. Distributor Role Security Bugs - Needs security audit (Role-based access control for distributor)

### P1 - High Priority
1. ~~Verify PO PDF company details are correct~~ ✅ VERIFIED Mar 27, 2026
2. Bulk import for past POs and invoices (UI exists, backend mocked)
3. AuditLogs page implementation

### P2 - Medium Priority
1. Downloadable reports
2. ~~Email notifications (Resend integration)~~ ✅ DONE
3. Google Drive integration

## Known Issues
- Distributor role JWT handling needs security audit
- External Schools API may return empty address fields for some schools

## Changelog
- Mar 27, 2026: **Invoice & Logistics File Upload for Delivered POs** — Added real file upload (PDF/Image) via new `POST /api/upload` endpoint + `/api/files/` static serving. "Edit Invoice & Logistics" dialog now supports: Invoice Number, Invoice Date, Invoice Amount, Logistics Cost edits + file picker uploads for Product Invoice and Logistics Invoice. Also fixed missing `/api/upload` endpoint that was breaking Returns upload too.
- Mar 27, 2026: **Schools API Auth Fix** — Made `/api/schools/search` endpoint public (no auth). Public PO Request form now correctly shows school dropdown suggestions.
- Mar 27, 2026: **PO PDF Verified** — Confirmed PO PDF generates with correct: Clonefutura Live Solutions Pvt Ltd., address, Phone: +919699188188, GST No: 27AAKCC1113B1ZC.
- Mar 27, 2026: **Schools API Auth Fix** - Made `/api/schools/search` endpoint public (no auth required). The Public PO Request form is unauthenticated and was getting 401 errors when searching for schools. School dropdown now works correctly on the `/add` form.
- Mar 27, 2026: **PO PDF Verified** - Confirmed PO PDF generates with correct company details: Clonefutura Live Solutions Pvt Ltd., 103 1st floor - Kshitij building, Veera Desai Rd, Mumbai 400053, Phone: +919699188188, GST No: 27AAKCC1113B1ZC.
- Mar 11, 2025: **Email Notifications System** - Added comprehensive email notification system using Resend:
  - **Vendor Notifications**: PO raised, delivery reminders (6/4/2/0 days), PO approved/rejected, issues raised, payment received
  - **Admin Notifications**: PO confirmed by vendor, order dispatched, delivery pending approval, payment due reminders, issue resolved
  - Background cron scheduler for delivery and payment reminders (`notification_scheduler.py`)
  - Non-blocking async email sending (doesn't slow down the website)
  - Email templates with OLL branding
  - Endpoint `/api/email-status` to check configuration
  - To activate: Add `RESEND_API_KEY=re_xxxxx` to `/app/backend/.env`
- Mar 11, 2025: **Searchable Product Dropdowns** - Fixed and verified searchable product selection (combobox) on Admin PO Form, Distributor PO Form, and Public PO Request Form
- Mar 10, 2025: **City Column Added** - Added city field to PO creation form, PO tables (admin & vendor), and public PO request form. City auto-fills when school is selected.
- Mar 9, 2025: **External PO Request API** - Enhanced `/api/public/po-request` endpoint with full response including po_id, tracking_url, and source_system. Added `/api/public/po-status/{identifier}` for status checking by po_id or tracking_token.
- Mar 9, 2025: **Distributor Security Fix** - Fixed critical security vulnerabilities: distributors can now only see their own POs, invoices, payments, returns, and vendors they have POs with. Product pricing hidden for distributors.
- Mar 9, 2025: **Public PO Request Feature Improvements** - Added product dropdown from products API, school name made optional, vendor field now editable for request POs, auto-pricing fills when vendor is assigned, added "External PO Request" banner in edit form
- Mar 9, 2025: **Public PO Request Feature** - Added public form at /add for external users to request POs without login. Requests appear in admin's "Requests" tab. Admin can edit, assign vendor/pricing, and approve to convert to regular PO. Tracking page at /track/:token shows status. Fixed POResponse vendor_id to be optional.
- Feb 17, 2025: **Office Inventory Feature** - Added new inventory management section under Management for tracking office products with quantity, unit price, total value, categories, and locations
- Feb 17, 2025: **Fixed Payments Issues** - Fixed payments page error, added logistics cost display in record payment dialog, fixed invoice status update after payment
- Feb 17, 2025: **Fixed Returns Issues** - Added file upload endpoint, fixed GST calculation in credit amounts
- Feb 16, 2025: **Enhanced Returns Feature** - Complete overhaul with mandatory return proof upload, item-level costing from PO, deduction amounts with reasons, status tracking (sent/confirmed/rejected), vendor confirm/reject flow with credit note integration
- Feb 13, 2025: **School Search Integration** - Added external Schools API integration with search suggestions and auto-fill for PO form (school_name, contact_person, contact_number, delivery_address)
- Feb 12, 2025: Issues system with replies, Custom PO Number, Vendor UI improvements
- Feb 12, 2025: **Product Import feature fixed** - Bulk import via CSV/XLSX with vendor name mapping, SKU duplicate check, error handling
