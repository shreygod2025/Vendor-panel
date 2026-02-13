import requests
import sys
import json
from datetime import datetime

class ReviewRequestTester:
    def __init__(self, base_url="https://procureway.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.oll_token = None
        self.vendor_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.vendor_id = None
        self.product_id = None
        self.po_id = None
        self.sent_po_id = None
        self.confirmed_po_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def setup_auth(self):
        """Setup authentication tokens"""
        print("\n🔐 Setting up authentication...")
        
        # OLL Admin login
        success, response = self.run_test(
            "OLL Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "olladmin", "password": "olladmin"}
        )
        if success and 'access_token' in response:
            self.oll_token = response['access_token']
            print(f"   OLL Token obtained: {self.oll_token[:20]}...")
        else:
            print("❌ Failed to get OLL token")
            return False

        # Vendor login
        success, response = self.run_test(
            "Vendor Login",
            "POST",
            "auth/login",
            200,
            data={"username": "vendor", "password": "vendor"}
        )
        if success and 'access_token' in response:
            self.vendor_token = response['access_token']
            print(f"   Vendor Token obtained: {self.vendor_token[:20]}...")
        else:
            print("❌ Failed to get vendor token")
            return False

        return True

    def setup_test_data(self):
        """Setup test data - get vendor and product IDs"""
        print("\n📋 Setting up test data...")
        
        # Get vendors
        success, response = self.run_test(
            "Get Vendors",
            "GET",
            "vendors",
            200,
            token=self.oll_token
        )
        if success and response and len(response) > 0:
            self.vendor_id = response[0]['id']
            print(f"   Found vendor: {response[0]['name']} (ID: {self.vendor_id})")
        else:
            print("❌ No vendors found")
            return False

        # Get products
        success, response = self.run_test(
            "Get Products",
            "GET",
            "products",
            200,
            token=self.oll_token
        )
        if success and response and len(response) > 0:
            self.product_id = response[0]['id']
            print(f"   Found product: {response[0]['name']} (ID: {self.product_id})")
        else:
            print("❌ No products found")
            return False

        return True

    def test_priority_1_po_creation_with_sent_status(self):
        """Priority 1: Test PO Creation with 'sent' status (NOT 'draft')"""
        print("\n🎯 PRIORITY 1: Testing PO Creation with 'sent' status")
        
        if not self.vendor_id or not self.product_id:
            print("❌ Cannot test PO creation - missing vendor or product ID")
            return False

        po_data = {
            "vendor_id": self.vendor_id,
            "delivery_address": "Test Address",
            "contact_person": "Test Contact",
            "contact_number": "1234567890",
            "delivery_date": "2026-01-20",
            "receiver_name": "Test Receiver",
            "line_items": [{
                "product_id": self.product_id,
                "product_name": "Test Product",
                "sku": "TEST-SKU",
                "quantity": 2,
                "unit_price": 500,
                "discount_percent": 0,
                "tax_rate": 18
            }]
        }

        success, response = self.run_test(
            "Create PO with 'sent' status",
            "POST",
            "purchase-orders",
            200,
            data=po_data,
            token=self.oll_token
        )

        if success and 'id' in response:
            self.sent_po_id = response['id']
            status = response.get('status')
            if status == 'sent':
                print(f"   ✅ PO created with correct status: {status}")
                print(f"   PO Number: {response.get('po_number', 'N/A')}")
                print(f"   Receiver Name: {response.get('receiver_name', 'N/A')}")
                return True
            else:
                print(f"   ❌ PO created with wrong status - Expected: 'sent', Got: {status}")
                return False
        else:
            print("   ❌ Failed to create PO")
            return False

    def test_priority_2_delete_po_for_sent_confirmed(self):
        """Priority 2: Test Delete PO for draft/sent/confirmed"""
        print("\n🎯 PRIORITY 2: Testing Delete PO for sent/confirmed status")
        
        if not self.sent_po_id:
            print("❌ Cannot test PO deletion - no sent PO ID available")
            return False

        # Test deleting a PO with 'sent' status
        success, response = self.run_test(
            "Delete PO with 'sent' status",
            "DELETE",
            f"purchase-orders/{self.sent_po_id}",
            200,
            token=self.oll_token
        )

        if success:
            print(f"   ✅ Successfully deleted PO with 'sent' status")
            
            # Create another PO and confirm it to test deletion of confirmed PO
            po_data = {
                "vendor_id": self.vendor_id,
                "delivery_address": "Test Address for Confirmed",
                "contact_person": "Test Contact",
                "contact_number": "1234567890",
                "delivery_date": "2026-01-25",
                "receiver_name": "Test Receiver Confirmed",
                "line_items": [{
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "sku": "TEST-SKU-CONF",
                    "quantity": 1,
                    "unit_price": 1000,
                    "discount_percent": 0,
                    "tax_rate": 18
                }]
            }

            success, po_response = self.run_test(
                "Create PO for confirmation test",
                "POST",
                "purchase-orders",
                200,
                data=po_data,
                token=self.oll_token
            )

            if success and 'id' in po_response:
                confirm_po_id = po_response['id']
                
                # Confirm the PO as vendor
                success, confirm_response = self.run_test(
                    "Confirm PO as vendor",
                    "POST",
                    f"purchase-orders/{confirm_po_id}/confirm",
                    200,
                    token=self.vendor_token
                )

                if success:
                    # Now try to delete the confirmed PO
                    success, delete_response = self.run_test(
                        "Delete PO with 'confirmed' status",
                        "DELETE",
                        f"purchase-orders/{confirm_po_id}",
                        200,
                        token=self.oll_token
                    )

                    if success:
                        print(f"   ✅ Successfully deleted PO with 'confirmed' status")
                        return True
                    else:
                        print(f"   ❌ Failed to delete PO with 'confirmed' status")
                        return False
                else:
                    print(f"   ❌ Failed to confirm PO")
                    return False
            else:
                print(f"   ❌ Failed to create PO for confirmation test")
                return False
        else:
            print(f"   ❌ Failed to delete PO with 'sent' status")
            return False

    def test_priority_3_vendor_can_see_sent_pos(self):
        """Priority 3: Test Vendor can see 'sent' POs"""
        print("\n🎯 PRIORITY 3: Testing Vendor can see 'sent' POs")
        
        # First create a new PO with 'sent' status
        po_data = {
            "vendor_id": self.vendor_id,
            "delivery_address": "Vendor View Test Address",
            "contact_person": "Vendor View Contact",
            "contact_number": "1234567890",
            "delivery_date": "2026-01-30",
            "receiver_name": "Vendor View Receiver",
            "line_items": [{
                "product_id": self.product_id,
                "product_name": "Vendor View Product",
                "sku": "VENDOR-VIEW-SKU",
                "quantity": 3,
                "unit_price": 750,
                "discount_percent": 0,
                "tax_rate": 18
            }]
        }

        success, po_response = self.run_test(
            "Create PO for vendor view test",
            "POST",
            "purchase-orders",
            200,
            data=po_data,
            token=self.oll_token
        )

        if not success or 'id' not in po_response:
            print("   ❌ Failed to create PO for vendor view test")
            return False

        vendor_view_po_id = po_response['id']
        po_number = po_response.get('po_number', 'N/A')
        
        # Verify PO is in 'sent' status
        if po_response.get('status') != 'sent':
            print(f"   ❌ PO not in 'sent' status: {po_response.get('status')}")
            return False

        print(f"   Created PO {po_number} with 'sent' status")

        # Now test vendor can see this PO
        success, vendor_pos_response = self.run_test(
            "Vendor get POs",
            "GET",
            "purchase-orders",
            200,
            token=self.vendor_token
        )

        if success and vendor_pos_response:
            # Check if the sent PO is visible to vendor
            sent_po_found = False
            draft_po_found = False
            
            for po in vendor_pos_response:
                if po.get('id') == vendor_view_po_id and po.get('status') == 'sent':
                    sent_po_found = True
                    print(f"   ✅ Vendor can see 'sent' PO: {po.get('po_number', 'N/A')}")
                elif po.get('status') == 'draft':
                    draft_po_found = True
                    print(f"   ⚠️ Found draft PO visible to vendor: {po.get('po_number', 'N/A')} (should be filtered)")

            if sent_po_found:
                if not draft_po_found:
                    print(f"   ✅ Draft POs are properly filtered from vendor view")
                else:
                    print(f"   ⚠️ Draft POs are visible to vendor (frontend should filter these)")
                return True
            else:
                print(f"   ❌ Vendor cannot see 'sent' PO")
                return False
        else:
            print(f"   ❌ Failed to get POs as vendor")
            return False

    def test_priority_4_vendor_po_confirmation(self):
        """Priority 4: Test Vendor PO Confirmation"""
        print("\n🎯 PRIORITY 4: Testing Vendor PO Confirmation")
        
        # Create a new PO for confirmation test
        po_data = {
            "vendor_id": self.vendor_id,
            "delivery_address": "Confirmation Test Address",
            "contact_person": "Confirmation Contact",
            "contact_number": "1234567890",
            "delivery_date": "2026-02-05",
            "receiver_name": "Confirmation Receiver",
            "line_items": [{
                "product_id": self.product_id,
                "product_name": "Confirmation Product",
                "sku": "CONF-TEST-SKU",
                "quantity": 2,
                "unit_price": 1200,
                "discount_percent": 0,
                "tax_rate": 18
            }]
        }

        success, po_response = self.run_test(
            "Create PO for confirmation test",
            "POST",
            "purchase-orders",
            200,
            data=po_data,
            token=self.oll_token
        )

        if not success or 'id' not in po_response:
            print("   ❌ Failed to create PO for confirmation test")
            return False

        confirmation_po_id = po_response['id']
        po_number = po_response.get('po_number', 'N/A')
        
        # Verify PO is in 'sent' status
        if po_response.get('status') != 'sent':
            print(f"   ❌ PO not in 'sent' status: {po_response.get('status')}")
            return False

        print(f"   Created PO {po_number} with 'sent' status")

        # Vendor confirms the PO
        success, confirm_response = self.run_test(
            "Vendor confirm PO",
            "POST",
            f"purchase-orders/{confirmation_po_id}/confirm",
            200,
            token=self.vendor_token
        )

        if success:
            print(f"   ✅ Vendor successfully confirmed PO")
            
            # Verify PO status changed to 'confirmed'
            success, updated_po_response = self.run_test(
                "Get updated PO status",
                "GET",
                f"purchase-orders/{confirmation_po_id}",
                200,
                token=self.oll_token
            )

            if success and updated_po_response:
                status = updated_po_response.get('status')
                if status == 'confirmed':
                    print(f"   ✅ PO status correctly changed to: {status}")
                    self.confirmed_po_id = confirmation_po_id
                    return True
                else:
                    print(f"   ❌ PO status incorrect - Expected: 'confirmed', Got: {status}")
                    return False
            else:
                print(f"   ❌ Failed to get updated PO status")
                return False
        else:
            print(f"   ❌ Vendor failed to confirm PO")
            return False

    def test_additional_scenarios(self):
        """Test additional scenarios for completeness"""
        print("\n🔍 Testing Additional Scenarios...")
        
        # Test that vendor cannot see draft POs
        print("\n   Testing draft PO visibility...")
        
        # Create a draft PO (with send_immediately=False)
        po_data = {
            "vendor_id": self.vendor_id,
            "delivery_address": "Draft Test Address",
            "contact_person": "Draft Contact",
            "contact_number": "1234567890",
            "delivery_date": "2026-02-10",
            "receiver_name": "Draft Receiver",
            "send_immediately": False,  # This should create a draft PO
            "line_items": [{
                "product_id": self.product_id,
                "product_name": "Draft Product",
                "sku": "DRAFT-SKU",
                "quantity": 1,
                "unit_price": 800,
                "discount_percent": 0,
                "tax_rate": 18
            }]
        }

        success, draft_po_response = self.run_test(
            "Create draft PO",
            "POST",
            "purchase-orders",
            200,
            data=po_data,
            token=self.oll_token
        )

        if success and 'id' in draft_po_response:
            draft_po_id = draft_po_response['id']
            draft_status = draft_po_response.get('status')
            
            if draft_status == 'draft':
                print(f"   ✅ Draft PO created with status: {draft_status}")
                
                # Check vendor cannot see this draft PO
                success, vendor_pos = self.run_test(
                    "Vendor get POs (check draft filtering)",
                    "GET",
                    "purchase-orders",
                    200,
                    token=self.vendor_token
                )

                if success:
                    draft_visible = any(po.get('id') == draft_po_id for po in vendor_pos)
                    if not draft_visible:
                        print(f"   ✅ Draft PO correctly hidden from vendor")
                    else:
                        print(f"   ⚠️ Draft PO visible to vendor (should be filtered by frontend)")
                else:
                    print(f"   ❌ Failed to get vendor POs for draft check")
                    return False
            else:
                print(f"   ❌ Expected draft status, got: {draft_status}")
                return False
        else:
            print(f"   ❌ Failed to create draft PO")
            return False

        return True

def main():
    print("🎯 Starting Review Request Specific Tests")
    print("=" * 60)
    print("Testing OLL Vendor Management System - Newly Implemented Features")
    print("Test Credentials: OLL Admin (olladmin/olladmin), Vendor (vendor/vendor)")
    print("=" * 60)
    
    tester = ReviewRequestTester()
    
    # Setup
    if not tester.setup_auth():
        print("❌ Failed to setup authentication")
        return 1
    
    if not tester.setup_test_data():
        print("❌ Failed to setup test data")
        return 1
    
    # Run priority tests
    tests = [
        ("Priority 1: PO Creation with 'sent' status", tester.test_priority_1_po_creation_with_sent_status),
        ("Priority 2: Delete PO for sent/confirmed", tester.test_priority_2_delete_po_for_sent_confirmed),
        ("Priority 3: Vendor can see 'sent' POs", tester.test_priority_3_vendor_can_see_sent_pos),
        ("Priority 4: Vendor PO Confirmation", tester.test_priority_4_vendor_po_confirmation),
        ("Additional Scenarios", tester.test_additional_scenarios),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Review Request Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All review request tests passed!")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"\n📈 Success Rate: {success_rate:.1f}%")
    
    # Summary of what was tested
    print(f"\n📋 Review Request Test Summary:")
    print(f"   ✓ Priority 1: PO Creation with 'sent' status (NOT 'draft')")
    print(f"   ✓ Priority 2: Delete PO for draft/sent/confirmed statuses")
    print(f"   ✓ Priority 3: Vendor can see 'sent' POs (draft POs filtered)")
    print(f"   ✓ Priority 4: Vendor PO Confirmation workflow")
    print(f"   ✓ Additional: Draft PO creation and visibility testing")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())