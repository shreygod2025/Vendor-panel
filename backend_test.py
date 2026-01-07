import requests
import sys
import json
from datetime import datetime

class VendorManagementAPITester:
    def __init__(self, base_url="https://vendormanage-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.oll_token = None
        self.vendor_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.vendor_id = None
        self.product_id = None
        self.po_id = None
        self.issue_id = None
        self.return_id = None
        self.invoice_id = None
        self.payment_id = None

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

    def test_seed_data(self):
        """Test seeding initial data"""
        success, response = self.run_test(
            "Seed Data",
            "POST",
            "seed",
            200
        )
        return success

    def test_oll_login(self):
        """Test OLL admin login"""
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
            return True
        return False

    def test_vendor_login(self):
        """Test vendor login"""
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
            return True
        return False

    def test_get_vendors(self):
        """Test getting vendors list"""
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
        return success

    def test_create_vendor(self):
        """Test creating a new vendor"""
        vendor_data = {
            "name": "Test Vendor Ltd",
            "email": "test@vendor.com",
            "phone": "+91 9876543210",
            "address": "123 Test Street, Mumbai",
            "gst_number": "27AABCT9603R1ZM",
            "contact_person": "Test Contact",
            "is_active": True
        }
        success, response = self.run_test(
            "Create Vendor",
            "POST",
            "vendors",
            200,
            data=vendor_data,
            token=self.oll_token
        )
        return success

    def test_get_products(self):
        """Test getting products list"""
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
        return success

    def test_create_product(self):
        """Test creating a new product"""
        if not self.vendor_id:
            print("❌ Cannot create product - no vendor ID available")
            return False
            
        product_data = {
            "name": "Test Product",
            "sku": "TEST-001",
            "vendor_id": self.vendor_id,
            "unit_price": 1000.0,
            "tax_rate": 18.0,
            "description": "Test product description",
            "unit": "pcs",
            "is_active": True
        }
        success, response = self.run_test(
            "Create Product",
            "POST",
            "products",
            200,
            data=product_data,
            token=self.oll_token
        )
        return success

    def test_create_purchase_order(self):
        """Test creating a purchase order"""
        if not self.vendor_id or not self.product_id:
            print("❌ Cannot create PO - missing vendor or product ID")
            return False
            
        po_data = {
            "vendor_id": self.vendor_id,
            "delivery_address": "123 Delivery Street, Mumbai",
            "contact_person": "Test Contact",
            "contact_number": "+91 9876543210",
            "delivery_date": "2024-02-15",
            "line_items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "sku": "TEST-001",
                    "quantity": 2,
                    "unit_price": 1000.0,
                    "tax_rate": 18.0,
                    "discount_amount": 0.0,
                    "discount_percent": 0.0
                }
            ],
            "order_discount_amount": 0.0,
            "order_discount_percent": 0.0,
            "notes": "Test purchase order"
        }
        success, response = self.run_test(
            "Create Purchase Order",
            "POST",
            "purchase-orders",
            200,
            data=po_data,
            token=self.oll_token
        )
        if success and 'id' in response:
            self.po_id = response['id']
            print(f"   Created PO: {response['po_number']} (ID: {self.po_id})")
        return success

    def test_get_purchase_orders(self):
        """Test getting purchase orders"""
        success, response = self.run_test(
            "Get Purchase Orders (OLL)",
            "GET",
            "purchase-orders",
            200,
            token=self.oll_token
        )
        return success

    def test_vendor_get_purchase_orders(self):
        """Test vendor getting their purchase orders"""
        success, response = self.run_test(
            "Get Purchase Orders (Vendor)",
            "GET",
            "purchase-orders",
            200,
            token=self.vendor_token
        )
        return success

    def test_send_po_to_vendor(self):
        """Test sending PO to vendor"""
        if not self.po_id:
            print("❌ Cannot send PO - no PO ID available")
            return False
            
        success, response = self.run_test(
            "Send PO to Vendor",
            "POST",
            f"purchase-orders/{self.po_id}/send",
            200,
            token=self.oll_token
        )
        return success

    def test_vendor_confirm_po(self):
        """Test vendor confirming PO"""
        if not self.po_id:
            print("❌ Cannot confirm PO - no PO ID available")
            return False
            
        success, response = self.run_test(
            "Vendor Confirm PO",
            "POST",
            f"purchase-orders/{self.po_id}/confirm",
            200,
            token=self.vendor_token
        )
        return success

    def test_vendor_dispatch(self):
        """Test vendor adding dispatch details"""
        if not self.po_id:
            print("❌ Cannot add dispatch - no PO ID available")
            return False
            
        dispatch_data = {
            "po_id": self.po_id,
            "courier_partner": "Test Courier",
            "tracking_id": "TEST123456",
            "dispatch_date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Test dispatch"
        }
        success, response = self.run_test(
            "Add Dispatch Details",
            "POST",
            "dispatch",
            200,
            data=dispatch_data,
            token=self.vendor_token
        )
        return success

    def test_public_tracking(self):
        """Test public tracking endpoint"""
        # First get a PO to get tracking token
        if not self.po_id:
            print("❌ Cannot test tracking - no PO ID available")
            return False
            
        # Get PO details to get tracking token
        success, po_response = self.run_test(
            "Get PO for Tracking Token",
            "GET",
            f"purchase-orders/{self.po_id}",
            200,
            token=self.oll_token
        )
        
        if success and 'tracking_token' in po_response:
            tracking_token = po_response['tracking_token']
            success, response = self.run_test(
                "Public Order Tracking",
                "GET",
                f"track/{tracking_token}",
                200
            )
            return success
        return False

    def test_dashboard_stats_oll(self):
        """Test OLL dashboard stats"""
        success, response = self.run_test(
            "OLL Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.oll_token
        )
        return success

    def test_dashboard_stats_vendor(self):
        """Test vendor dashboard stats"""
        success, response = self.run_test(
            "Vendor Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.vendor_token
        )
        return success

    def test_upcoming_deliveries(self):
        """Test upcoming deliveries API"""
        success, response = self.run_test(
            "Get Upcoming Deliveries",
            "GET",
            "deliveries/upcoming",
            200,
            token=self.oll_token
        )
        if success:
            print(f"   Found {len(response)} upcoming deliveries")
        return success

    def test_create_issue(self):
        """Test creating an issue"""
        if not self.po_id:
            print("❌ Cannot create issue - no PO ID available")
            return False
            
        issue_data = {
            "po_id": self.po_id,
            "issue_type": "quality_issue",
            "description": "Test quality issue with delivered items",
            "affected_items": [
                {
                    "product_id": self.product_id,
                    "quantity": 1,
                    "issue": "Damaged packaging"
                }
            ],
            "priority": "medium"
        }
        success, response = self.run_test(
            "Create Issue",
            "POST",
            "issues",
            200,
            data=issue_data,
            token=self.oll_token
        )
        if success and 'id' in response:
            self.issue_id = response['id']
            print(f"   Created Issue: {response['issue_number']} (ID: {self.issue_id})")
        return success

    def test_get_issues(self):
        """Test getting issues list"""
        success, response = self.run_test(
            "Get Issues",
            "GET",
            "issues",
            200,
            token=self.oll_token
        )
        if success:
            print(f"   Found {len(response)} issues")
        return success

    def test_create_return(self):
        """Test creating a return with credit note"""
        if not self.po_id or not self.vendor_id or not self.product_id:
            print("❌ Cannot create return - missing required IDs")
            return False
            
        return_data = {
            "po_id": self.po_id,
            "vendor_id": self.vendor_id,
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "quantity": 1,
                    "unit_price": 1000.0,
                    "reason": "Defective item"
                }
            ],
            "notes": "Test return for defective product"
        }
        success, response = self.run_test(
            "Create Return",
            "POST",
            "returns",
            200,
            data=return_data,
            token=self.oll_token
        )
        if success and 'id' in response:
            self.return_id = response['id']
            print(f"   Created Return: {response['return_number']} (ID: {self.return_id})")
            print(f"   Credit Note: {response.get('credit_note_number', 'N/A')}")
        return success

    def test_get_returns(self):
        """Test getting returns list"""
        success, response = self.run_test(
            "Get Returns",
            "GET",
            "returns",
            200,
            token=self.oll_token
        )
        if success:
            print(f"   Found {len(response)} returns")
        return success

    def test_create_invoice(self):
        """Test creating an invoice"""
        if not self.po_id:
            print("❌ Cannot create invoice - no PO ID available")
            return False
            
        invoice_data = {
            "po_id": self.po_id,
            "invoice_number": "INV-TEST-001",
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
            "amount": 2360.0,  # 2000 + 18% tax
            "due_date": "2024-02-15",
            "notes": "Test invoice"
        }
        success, response = self.run_test(
            "Create Invoice",
            "POST",
            "invoices",
            200,
            data=invoice_data,
            token=self.vendor_token
        )
        if success and 'id' in response:
            self.invoice_id = response['id']
            print(f"   Created Invoice: {response['invoice_number']} (ID: {self.invoice_id})")
        return success

    def test_get_invoices(self):
        """Test getting invoices list"""
        success, response = self.run_test(
            "Get Invoices",
            "GET",
            "invoices",
            200,
            token=self.oll_token
        )
        if success:
            print(f"   Found {len(response)} invoices")
        return success

    def test_create_payment(self):
        """Test creating a payment"""
        if not hasattr(self, 'invoice_id') or not self.invoice_id:
            print("❌ Cannot create payment - no invoice ID available")
            return False
            
        payment_data = {
            "invoice_id": self.invoice_id,
            "amount": 2360.0,
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_mode": "bank_transfer",
            "reference_id": "TEST-PAY-001",
            "notes": "Test payment"
        }
        success, response = self.run_test(
            "Create Payment",
            "POST",
            "payments",
            200,
            data=payment_data,
            token=self.oll_token
        )
        if success and 'id' in response:
            self.payment_id = response['id']
            print(f"   Created Payment: {response['reference_id']} (ID: {self.payment_id})")
        return success

    def test_get_payments(self):
        """Test getting payments list"""
        success, response = self.run_test(
            "Get Payments",
            "GET",
            "payments",
            200,
            token=self.oll_token
        )
        if success:
            print(f"   Found {len(response)} payments")
        return success

    def test_get_pending_payments(self):
        """Test getting pending payments"""
        success, response = self.run_test(
            "Get Pending Payments",
            "GET",
            "payments/pending",
            200,
            token=self.oll_token
        )
        if success:
            print(f"   Found {len(response)} pending payments")
        return success

    def test_po_with_final_comments(self):
        """Test creating PO with final_comments field"""
        if not self.vendor_id or not self.product_id:
            print("❌ Cannot create PO with final comments - missing vendor or product ID")
            return False
            
        po_data = {
            "vendor_id": self.vendor_id,
            "delivery_address": "456 Final Comments Street, Delhi",
            "contact_person": "Final Test Contact",
            "contact_number": "+91 9876543211",
            "delivery_date": "2024-02-20",
            "line_items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "sku": "TEST-001",
                    "quantity": 3,
                    "unit_price": 1000.0,
                    "tax_rate": 18.0,
                    "discount_amount": 0.0,
                    "discount_percent": 5.0,
                    "comment": "Line item comment for testing"
                }
            ],
            "order_discount_amount": 0.0,
            "order_discount_percent": 0.0,
            "notes": "Test purchase order with final comments",
            "final_comments": "These are the final comments for the PO - testing Phase 2 enhancement"
        }
        success, response = self.run_test(
            "Create PO with Final Comments",
            "POST",
            "purchase-orders",
            200,
            data=po_data,
            token=self.oll_token
        )
        if success and 'id' in response:
            print(f"   Created PO with final comments: {response['po_number']}")
            print(f"   Final Comments: {response.get('final_comments', 'N/A')}")
        return success

    def test_products_with_vendor_info(self):
        """Test that products API returns vendor information"""
        success, response = self.run_test(
            "Get Products with Vendor Info",
            "GET",
            "products",
            200,
            token=self.oll_token
        )
        if success and response and len(response) > 0:
            product = response[0]
            if 'vendor_name' in product and product['vendor_name']:
                print(f"   ✅ Product has vendor info: {product['vendor_name']}")
                return True
            else:
                print(f"   ❌ Product missing vendor_name field")
                return False
        return success

    def test_po_status_workflow(self):
        """Test complete PO status workflow"""
        if not self.po_id:
            print("❌ Cannot test PO workflow - no PO ID available")
            return False
            
        # Test getting PO with different statuses
        success, response = self.run_test(
            "Get PO by Status - Draft",
            "GET",
            "purchase-orders?status=draft",
            200,
            token=self.oll_token
        )
        if success:
            draft_pos = [po for po in response if po['status'] == 'draft']
            print(f"   Found {len(draft_pos)} draft POs")
            
        success, response = self.run_test(
            "Get PO by Status - Confirmed",
            "GET",
            "purchase-orders?status=confirmed",
            200,
            token=self.oll_token
        )
        if success:
            confirmed_pos = [po for po in response if po['status'] == 'confirmed']
            print(f"   Found {len(confirmed_pos)} confirmed POs")
            
        success, response = self.run_test(
            "Get PO by Status - Dispatched",
            "GET",
            "purchase-orders?status=dispatched",
            200,
            token=self.oll_token
        )
        if success:
            dispatched_pos = [po for po in response if po['status'] == 'dispatched']
            print(f"   Found {len(dispatched_pos)} dispatched POs")
            
        return success

    def test_invalid_login(self):
        """Test invalid login credentials"""
        success, response = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"username": "invalid", "password": "invalid"}
        )
        return success

    def test_unauthorized_access(self):
        """Test unauthorized access"""
        success, response = self.run_test(
            "Unauthorized Access",
            "GET",
            "vendors",
            401
        )
        return success

