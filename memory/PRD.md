# OLL Vendor Management System - PRD

## Original Problem Statement
Building a Vendor Management System for OLL organization. Phase 2 focuses on feature enhancements including physical file uploads for logistics/product invoices, Delivery Timeline and Inventory tabs in Analytics, External API for 3rd parties (analytics + issues), and various bug fixes.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor) — single `server.py` (5700+ lines, needs refactoring)
- **Frontend**: React + Tailwind CSS + Shadcn/UI — pages under `/app/frontend/src/pages/oll/`
- **File Storage**: Local `/app/backend/uploads/` served via `/api/files/` static mount
- **External APIs**: API Key auth via `X-API-Key` headers for 3rd party consumption

## Key Technical Notes
- Schools API URL: `_get_schools_url()` strips `www.` and appends `/active` — do NOT revert
- Timestamps: PO status changes must update `sent_at`, `confirmed_at`, `dispatched_at`, `delivered_at`
- Invoice data: `list-with-invoices` endpoint returns minimal data; full invoice data must be fetched from `/invoices?po_id=` separately

## What's Been Implemented

### Phase 1 (Previous sessions)
- Complete PO lifecycle (request → draft → sent → confirmed → dispatched → delivered → closed)
- Vendor management, Product catalog, School management
- Automated emails via Resend
- PDF generation for POs
- External Schools API integration
- Distributor role support
- Analytics page (basic)
- Issues & Returns management

### Phase 2 (Current session)
- Physical file upload for logistics & product invoices (`POST /api/upload`, static `/api/files/`)
- Delivery Timeline Tab in Analytics (time to confirm, dispatch, deliver, delay logic)
- Inventory Tab in Analytics
- External API: Analytics data endpoint
- Fixed Analytics calculation bug (On-time and Issue-free logic)
- Fixed Schools API production bug (stripped `www.`, appended `/active`)
- Added School Name to Issues PO dropdown
- Created 4 External API endpoints for Issues (Create, List, View, Reply)
- **Fixed P0 Bug**: Invoice details not visible in "Approve Delivery" popup
  - Root cause: `list-with-invoices` endpoint returned minimal invoice data (no amounts/URLs)
  - Fix: Approval Dialog now fetches fresh full invoice from `/invoices?po_id=` on open
  - Also fixed: Invoice Upload dialog and View Invoice dialog now fetch fresh data
  - Also fixed: Logistics Cost column in Delivered table now shows correct value

## Credentials
- Admin: `olladmin` / `olladmin`
- Distributor: `distributor1` / `distributor`

## 3rd Party Integrations
- Resend (Emails) — requires User API Key
- OLL Schools External API — requires User API Key

## Prioritized Backlog

### P1 - Upcoming
- Confirm with user: remove temporary "Delete Delivered PO" feature?
- Bulk import backend for past POs/invoices (UI exists, backend mocked)

### P2 - Future
- AuditLogs.js page + backend
- Downloadable reports feature
- Google Drive integration for file uploads
- Refactor `server.py` (5700+ lines) into modular routers

## Key API Endpoints
- `POST /api/upload`: File upload → returns public URL
- `GET /api/files/{filename}`: Static file server
- `GET /api/analytics/delivery-timeline`: Average timing metrics
- `GET /api/purchase-orders/list-with-invoices`: Paginated PO list with minimal invoice data
- `GET /api/invoices?po_id=`: Full invoice details for a PO
- `POST /api/purchase-orders/{po_id}/admin-upload-invoices`: Admin uploads invoices to delivered PO
- `POST /api/external/issues`: 3rd party raises issue against PO
- `GET /api/external/analytics`: External analytics data
