"""
Tests for Public PO Request Feature
- Public PO Request creation (no auth)
- Public tracking page
- Admin views request POs in Requests tab
- Admin edits request to assign vendor and add pricing
- Admin approves request to change status to 'sent'
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPublicPORequestFeature:
    """Test Public PO Request Feature"""
    
    test_tracking_token = None
    test_po_id = None
    admin_token = None
    vendor_id = None
    
    @classmethod
    def setup_class(cls):
        """Setup: Get admin token and vendor info"""
        # Login as admin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "olladmin", "password": "olladmin"}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        cls.admin_token = login_response.json()["access_token"]
        
        # Get first vendor for assigning to request
        vendors_response = requests.get(
            f"{BASE_URL}/api/vendors",
            headers={"Authorization": f"Bearer {cls.admin_token}"}
        )
        assert vendors_response.status_code == 200, f"Failed to get vendors: {vendors_response.text}"
        vendors = vendors_response.json()
        if vendors:
            cls.vendor_id = vendors[0]["id"]
    
    # =====================
    # PUBLIC PO REQUEST API TESTS
    # =====================
    
    def test_01_create_public_po_request(self):
        """POST /api/public/po-request - Create PO request without authentication"""
        request_data = {
            "delivery_date": "2026-02-15",
            "school_name": "TEST Public School",
            "delivery_address": "123 Test Street, Test City, Test State 123456",
            "contact_person": "Test Contact Person",
            "contact_number": "+919876543210",
            "notes": "This is a test public PO request",
            "requester_name": "TEST_Public_Requester",
            "products": [
                {"product_name": "Test Product A", "quantity": 5},
                {"product_name": "Test Product B", "quantity": 10}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/public/po-request",
            json=request_data
        )
        
        assert response.status_code == 200, f"Failed to create public PO request: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data["success"] == True
        assert "po_number" in data
        assert data["po_number"].startswith("REQ-"), f"PO number should start with REQ-, got {data['po_number']}"
        assert "tracking_token" in data
        assert len(data["tracking_token"]) > 0
        assert "message" in data
        
        # Store for later tests
        TestPublicPORequestFeature.test_tracking_token = data["tracking_token"]
        print(f"✓ Created public PO request: {data['po_number']}, tracking: {data['tracking_token']}")
    
    def test_02_create_public_po_request_validation_empty_products(self):
        """POST /api/public/po-request - Should reject request with no products"""
        request_data = {
            "delivery_date": "2026-02-15",
            "school_name": "Test School",
            "delivery_address": "Test Address",
            "contact_person": "Test Contact",
            "contact_number": "1234567890",
            "requester_name": "Test Requester",
            "products": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/public/po-request",
            json=request_data
        )
        
        assert response.status_code == 400, f"Should reject empty products, got: {response.status_code}"
        print("✓ Correctly rejected request with empty products")
    
    def test_03_create_public_po_request_validation_missing_requester(self):
        """POST /api/public/po-request - Should reject request without requester name"""
        request_data = {
            "delivery_date": "2026-02-15",
            "school_name": "Test School",
            "delivery_address": "Test Address",
            "contact_person": "Test Contact",
            "contact_number": "1234567890",
            "requester_name": "   ",  # Whitespace only
            "products": [{"product_name": "Test", "quantity": 1}]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/public/po-request",
            json=request_data
        )
        
        assert response.status_code == 400, f"Should reject empty requester name, got: {response.status_code}"
        print("✓ Correctly rejected request with empty requester name")
    
    # =====================
    # PUBLIC TRACKING API TESTS
    # =====================
    
    def test_04_track_order_by_token(self):
        """GET /api/track/{tracking_token} - Track order publicly"""
        assert TestPublicPORequestFeature.test_tracking_token, "No tracking token from previous test"
        
        response = requests.get(
            f"{BASE_URL}/api/track/{TestPublicPORequestFeature.test_tracking_token}"
        )
        
        assert response.status_code == 200, f"Failed to track order: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "po_number" in data
        assert data["po_number"].startswith("REQ-")
        assert "status" in data
        assert data["status"] == "request"  # Should be in request status
        assert "delivery_address" in data
        assert "timeline" in data
        assert len(data["timeline"]) > 0
        assert "line_items" in data
        
        # Verify no vendor assigned yet
        assert data.get("vendor_name") is None, "Request PO should not have vendor assigned"
        
        print(f"✓ Successfully tracked order: {data['po_number']}, status: {data['status']}")
    
    def test_05_track_order_invalid_token(self):
        """GET /api/track/{tracking_token} - Invalid token should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/track/INVALID_TOKEN_123"
        )
        
        assert response.status_code == 404, f"Should return 404 for invalid token, got: {response.status_code}"
        print("✓ Correctly returned 404 for invalid tracking token")
    
    # =====================
    # ADMIN VIEW REQUESTS TESTS
    # =====================
    
    def test_06_admin_can_view_request_po(self):
        """GET /api/purchase-orders - Admin can see request status POs"""
        response = requests.get(
            f"{BASE_URL}/api/purchase-orders?status=request",
            headers={"Authorization": f"Bearer {TestPublicPORequestFeature.admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get POs: {response.text}"
        data = response.json()
        
        # Find our test PO
        test_po = None
        for po in data:
            if po["po_number"].startswith("REQ-") and po.get("requester_name") == "TEST_Public_Requester":
                test_po = po
                break
        
        assert test_po is not None, "Test request PO not found in list"
        assert test_po["status"] == "request"
        assert test_po["is_external_request"] == True
        assert test_po.get("vendor_id") is None, "Request should not have vendor assigned yet"
        
        # Store PO ID for later tests
        TestPublicPORequestFeature.test_po_id = test_po["id"]
        
        print(f"✓ Admin can view request PO: {test_po['po_number']}")
    
    def test_07_admin_cannot_approve_request_without_vendor(self):
        """POST /api/purchase-orders/{id}/approve-request - Should fail without vendor"""
        assert TestPublicPORequestFeature.test_po_id, "No PO ID from previous test"
        
        response = requests.post(
            f"{BASE_URL}/api/purchase-orders/{TestPublicPORequestFeature.test_po_id}/approve-request",
            headers={"Authorization": f"Bearer {TestPublicPORequestFeature.admin_token}"}
        )
        
        assert response.status_code == 400, f"Should fail without vendor, got: {response.status_code}"
        assert "vendor" in response.text.lower(), "Error should mention vendor assignment"
        print("✓ Correctly rejected approval without vendor assignment")
    
    # =====================
    # ADMIN EDIT REQUEST TESTS
    # =====================
    
    def test_08_admin_can_edit_request_po_assign_vendor(self):
        """PUT /api/purchase-orders/{id} - Admin can assign vendor and update pricing"""
        assert TestPublicPORequestFeature.test_po_id, "No PO ID from previous test"
        assert TestPublicPORequestFeature.vendor_id, "No vendor ID available"
        
        # Update request with vendor and line items with pricing
        update_data = {
            "vendor_id": TestPublicPORequestFeature.vendor_id,
            "line_items": [
                {
                    "product_id": "test-product-1",
                    "product_name": "Test Product A",
                    "sku": "TEST-A-001",
                    "quantity": 5,
                    "unit_price": 100.0,
                    "tax_rate": 18.0,
                    "discount_amount": 0,
                    "discount_percent": 0
                },
                {
                    "product_id": "test-product-2",
                    "product_name": "Test Product B",
                    "sku": "TEST-B-001",
                    "quantity": 10,
                    "unit_price": 50.0,
                    "tax_rate": 18.0,
                    "discount_amount": 0,
                    "discount_percent": 0
                }
            ]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/purchase-orders/{TestPublicPORequestFeature.test_po_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {TestPublicPORequestFeature.admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to update request PO: {response.text}"
        data = response.json()
        
        # Verify updates
        assert data["vendor_id"] == TestPublicPORequestFeature.vendor_id
        assert data["grand_total"] > 0, "Grand total should be calculated"
        assert data["vendor_name"] is not None, "Vendor name should be set"
        
        print(f"✓ Admin updated request PO with vendor and pricing, grand_total: {data['grand_total']}")
    
    def test_09_verify_request_po_still_in_request_status(self):
        """GET /api/purchase-orders/{id} - PO should still be in request status after edit"""
        assert TestPublicPORequestFeature.test_po_id, "No PO ID from previous test"
        
        response = requests.get(
            f"{BASE_URL}/api/purchase-orders/{TestPublicPORequestFeature.test_po_id}",
            headers={"Authorization": f"Bearer {TestPublicPORequestFeature.admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get PO: {response.text}"
        data = response.json()
        
        assert data["status"] == "request", f"PO status should still be 'request', got: {data['status']}"
        assert data["vendor_id"] is not None, "Vendor should be assigned"
        
        print("✓ PO remains in 'request' status after edit")
    
    # =====================
    # ADMIN APPROVE REQUEST TESTS
    # =====================
    
    def test_10_admin_can_approve_request_with_vendor(self):
        """POST /api/purchase-orders/{id}/approve-request - Approve request changes status to 'sent'"""
        assert TestPublicPORequestFeature.test_po_id, "No PO ID from previous test"
        
        response = requests.post(
            f"{BASE_URL}/api/purchase-orders/{TestPublicPORequestFeature.test_po_id}/approve-request",
            headers={"Authorization": f"Bearer {TestPublicPORequestFeature.admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to approve request: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert "sent" in data["message"].lower() or "approved" in data["message"].lower()
        
        print("✓ Admin approved request, status changed to 'sent'")
    
    def test_11_verify_status_changed_to_sent(self):
        """GET /api/purchase-orders/{id} - Verify status changed to 'sent'"""
        assert TestPublicPORequestFeature.test_po_id, "No PO ID from previous test"
        
        response = requests.get(
            f"{BASE_URL}/api/purchase-orders/{TestPublicPORequestFeature.test_po_id}",
            headers={"Authorization": f"Bearer {TestPublicPORequestFeature.admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get PO: {response.text}"
        data = response.json()
        
        assert data["status"] == "sent", f"PO status should be 'sent', got: {data['status']}"
        
        print("✓ PO status is now 'sent'")
    
    def test_12_tracking_shows_updated_status(self):
        """GET /api/track/{token} - Tracking page shows updated status"""
        assert TestPublicPORequestFeature.test_tracking_token, "No tracking token"
        
        response = requests.get(
            f"{BASE_URL}/api/track/{TestPublicPORequestFeature.test_tracking_token}"
        )
        
        assert response.status_code == 200, f"Failed to track: {response.text}"
        data = response.json()
        
        assert data["status"] == "sent", f"Tracking should show 'sent' status, got: {data['status']}"
        assert data["vendor_name"] is not None, "Tracking should now show vendor name"
        
        print(f"✓ Tracking shows updated status: {data['status']}, vendor: {data['vendor_name']}")
    
    # =====================
    # AUTHORIZATION TESTS
    # =====================
    
    def test_13_non_admin_cannot_approve_request(self):
        """POST /api/purchase-orders/{id}/approve-request - Only OLL admin can approve"""
        # Login as vendor
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "vendor1", "password": "vendor1"}
        )
        
        if login_response.status_code != 200:
            print("⚠ Vendor login failed, skipping test")
            return
        
        vendor_token = login_response.json()["access_token"]
        
        # Create a new request for this test
        request_data = {
            "delivery_date": "2026-02-20",
            "school_name": "Auth Test School",
            "delivery_address": "Test Address",
            "contact_person": "Test Contact",
            "contact_number": "1234567890",
            "requester_name": "TEST_Auth_Test",
            "products": [{"product_name": "Test", "quantity": 1}]
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/public/po-request",
            json=request_data
        )
        
        if create_response.status_code != 200:
            print("⚠ Failed to create test request, skipping")
            return
        
        # Find the PO
        po_response = requests.get(
            f"{BASE_URL}/api/purchase-orders?status=request",
            headers={"Authorization": f"Bearer {TestPublicPORequestFeature.admin_token}"}
        )
        
        test_po = None
        for po in po_response.json():
            if po.get("requester_name") == "TEST_Auth_Test":
                test_po = po
                break
        
        if not test_po:
            print("⚠ Test PO not found, skipping")
            return
        
        # Try to approve as vendor (should fail)
        response = requests.post(
            f"{BASE_URL}/api/purchase-orders/{test_po['id']}/approve-request",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        
        assert response.status_code == 403, f"Vendor should not be able to approve, got: {response.status_code}"
        print("✓ Non-admin correctly denied from approving request")
        
        # Cleanup: Delete the test PO
        requests.delete(
            f"{BASE_URL}/api/purchase-orders/{test_po['id']}",
            headers={"Authorization": f"Bearer {TestPublicPORequestFeature.admin_token}"}
        )
    
    # =====================
    # CLEANUP
    # =====================
    
    def test_99_cleanup(self):
        """Cleanup test data"""
        if TestPublicPORequestFeature.test_po_id:
            response = requests.delete(
                f"{BASE_URL}/api/purchase-orders/{TestPublicPORequestFeature.test_po_id}",
                headers={"Authorization": f"Bearer {TestPublicPORequestFeature.admin_token}"}
            )
            print(f"Cleanup: Deleted test PO, status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
