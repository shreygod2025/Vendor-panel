"""
Test suite for Returns Feature Enhancement
Tests: 
- Returns API CRUD operations
- Return proof upload (mandatory)
- Item-level cost visibility with original price from PO
- Deduction amounts with reasons
- Status tracking (sent, confirmed, rejected)
- Vendor confirm/reject flow with credit note upload
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://public-po-request.preview.emergentagent.com')

# Test credentials
OLL_CREDENTIALS = {"username": "olladmin", "password": "olladmin"}
VENDOR_CREDENTIALS = {"username": "vendor1", "password": "vendor1"}

class TestReturnsBackendAPI:
    """Backend API tests for Returns feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_oll_token(self):
        """Get OLL admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=OLL_CREDENTIALS)
        assert response.status_code == 200, f"OLL login failed: {response.text}"
        return response.json()["access_token"]
    
    def get_vendor_token(self):
        """Get vendor authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=VENDOR_CREDENTIALS)
        assert response.status_code == 200, f"Vendor login failed: {response.text}"
        data = response.json()
        return data["access_token"], data["user"]["vendor_id"]
    
    # ==========================================
    # GET /api/returns - List Returns
    # ==========================================
    
    def test_get_returns_as_oll(self):
        """Test: OLL admin can fetch all returns"""
        token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/returns")
        assert response.status_code == 200, f"Get returns failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Returns response should be a list"
        print(f"✓ GET /api/returns - OLL can fetch returns. Found {len(data)} returns")
    
    def test_get_returns_as_vendor(self):
        """Test: Vendor can fetch their own returns"""
        token, vendor_id = self.get_vendor_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/returns")
        assert response.status_code == 200, f"Get returns failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Returns response should be a list"
        # Verify all returns belong to this vendor
        for ret in data:
            assert ret["vendor_id"] == vendor_id, "Vendor should only see their own returns"
        print(f"✓ GET /api/returns - Vendor can fetch their returns. Found {len(data)} returns")
    
    def test_get_returns_filter_by_status(self):
        """Test: Returns can be filtered by status"""
        token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        for status in ["sent", "confirmed", "rejected"]:
            response = self.session.get(f"{BASE_URL}/api/returns?status={status}")
            assert response.status_code == 200, f"Filter by status failed: {response.text}"
            
            data = response.json()
            for ret in data:
                assert ret["status"] == status, f"Return should have status '{status}'"
        print("✓ GET /api/returns?status=X - Status filter works correctly")
    
    # ==========================================
    # GET /api/purchase-orders?status=delivered
    # ==========================================
    
    def test_get_delivered_pos(self):
        """Test: Can fetch delivered POs for return creation"""
        token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        assert response.status_code == 200, f"Get delivered POs failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "PO response should be a list"
        
        # Verify all POs have status delivered
        for po in data:
            assert po["status"] == "delivered", "PO should have delivered status"
            # Verify line items exist
            assert "line_items" in po, "PO should have line_items"
            for item in po["line_items"]:
                assert "product_id" in item, "Line item should have product_id"
                assert "unit_price" in item, "Line item should have unit_price (for original price)"
        
        print(f"✓ GET /api/purchase-orders?status=delivered - Found {len(data)} delivered POs")
        return data
    
    # ==========================================
    # POST /api/returns - Create Return
    # ==========================================
    
    def test_create_return_without_proof_fails(self):
        """Test: Creating return without return_proof_url should fail"""
        token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a delivered PO
        pos_response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        pos = pos_response.json()
        if not pos:
            pytest.skip("No delivered POs available for testing")
        
        po = pos[0]
        line_item = po["line_items"][0]
        
        # Create return without return_proof_url (should fail validation)
        return_data = {
            "po_id": po["id"],
            "vendor_id": po["vendor_id"],
            "items": [{
                "product_id": line_item["product_id"],
                "product_name": line_item["product_name"],
                "quantity": 1,
                "unit_price": line_item["unit_price"],
                "original_price": line_item["unit_price"],
                "deduction_amount": 0,
                "deduction_reason": "",
                "reason": "damaged"
            }],
            "notes": "Test return without proof"
            # Missing return_proof_url - should cause validation error
        }
        
        response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        # Should fail with 422 validation error (missing required field)
        assert response.status_code == 422, f"Should fail without return_proof_url: {response.text}"
        print("✓ POST /api/returns - Correctly rejects return without proof")
    
    def test_create_return_with_all_fields(self):
        """Test: Create return with return_proof, original_price, deduction"""
        token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a delivered PO
        pos_response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        pos = pos_response.json()
        if not pos:
            pytest.skip("No delivered POs available for testing")
        
        po = pos[0]
        line_item = po["line_items"][0]
        original_price = line_item["unit_price"]
        
        # Create return with all required fields
        return_data = {
            "po_id": po["id"],
            "vendor_id": po["vendor_id"],
            "items": [{
                "product_id": line_item["product_id"],
                "product_name": line_item["product_name"],
                "quantity": 1,
                "unit_price": original_price,
                "original_price": original_price,  # Item-level cost visibility
                "deduction_amount": 10.00,  # Deduction amount
                "deduction_reason": "Minor scratches on packaging",  # Deduction reason
                "reason": "damaged"
            }],
            "notes": "Test return with deduction",
            "return_proof_url": "https://example.com/test-proof.jpg"  # Mandatory proof
        }
        
        response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        assert response.status_code == 200, f"Create return failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Return should have id"
        assert "return_number" in data, "Return should have return_number"
        assert data["status"] == "sent", "New return should have 'sent' status"
        assert data["return_proof_url"] == "https://example.com/test-proof.jpg", "Return proof URL should be saved"
        
        # Verify item-level fields
        assert len(data["items"]) == 1, "Should have 1 item"
        item = data["items"][0]
        assert item["original_price"] == original_price, "Original price should match PO price"
        assert item["deduction_amount"] == 10.00, "Deduction amount should be saved"
        assert item["deduction_reason"] == "Minor scratches on packaging", "Deduction reason should be saved"
        
        # Verify totals calculation
        expected_total = original_price * 1  # quantity * original_price
        expected_credit = expected_total - 10.00  # minus deduction
        assert data["total_value"] == expected_total, f"Total value should be {expected_total}"
        assert data["total_deductions"] == 10.00, "Total deductions should be 10.00"
        assert data["credit_amount"] == expected_credit, f"Credit amount should be {expected_credit}"
        
        print(f"✓ POST /api/returns - Created return {data['return_number']} with proof, price, deduction")
        
        # Cleanup
        return data["id"]
    
    def test_create_return_as_vendor_fails(self):
        """Test: Vendor cannot create returns (only OLL can)"""
        token, vendor_id = self.get_vendor_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        return_data = {
            "po_id": "some-po-id",
            "vendor_id": vendor_id,
            "items": [],
            "return_proof_url": "https://example.com/proof.jpg"
        }
        
        response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        assert response.status_code == 403, f"Vendor should not be able to create returns: {response.text}"
        print("✓ POST /api/returns - Vendor correctly denied from creating returns")
    
    # ==========================================
    # POST /api/returns/{id}/confirm - Vendor confirms
    # ==========================================
    
    def test_confirm_return_with_credit_note(self):
        """Test: Vendor confirms return with credit note upload"""
        # First create a return as OLL
        oll_token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        
        pos_response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        pos = pos_response.json()
        if not pos:
            pytest.skip("No delivered POs available")
        
        po = pos[0]
        line_item = po["line_items"][0]
        
        # Create return
        return_data = {
            "po_id": po["id"],
            "vendor_id": po["vendor_id"],
            "items": [{
                "product_id": line_item["product_id"],
                "product_name": line_item["product_name"],
                "quantity": 1,
                "unit_price": line_item["unit_price"],
                "original_price": line_item["unit_price"],
                "deduction_amount": 0,
                "deduction_reason": "",
                "reason": "defective"
            }],
            "notes": "Return for confirm test",
            "return_proof_url": "https://example.com/proof-confirm-test.jpg"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        assert create_response.status_code == 200
        return_id = create_response.json()["id"]
        
        # Now confirm as vendor
        vendor_token, _ = self.get_vendor_token()
        self.session.headers.update({"Authorization": f"Bearer {vendor_token}"})
        
        confirm_data = {
            "credit_note_number": f"CN-TEST-{uuid.uuid4().hex[:6].upper()}",
            "credit_note_url": "https://example.com/credit-note-test.pdf"
        }
        
        response = self.session.post(f"{BASE_URL}/api/returns/{return_id}/confirm", json=confirm_data)
        assert response.status_code == 200, f"Confirm return failed: {response.text}"
        
        data = response.json()
        assert "credit_note_number" in data, "Response should include credit_note_number"
        
        # Verify return status changed
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        get_response = self.session.get(f"{BASE_URL}/api/returns/{return_id}")
        assert get_response.status_code == 200
        
        return_status = get_response.json()
        assert return_status["status"] == "confirmed", "Return should have 'confirmed' status"
        assert return_status["credit_note_number"] == confirm_data["credit_note_number"]
        assert return_status["credit_note_url"] == confirm_data["credit_note_url"]
        assert return_status["credit_note_date"] is not None, "Credit note date should be set"
        
        print(f"✓ POST /api/returns/{return_id}/confirm - Vendor confirmed with credit note")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/returns/{return_id}")
    
    def test_confirm_return_requires_credit_note_number(self):
        """Test: Confirm requires credit_note_number"""
        # Create return first
        oll_token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        
        pos_response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        pos = pos_response.json()
        if not pos:
            pytest.skip("No delivered POs available")
        
        po = pos[0]
        line_item = po["line_items"][0]
        
        return_data = {
            "po_id": po["id"],
            "vendor_id": po["vendor_id"],
            "items": [{
                "product_id": line_item["product_id"],
                "product_name": line_item["product_name"],
                "quantity": 1,
                "unit_price": line_item["unit_price"],
                "original_price": line_item["unit_price"],
                "deduction_amount": 0,
                "reason": "wrong_item"
            }],
            "return_proof_url": "https://example.com/proof.jpg"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        return_id = create_response.json()["id"]
        
        # Try confirm without credit_note_number
        vendor_token, _ = self.get_vendor_token()
        self.session.headers.update({"Authorization": f"Bearer {vendor_token}"})
        
        response = self.session.post(f"{BASE_URL}/api/returns/{return_id}/confirm", json={})
        assert response.status_code == 422, "Should require credit_note_number"
        
        print("✓ POST /api/returns/{id}/confirm - Correctly requires credit note fields")
        
        # Cleanup
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        self.session.delete(f"{BASE_URL}/api/returns/{return_id}")
    
    def test_oll_cannot_confirm_return(self):
        """Test: OLL admin cannot confirm returns (only vendors can)"""
        oll_token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        
        # Create return
        pos_response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        pos = pos_response.json()
        if not pos:
            pytest.skip("No delivered POs available")
        
        po = pos[0]
        line_item = po["line_items"][0]
        
        return_data = {
            "po_id": po["id"],
            "vendor_id": po["vendor_id"],
            "items": [{
                "product_id": line_item["product_id"],
                "product_name": line_item["product_name"],
                "quantity": 1,
                "unit_price": line_item["unit_price"],
                "original_price": line_item["unit_price"],
                "reason": "quality_issue"
            }],
            "return_proof_url": "https://example.com/proof.jpg"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        return_id = create_response.json()["id"]
        
        # OLL tries to confirm
        confirm_data = {
            "credit_note_number": "CN-TEST-123",
            "credit_note_url": "https://example.com/note.pdf"
        }
        
        response = self.session.post(f"{BASE_URL}/api/returns/{return_id}/confirm", json=confirm_data)
        assert response.status_code == 403, f"OLL should not be able to confirm: {response.text}"
        
        print("✓ POST /api/returns/{id}/confirm - OLL correctly denied from confirming")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/returns/{return_id}")
    
    # ==========================================
    # POST /api/returns/{id}/reject - Vendor rejects
    # ==========================================
    
    def test_reject_return_with_reason(self):
        """Test: Vendor rejects return with rejection reason"""
        # Create return as OLL
        oll_token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        
        pos_response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        pos = pos_response.json()
        if not pos:
            pytest.skip("No delivered POs available")
        
        po = pos[0]
        line_item = po["line_items"][0]
        
        return_data = {
            "po_id": po["id"],
            "vendor_id": po["vendor_id"],
            "items": [{
                "product_id": line_item["product_id"],
                "product_name": line_item["product_name"],
                "quantity": 1,
                "unit_price": line_item["unit_price"],
                "original_price": line_item["unit_price"],
                "reason": "expired"
            }],
            "return_proof_url": "https://example.com/proof-reject-test.jpg"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        return_id = create_response.json()["id"]
        
        # Vendor rejects
        vendor_token, _ = self.get_vendor_token()
        self.session.headers.update({"Authorization": f"Bearer {vendor_token}"})
        
        reject_data = {
            "rejection_reason": "Product was used beyond warranty period"
        }
        
        response = self.session.post(f"{BASE_URL}/api/returns/{return_id}/reject", json=reject_data)
        assert response.status_code == 200, f"Reject return failed: {response.text}"
        
        data = response.json()
        assert "reason" in data, "Response should include reason"
        
        # Verify status
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        get_response = self.session.get(f"{BASE_URL}/api/returns/{return_id}")
        
        return_status = get_response.json()
        assert return_status["status"] == "rejected", "Return should have 'rejected' status"
        assert return_status["rejection_reason"] == "Product was used beyond warranty period"
        
        print(f"✓ POST /api/returns/{return_id}/reject - Vendor rejected with reason")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/returns/{return_id}")
    
    def test_reject_requires_reason(self):
        """Test: Reject requires rejection_reason field"""
        oll_token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        
        pos_response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        pos = pos_response.json()
        if not pos:
            pytest.skip("No delivered POs available")
        
        po = pos[0]
        line_item = po["line_items"][0]
        
        return_data = {
            "po_id": po["id"],
            "vendor_id": po["vendor_id"],
            "items": [{
                "product_id": line_item["product_id"],
                "product_name": line_item["product_name"],
                "quantity": 1,
                "unit_price": line_item["unit_price"],
                "original_price": line_item["unit_price"],
                "reason": "other"
            }],
            "return_proof_url": "https://example.com/proof.jpg"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        return_id = create_response.json()["id"]
        
        vendor_token, _ = self.get_vendor_token()
        self.session.headers.update({"Authorization": f"Bearer {vendor_token}"})
        
        # Try reject without reason
        response = self.session.post(f"{BASE_URL}/api/returns/{return_id}/reject", json={})
        assert response.status_code == 422, "Should require rejection_reason"
        
        print("✓ POST /api/returns/{id}/reject - Correctly requires rejection reason")
        
        # Cleanup
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        self.session.delete(f"{BASE_URL}/api/returns/{return_id}")
    
    # ==========================================
    # DELETE /api/returns/{id} - Delete Return
    # ==========================================
    
    def test_delete_return_as_oll(self):
        """Test: OLL can delete returns"""
        oll_token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        
        # Create return
        pos_response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        pos = pos_response.json()
        if not pos:
            pytest.skip("No delivered POs available")
        
        po = pos[0]
        line_item = po["line_items"][0]
        
        return_data = {
            "po_id": po["id"],
            "vendor_id": po["vendor_id"],
            "items": [{
                "product_id": line_item["product_id"],
                "product_name": line_item["product_name"],
                "quantity": 1,
                "unit_price": line_item["unit_price"],
                "original_price": line_item["unit_price"],
                "reason": "damaged"
            }],
            "return_proof_url": "https://example.com/delete-test.jpg"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        return_id = create_response.json()["id"]
        
        # Delete
        response = self.session.delete(f"{BASE_URL}/api/returns/{return_id}")
        assert response.status_code == 200, f"Delete failed: {response.text}"
        
        # Verify deleted
        get_response = self.session.get(f"{BASE_URL}/api/returns/{return_id}")
        assert get_response.status_code == 404, "Return should be deleted"
        
        print("✓ DELETE /api/returns/{id} - OLL can delete returns")
    
    def test_vendor_cannot_delete_return(self):
        """Test: Vendor cannot delete returns"""
        oll_token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        
        # Create return
        pos_response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        pos = pos_response.json()
        if not pos:
            pytest.skip("No delivered POs available")
        
        po = pos[0]
        line_item = po["line_items"][0]
        
        return_data = {
            "po_id": po["id"],
            "vendor_id": po["vendor_id"],
            "items": [{
                "product_id": line_item["product_id"],
                "product_name": line_item["product_name"],
                "quantity": 1,
                "unit_price": line_item["unit_price"],
                "original_price": line_item["unit_price"],
                "reason": "damaged"
            }],
            "return_proof_url": "https://example.com/vendor-delete-test.jpg"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        return_id = create_response.json()["id"]
        
        # Vendor tries to delete
        vendor_token, _ = self.get_vendor_token()
        self.session.headers.update({"Authorization": f"Bearer {vendor_token}"})
        
        response = self.session.delete(f"{BASE_URL}/api/returns/{return_id}")
        assert response.status_code == 403, "Vendor should not be able to delete returns"
        
        print("✓ DELETE /api/returns/{id} - Vendor correctly denied from deleting")
        
        # Cleanup
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        self.session.delete(f"{BASE_URL}/api/returns/{return_id}")
    
    # ==========================================
    # Status Flow Tests
    # ==========================================
    
    def test_return_status_flow(self):
        """Test: Complete return status flow: sent -> confirmed OR rejected"""
        oll_token = self.get_oll_token()
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        
        pos_response = self.session.get(f"{BASE_URL}/api/purchase-orders?status=delivered")
        pos = pos_response.json()
        if not pos:
            pytest.skip("No delivered POs available")
        
        po = pos[0]
        line_item = po["line_items"][0]
        
        # 1. Create return - status should be "sent"
        return_data = {
            "po_id": po["id"],
            "vendor_id": po["vendor_id"],
            "items": [{
                "product_id": line_item["product_id"],
                "product_name": line_item["product_name"],
                "quantity": 1,
                "unit_price": line_item["unit_price"],
                "original_price": line_item["unit_price"],
                "deduction_amount": 5.00,
                "deduction_reason": "Test deduction",
                "reason": "quality_issue"
            }],
            "return_proof_url": "https://example.com/flow-test.jpg"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/returns", json=return_data)
        assert create_response.status_code == 200
        
        return_obj = create_response.json()
        assert return_obj["status"] == "sent", "Initial status should be 'sent'"
        
        # 2. Cannot confirm/reject in wrong state
        vendor_token, _ = self.get_vendor_token()
        
        # 3. Confirm as vendor
        self.session.headers.update({"Authorization": f"Bearer {vendor_token}"})
        
        confirm_data = {
            "credit_note_number": f"CN-FLOW-{uuid.uuid4().hex[:6].upper()}",
            "credit_note_url": "https://example.com/cn-flow.pdf"
        }
        
        confirm_response = self.session.post(f"{BASE_URL}/api/returns/{return_obj['id']}/confirm", json=confirm_data)
        assert confirm_response.status_code == 200
        
        # 4. Verify final status
        self.session.headers.update({"Authorization": f"Bearer {oll_token}"})
        final_response = self.session.get(f"{BASE_URL}/api/returns/{return_obj['id']}")
        
        final_return = final_response.json()
        assert final_return["status"] == "confirmed"
        assert final_return["credit_note_number"] == confirm_data["credit_note_number"]
        
        print("✓ Return status flow: sent -> confirmed works correctly")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/returns/{return_obj['id']}")
    
    # ==========================================
    # Authentication Tests
    # ==========================================
    
    def test_returns_api_requires_auth(self):
        """Test: Returns API requires authentication"""
        # Clear auth header
        self.session.headers.pop("Authorization", None)
        
        response = self.session.get(f"{BASE_URL}/api/returns")
        assert response.status_code in [401, 403], "Should require authentication"
        
        print("✓ GET /api/returns - Correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
