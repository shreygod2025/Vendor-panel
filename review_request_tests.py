#!/usr/bin/env python3
"""
Specific tests for the review request APIs
"""
import requests
import json
from datetime import datetime

class ReviewRequestTester:
    def __init__(self, base_url="https://oll-po-system.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.oll_token = None
        self.vendor_token = None
        self.vendor_id = None
        self.product_id = None
        self.po_id = None
        
    def login_and_setup(self):
        """Login and get required IDs"""
        print("🔐 Setting up authentication and test data...")
        
        # OLL Login
        response = requests.post(f"{self.api_url}/auth/login", 
                               json={"username": "olladmin", "password": "olladmin"})
        if response.status_code == 200:
            self.oll_token = response.json()['access_token']
            print("✅ OLL admin login successful")
        else:
            print("❌ OLL admin login failed")
            return False
            
        # Vendor Login  
        response = requests.post(f"{self.api_url}/auth/login",
                               json={"username": "vendor", "password": "vendor"})
        if response.status_code == 200:
            self.vendor_token = response.json()['access_token']
            print("✅ Vendor login successful")
        else:
            print("❌ Vendor login failed")
            return False
            
        # Get vendor ID
        headers = {'Authorization': f'Bearer {self.oll_token}'}
        response = requests.get(f"{self.api_url}/vendors", headers=headers)
        if response.status_code == 200 and response.json():
            self.vendor_id = response.json()[0]['id']
            print(f"✅ Got vendor ID: {self.vendor_id}")
        else:
            print("❌ Failed to get vendor ID")
            return False
            
        # Get product ID
        response = requests.get(f"{self.api_url}/products", headers=headers)
        if response.status_code == 200 and response.json():
            self.product_id = response.json()[0]['id']
            print(f"✅ Got product ID: {self.product_id}")
        else:
            print("❌ Failed to get product ID")
            return False
            
        return True
        
    def test_issues_api_create(self):
        """Test Issues API - Create: POST /api/issues"""
        print("\n🧪 Testing Issues API - Create")
        
        if not self.po_id:
            # Create a PO first
            po_data = {
                "vendor_id": self.vendor_id,
                "delivery_address": "Test Address for Issues",
                "receiver_name": "Issue Test Receiver",
                "contact_person": "Issue Contact",
                "contact_number": "+91 9876543210",
                "delivery_date": "2024-02-15",
                "line_items": [{
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "sku": "TEST-001",
                    "quantity": 2,
                    "unit_price": 1000.0,
                    "tax_rate": 18.0,
                    "discount_amount": 0.0,
                    "discount_percent": 0.0
                }]
            }
            headers = {'Authorization': f'Bearer {self.oll_token}'}
            response = requests.post(f"{self.api_url}/purchase-orders", json=po_data, headers=headers)
            if response.status_code == 200:
                self.po_id = response.json()['id']
                print(f"   Created test PO: {self.po_id}")
            else:
                print("❌ Failed to create test PO for issues")
                return False
        
        # Test exact format from review request
        issue_data = {
            "po_id": self.po_id,
            "issue_type": "delay",
            "description": "Test issue",
            "affected_items": [],
            "priority": "medium"
        }
        
        headers = {'Authorization': f'Bearer {self.oll_token}'}
        response = requests.post(f"{self.api_url}/issues", json=issue_data, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Issues API Create - SUCCESS")
            print(f"   Issue Number: {result.get('issue_number')}")
            print(f"   Issue Type: {result.get('issue_type')}")
            print(f"   Priority: {result.get('priority')}")
            print(f"   Status: {result.get('status')}")
            return True
        else:
            print(f"❌ Issues API Create - FAILED (Status: {response.status_code})")
            print(f"   Response: {response.text}")
            return False
            
    def test_returns_api_create(self):
        """Test Returns API - Create: POST /api/returns"""
        print("\n🧪 Testing Returns API - Create")
        
        # Test exact format from review request
        return_data = {
            "po_id": self.po_id,
            "items": [{
                "product_id": self.product_id,
                "quantity": 1,
                "reason": "Defective"
            }]
        }
        
        # Need to add required fields based on API schema
        return_data["vendor_id"] = self.vendor_id
        return_data["items"][0]["product_name"] = "Test Product"
        return_data["items"][0]["unit_price"] = 1000.0
        
        headers = {'Authorization': f'Bearer {self.oll_token}'}
        response = requests.post(f"{self.api_url}/returns", json=return_data, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Returns API Create - SUCCESS")
            print(f"   Return Number: {result.get('return_number')}")
            print(f"   Credit Note Number: {result.get('credit_note_number')}")
            print(f"   Total Value: {result.get('total_value')}")
            print(f"   Status: {result.get('status')}")
            return True
        else:
            print(f"❌ Returns API Create - FAILED (Status: {response.status_code})")
            print(f"   Response: {response.text}")
            return False
            
    def test_invoices_api_create(self):
        """Test Invoices API - Create: POST /api/invoices"""
        print("\n🧪 Testing Invoices API - Create")
        
        # Test exact format from review request
        invoice_data = {
            "po_id": self.po_id,
            "invoice_number": "TEST-INV-001",
            "invoice_date": "2026-01-08",
            "amount": 10000
        }
        
        headers = {'Authorization': f'Bearer {self.vendor_token}'}
        response = requests.post(f"{self.api_url}/invoices", json=invoice_data, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Invoices API Create - SUCCESS")
            print(f"   Invoice Number: {result.get('invoice_number')}")
            print(f"   Invoice Date: {result.get('invoice_date')}")
            print(f"   Amount: {result.get('amount')}")
            print(f"   Payment Status: {result.get('payment_status')}")
            return True
        else:
            print(f"❌ Invoices API Create - FAILED (Status: {response.status_code})")
            print(f"   Response: {response.text}")
            return False
            
    def test_po_api_create_with_receiver_name(self):
        """Test PO API - Create: Test full PO creation with receiver_name field"""
        print("\n🧪 Testing PO API - Create with receiver_name field")
        
        po_data = {
            "vendor_id": self.vendor_id,
            "delivery_address": "Review Request Test Address",
            "receiver_name": "Review Test Receiver",
            "contact_person": "Review Contact",
            "contact_number": "+91 9876543299",
            "delivery_date": "2024-03-15",
            "line_items": [{
                "product_id": self.product_id,
                "product_name": "Review Test Product",
                "sku": "REV-001",
                "quantity": 3,
                "unit_price": 1500.0,
                "tax_rate": 18.0,
                "discount_amount": 0.0,
                "discount_percent": 0.0,
                "comment": "Review request test line item"
            }],
            "order_discount_amount": 0.0,
            "order_discount_percent": 0.0,
            "notes": "Review request test PO",
            "final_comments": "Final comments for review request test"
        }
        
        headers = {'Authorization': f'Bearer {self.oll_token}'}
        response = requests.post(f"{self.api_url}/purchase-orders", json=po_data, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ PO API Create with receiver_name - SUCCESS")
            print(f"   PO Number: {result.get('po_number')}")
            print(f"   Receiver Name: {result.get('receiver_name')}")
            print(f"   Final Comments: {result.get('final_comments')}")
            print(f"   Line Items Count: {len(result.get('line_items', []))}")
            print(f"   Grand Total: {result.get('grand_total')}")
            
            # Verify receiver_name field is properly saved
            if result.get('receiver_name') == "Review Test Receiver":
                print("   ✅ receiver_name field saved correctly")
                return True
            else:
                print(f"   ❌ receiver_name field not saved correctly: {result.get('receiver_name')}")
                return False
        else:
            print(f"❌ PO API Create with receiver_name - FAILED (Status: {response.status_code})")
            print(f"   Response: {response.text}")
            return False
            
    def test_authentication_with_test_credentials(self):
        """Test authentication with the exact credentials from review request"""
        print("\n🧪 Testing Authentication with Test Credentials")
        
        # Test OLL Admin credentials
        response = requests.post(f"{self.api_url}/auth/login",
                               json={"username": "olladmin", "password": "olladmin"})
        if response.status_code == 200:
            user_info = response.json().get('user', {})
            print("✅ OLL Admin Authentication - SUCCESS")
            print(f"   Username: {user_info.get('username')}")
            print(f"   Role: {user_info.get('role')}")
        else:
            print(f"❌ OLL Admin Authentication - FAILED (Status: {response.status_code})")
            return False
            
        # Test Vendor credentials
        response = requests.post(f"{self.api_url}/auth/login",
                               json={"username": "vendor", "password": "vendor"})
        if response.status_code == 200:
            user_info = response.json().get('user', {})
            print("✅ Vendor Authentication - SUCCESS")
            print(f"   Username: {user_info.get('username')}")
            print(f"   Role: {user_info.get('role')}")
            return True
        else:
            print(f"❌ Vendor Authentication - FAILED (Status: {response.status_code})")
            return False

def main():
    print("🚀 Starting Review Request Specific API Tests")
    print("=" * 60)
    
    tester = ReviewRequestTester()
    
    # Setup
    if not tester.login_and_setup():
        print("❌ Setup failed, cannot continue tests")
        return 1
    
    # Run specific tests from review request
    tests = [
        ("Authentication with Test Credentials", tester.test_authentication_with_test_credentials),
        ("Issues API - Create", tester.test_issues_api_create),
        ("Returns API - Create", tester.test_returns_api_create),
        ("Invoices API - Create", tester.test_invoices_api_create),
        ("PO API - Create with receiver_name", tester.test_po_api_create_with_receiver_name),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed += 1
    
    # Results
    print("\n" + "=" * 60)
    print(f"📊 Review Request Test Results: {passed}/{passed + failed} tests passed")
    
    if failed == 0:
        print("✅ All review request tests passed!")
    else:
        print(f"❌ {failed} tests failed")
    
    success_rate = (passed / (passed + failed) * 100) if (passed + failed) > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    exit(main())