def main():
    print("🚀 Starting Vendor Management System API Tests")
    print("=" * 60)
    
    tester = VendorManagementAPITester()
    
    # Test sequence
    tests = [
        ("Seed Data", tester.test_seed_data),
        ("OLL Login", tester.test_oll_login),
        ("Vendor Login", tester.test_vendor_login),
        ("Get Vendors", tester.test_get_vendors),
        ("Create Vendor", tester.test_create_vendor),
        ("Get Products", tester.test_get_products),
        ("Products with Vendor Info", tester.test_products_with_vendor_info),
        ("Create Product", tester.test_create_product),
        ("Create Purchase Order", tester.test_create_purchase_order),
        ("Create PO with Final Comments", tester.test_po_with_final_comments),
        ("Get Purchase Orders (OLL)", tester.test_get_purchase_orders),
        ("Get Purchase Orders (Vendor)", tester.test_vendor_get_purchase_orders),
        ("PO Status Workflow", tester.test_po_status_workflow),
        ("Send PO to Vendor", tester.test_send_po_to_vendor),
        ("Vendor Confirm PO", tester.test_vendor_confirm_po),
        ("Vendor Add Dispatch", tester.test_vendor_dispatch),
        ("Get Upcoming Deliveries", tester.test_upcoming_deliveries),
        ("Create Issue", tester.test_create_issue),
        ("Get Issues", tester.test_get_issues),
        ("Create Return", tester.test_create_return),
        ("Get Returns", tester.test_get_returns),
        ("Create Invoice", tester.test_create_invoice),
        ("Get Invoices", tester.test_get_invoices),
        ("Create Payment", tester.test_create_payment),
        ("Get Payments", tester.test_get_payments),
        ("Get Pending Payments", tester.test_get_pending_payments),
        ("Public Tracking", tester.test_public_tracking),
        ("OLL Dashboard Stats", tester.test_dashboard_stats_oll),
        ("Vendor Dashboard Stats", tester.test_dashboard_stats_vendor),
        ("Invalid Login", tester.test_invalid_login),
        ("Unauthorized Access", tester.test_unauthorized_access),
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
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All tests passed!")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"\n📈 Success Rate: {success_rate:.1f}%")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())