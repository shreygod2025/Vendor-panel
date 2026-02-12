"""
Test suite for Issues feature enhancements:
1. PO Issues View - View all issues for a specific PO
2. Issue Attachments - Upload PNG/JPEG/PDF when creating an issue
3. Vendor Reply - Vendors can reply to issues
4. Admin can view vendor replies
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"username": "olladmin", "password": "olladmin"}
VENDOR_CREDS = {"username": "vendor1", "password": "vendor1"}


class TestIssuesFeatures:
    """Test suite for Issues feature enhancements"""
    
    admin_token = None
    vendor_token = None
    test_issue_id = None
    test_po_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for tests"""
        # Get admin token
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        TestIssuesFeatures.admin_token = response.json()["access_token"]
        
        # Get vendor token
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VENDOR_CREDS)
        assert response.status_code == 200, f"Vendor login failed: {response.text}"
        TestIssuesFeatures.vendor_token = response.json()["access_token"]
    
    def get_admin_headers(self):
        return {"Authorization": f"Bearer {TestIssuesFeatures.admin_token}", "Content-Type": "application/json"}
    
    def get_vendor_headers(self):
        return {"Authorization": f"Bearer {TestIssuesFeatures.vendor_token}", "Content-Type": "application/json"}
    
    # ==========================================
    # Test 1: Get all issues (Admin)
    # ==========================================
    def test_01_admin_get_all_issues(self):
        """Admin should be able to get all issues"""
        response = requests.get(f"{BASE_URL}/api/issues", headers=self.get_admin_headers())
        assert response.status_code == 200, f"Failed to get issues: {response.text}"
        issues = response.json()
        assert isinstance(issues, list), "Issues should be a list"
        print(f"✓ Admin can view all issues. Total issues: {len(issues)}")
        
        # Store an issue ID for later tests if available
        if issues:
            TestIssuesFeatures.test_issue_id = issues[0]["id"]
            TestIssuesFeatures.test_po_id = issues[0]["po_id"]
            print(f"  Found existing issue: {issues[0]['issue_number']}")
    
    # ==========================================
    # Test 2: Get issues filtered by PO ID
    # ==========================================
    def test_02_get_issues_by_po_id(self):
        """Should be able to filter issues by PO ID"""
        # First get a PO to test with
        response = requests.get(f"{BASE_URL}/api/purchase-orders", headers=self.get_admin_headers())
        assert response.status_code == 200, f"Failed to get POs: {response.text}"
        pos = response.json()
        
        if pos:
            po_id = pos[0]["id"]
            response = requests.get(f"{BASE_URL}/api/issues?po_id={po_id}", headers=self.get_admin_headers())
            assert response.status_code == 200, f"Failed to get issues by PO ID: {response.text}"
            issues = response.json()
            assert isinstance(issues, list), "Issues should be a list"
            print(f"✓ Can filter issues by PO ID. Found {len(issues)} issues for PO {pos[0]['po_number']}")
        else:
            print("⚠ No POs found to test filtering")
    
    # ==========================================
    # Test 3: Get single issue details
    # ==========================================
    def test_03_get_issue_details(self):
        """Should be able to get single issue with replies"""
        if not TestIssuesFeatures.test_issue_id:
            pytest.skip("No test issue available")
        
        response = requests.get(
            f"{BASE_URL}/api/issues/{TestIssuesFeatures.test_issue_id}", 
            headers=self.get_admin_headers()
        )
        assert response.status_code == 200, f"Failed to get issue details: {response.text}"
        issue = response.json()
        
        # Verify issue structure
        assert "id" in issue, "Issue should have id"
        assert "issue_number" in issue, "Issue should have issue_number"
        assert "description" in issue, "Issue should have description"
        assert "replies" in issue, "Issue should have replies field"
        assert "status" in issue, "Issue should have status"
        
        print(f"✓ Can get issue details. Issue: {issue['issue_number']}, Status: {issue['status']}")
        print(f"  Replies count: {len(issue.get('replies', []))}")
        
        # Check if attachment_url field exists
        if "attachment_url" in issue:
            print(f"  Has attachment: {'Yes' if issue['attachment_url'] else 'No'}")
    
    # ==========================================
    # Test 4: Create issue with attachment (base64)
    # ==========================================
    def test_04_create_issue_with_attachment(self):
        """Admin should be able to create issue with attachment"""
        # Get a PO to create issue for
        response = requests.get(f"{BASE_URL}/api/purchase-orders", headers=self.get_admin_headers())
        assert response.status_code == 200
        pos = response.json()
        
        if not pos:
            pytest.skip("No POs available to create issue")
        
        po = pos[0]
        
        # Create a small test image (1x1 red pixel PNG)
        test_image_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        
        issue_data = {
            "po_id": po["id"],
            "issue_type": "quality_issue",
            "description": "TEST_Issue with attachment - Quality check failed",
            "priority": "medium",
            "affected_items": [],
            "attachment_url": test_image_base64
        }
        
        response = requests.post(
            f"{BASE_URL}/api/issues",
            headers=self.get_admin_headers(),
            json=issue_data
        )
        assert response.status_code == 200, f"Failed to create issue: {response.text}"
        issue = response.json()
        
        assert issue["attachment_url"] == test_image_base64, "Attachment URL should be saved"
        assert issue["issue_type"] == "quality_issue"
        assert issue["status"] == "open"
        
        TestIssuesFeatures.test_issue_id = issue["id"]
        print(f"✓ Created issue with attachment: {issue['issue_number']}")
        print(f"  Attachment saved: {'Yes' if issue['attachment_url'] else 'No'}")
    
    # ==========================================
    # Test 5: Vendor can view issues
    # ==========================================
    def test_05_vendor_can_view_issues(self):
        """Vendor should be able to view issues raised against them"""
        response = requests.get(f"{BASE_URL}/api/issues", headers=self.get_vendor_headers())
        assert response.status_code == 200, f"Vendor failed to get issues: {response.text}"
        issues = response.json()
        assert isinstance(issues, list), "Issues should be a list"
        print(f"✓ Vendor can view issues. Total issues: {len(issues)}")
        
        # Store vendor's issue for reply test
        if issues:
            TestIssuesFeatures.test_issue_id = issues[0]["id"]
            print(f"  Vendor's issue: {issues[0]['issue_number']}")
    
    # ==========================================
    # Test 6: Vendor can reply to issue
    # ==========================================
    def test_06_vendor_can_reply_to_issue(self):
        """Vendor should be able to reply to an issue"""
        if not TestIssuesFeatures.test_issue_id:
            pytest.skip("No test issue available")
        
        reply_data = {
            "message": "TEST_REPLY: We are investigating this issue and will provide an update soon.",
            "attachment_url": None
        }
        
        response = requests.post(
            f"{BASE_URL}/api/issues/{TestIssuesFeatures.test_issue_id}/reply",
            headers=self.get_vendor_headers(),
            json=reply_data
        )
        assert response.status_code == 200, f"Vendor failed to reply: {response.text}"
        issue = response.json()
        
        # Verify reply was added
        assert "replies" in issue, "Issue should have replies"
        assert len(issue["replies"]) > 0, "Issue should have at least one reply"
        
        # Find our test reply
        test_reply = None
        for reply in issue["replies"]:
            if "TEST_REPLY" in reply.get("message", ""):
                test_reply = reply
                break
        
        assert test_reply is not None, "Test reply should be in replies"
        assert test_reply["created_by_role"] == "vendor", "Reply should be from vendor"
        
        print(f"✓ Vendor can reply to issue")
        print(f"  Reply added by: {test_reply.get('created_by_name', 'Unknown')} ({test_reply['created_by_role']})")
    
    # ==========================================
    # Test 7: Vendor can reply with attachment
    # ==========================================
    def test_07_vendor_reply_with_attachment(self):
        """Vendor should be able to reply with attachment"""
        if not TestIssuesFeatures.test_issue_id:
            pytest.skip("No test issue available")
        
        # Create a small test PDF-like base64 (just for testing the field)
        test_attachment = "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUj4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA2NiAwMDAwMCBuIAowMDAwMDAwMTIzIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA0L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMTk0CiUlRU9G"
        
        reply_data = {
            "message": "TEST_REPLY_ATTACH: Here is the supporting document.",
            "attachment_url": test_attachment
        }
        
        response = requests.post(
            f"{BASE_URL}/api/issues/{TestIssuesFeatures.test_issue_id}/reply",
            headers=self.get_vendor_headers(),
            json=reply_data
        )
        assert response.status_code == 200, f"Vendor failed to reply with attachment: {response.text}"
        issue = response.json()
        
        # Find our test reply with attachment
        test_reply = None
        for reply in issue["replies"]:
            if "TEST_REPLY_ATTACH" in reply.get("message", ""):
                test_reply = reply
                break
        
        assert test_reply is not None, "Test reply with attachment should be in replies"
        assert test_reply.get("attachment_url") is not None, "Reply should have attachment"
        
        print(f"✓ Vendor can reply with attachment")
        print(f"  Attachment in reply: {'Yes' if test_reply.get('attachment_url') else 'No'}")
    
    # ==========================================
    # Test 8: Admin can see vendor replies
    # ==========================================
    def test_08_admin_can_see_vendor_replies(self):
        """Admin should be able to see vendor replies"""
        if not TestIssuesFeatures.test_issue_id:
            pytest.skip("No test issue available")
        
        response = requests.get(
            f"{BASE_URL}/api/issues/{TestIssuesFeatures.test_issue_id}",
            headers=self.get_admin_headers()
        )
        assert response.status_code == 200, f"Admin failed to get issue: {response.text}"
        issue = response.json()
        
        # Check for vendor replies
        vendor_replies = [r for r in issue.get("replies", []) if r.get("created_by_role") == "vendor"]
        
        print(f"✓ Admin can see vendor replies")
        print(f"  Total replies: {len(issue.get('replies', []))}")
        print(f"  Vendor replies: {len(vendor_replies)}")
        
        for reply in vendor_replies:
            print(f"    - {reply.get('created_by_name', 'Unknown')}: {reply.get('message', '')[:50]}...")
    
    # ==========================================
    # Test 9: Admin can reply to issue
    # ==========================================
    def test_09_admin_can_reply_to_issue(self):
        """Admin should be able to reply to an issue"""
        if not TestIssuesFeatures.test_issue_id:
            pytest.skip("No test issue available")
        
        reply_data = {
            "message": "TEST_ADMIN_REPLY: Thank you for the update. Please proceed with the resolution.",
            "attachment_url": None
        }
        
        response = requests.post(
            f"{BASE_URL}/api/issues/{TestIssuesFeatures.test_issue_id}/reply",
            headers=self.get_admin_headers(),
            json=reply_data
        )
        assert response.status_code == 200, f"Admin failed to reply: {response.text}"
        issue = response.json()
        
        # Find admin reply
        admin_reply = None
        for reply in issue["replies"]:
            if "TEST_ADMIN_REPLY" in reply.get("message", ""):
                admin_reply = reply
                break
        
        assert admin_reply is not None, "Admin reply should be in replies"
        assert admin_reply["created_by_role"] == "oll", "Reply should be from OLL admin"
        
        print(f"✓ Admin can reply to issue")
        print(f"  Reply added by: {admin_reply.get('created_by_name', 'Unknown')} ({admin_reply['created_by_role']})")
    
    # ==========================================
    # Test 10: Issue status update
    # ==========================================
    def test_10_update_issue_status(self):
        """Admin should be able to update issue status"""
        if not TestIssuesFeatures.test_issue_id:
            pytest.skip("No test issue available")
        
        update_data = {
            "status": "in_progress"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/issues/{TestIssuesFeatures.test_issue_id}",
            headers=self.get_admin_headers(),
            json=update_data
        )
        assert response.status_code == 200, f"Failed to update issue: {response.text}"
        issue = response.json()
        
        assert issue["status"] == "in_progress", "Issue status should be updated"
        print(f"✓ Admin can update issue status to: {issue['status']}")
    
    # ==========================================
    # Test 11: Resolve issue with resolution
    # ==========================================
    def test_11_resolve_issue(self):
        """Admin should be able to resolve issue"""
        if not TestIssuesFeatures.test_issue_id:
            pytest.skip("No test issue available")
        
        update_data = {
            "status": "resolved",
            "resolution": "TEST_RESOLUTION: Issue has been resolved after vendor provided replacement."
        }
        
        response = requests.put(
            f"{BASE_URL}/api/issues/{TestIssuesFeatures.test_issue_id}",
            headers=self.get_admin_headers(),
            json=update_data
        )
        assert response.status_code == 200, f"Failed to resolve issue: {response.text}"
        issue = response.json()
        
        assert issue["status"] == "resolved", "Issue status should be resolved"
        assert issue["resolution"] is not None, "Issue should have resolution"
        
        print(f"✓ Admin can resolve issue")
        print(f"  Resolution: {issue['resolution'][:50]}...")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_issues(self):
        """Clean up test issues created during testing"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip("Cannot login for cleanup")
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Get all issues
        response = requests.get(f"{BASE_URL}/api/issues", headers=headers)
        if response.status_code == 200:
            issues = response.json()
            deleted_count = 0
            for issue in issues:
                # Delete test issues
                if "TEST_" in issue.get("description", "") or "TEST_" in (issue.get("resolution") or ""):
                    del_response = requests.delete(f"{BASE_URL}/api/issues/{issue['id']}", headers=headers)
                    if del_response.status_code == 200:
                        deleted_count += 1
            
            print(f"✓ Cleanup complete. Deleted {deleted_count} test issues.")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
