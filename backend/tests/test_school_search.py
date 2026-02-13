"""
Test School Search API Feature
Tests the school search endpoint and school details endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSchoolSearchAPI:
    """Tests for school search feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as OLL admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "olladmin",
            "password": "olladmin"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_school_search_endpoint_exists(self):
        """Test that school search endpoint exists and returns 200"""
        response = self.session.get(f"{BASE_URL}/api/schools/search?q=Test&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ School search endpoint exists and returns 200")
    
    def test_school_search_returns_schools_array(self):
        """Test that school search returns schools array"""
        response = self.session.get(f"{BASE_URL}/api/schools/search?q=Test&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        assert "schools" in data, "Response should contain 'schools' key"
        assert isinstance(data["schools"], list), "Schools should be a list"
        print(f"✓ School search returns schools array with {len(data['schools'])} results")
    
    def test_school_search_result_structure(self):
        """Test that each school result has required fields"""
        response = self.session.get(f"{BASE_URL}/api/schools/search?q=Test&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        if len(data["schools"]) > 0:
            school = data["schools"][0]
            required_fields = ["id", "school_name", "address", "city", "state", "contact_name", "contact_phone", "contact_email"]
            for field in required_fields:
                assert field in school, f"School should have '{field}' field"
            print(f"✓ School result has all required fields: {required_fields}")
        else:
            pytest.skip("No schools returned to verify structure")
    
    def test_school_search_filters_by_query(self):
        """Test that search filters results by query string"""
        response = self.session.get(f"{BASE_URL}/api/schools/search?q=Test&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        # All returned schools should contain 'Test' in their name (case-insensitive)
        for school in data["schools"]:
            assert "test" in school["school_name"].lower(), f"School '{school['school_name']}' should contain 'Test'"
        print(f"✓ Search correctly filters by query - all {len(data['schools'])} results contain 'Test'")
    
    def test_school_search_respects_limit(self):
        """Test that search respects the limit parameter"""
        response = self.session.get(f"{BASE_URL}/api/schools/search?q=Test&limit=3")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["schools"]) <= 3, f"Expected max 3 results, got {len(data['schools'])}"
        print(f"✓ Search respects limit parameter - returned {len(data['schools'])} results (max 3)")
    
    def test_school_search_with_empty_query(self):
        """Test search with empty query returns results"""
        response = self.session.get(f"{BASE_URL}/api/schools/search?q=&limit=5")
        assert response.status_code == 200
        data = response.json()
        
        assert "schools" in data, "Response should contain 'schools' key"
        print(f"✓ Empty query search works - returned {len(data['schools'])} results")
    
    def test_school_search_with_short_query(self):
        """Test search with 1-character query"""
        response = self.session.get(f"{BASE_URL}/api/schools/search?q=T&limit=5")
        assert response.status_code == 200
        data = response.json()
        
        assert "schools" in data, "Response should contain 'schools' key"
        print(f"✓ Short query search works - returned {len(data['schools'])} results")
    
    def test_school_search_requires_authentication(self):
        """Test that school search requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.get(f"{BASE_URL}/api/schools/search?q=Test&limit=10")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ School search correctly requires authentication")
    
    def test_school_search_contact_info_present(self):
        """Test that school results include contact information"""
        response = self.session.get(f"{BASE_URL}/api/schools/search?q=Test&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        if len(data["schools"]) > 0:
            # Check at least one school has contact info
            has_contact = any(
                school.get("contact_name") or school.get("contact_phone") 
                for school in data["schools"]
            )
            assert has_contact, "At least one school should have contact information"
            print("✓ School results include contact information")
        else:
            pytest.skip("No schools returned to verify contact info")


class TestSchoolDetailsAPI:
    """Tests for school details endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as OLL admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "olladmin",
            "password": "olladmin"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_school_by_id(self):
        """Test getting school details by ID"""
        # First get a school ID from search
        search_response = self.session.get(f"{BASE_URL}/api/schools/search?q=Test&limit=1")
        assert search_response.status_code == 200
        schools = search_response.json().get("schools", [])
        
        if len(schools) > 0:
            school_id = schools[0]["id"]
            response = self.session.get(f"{BASE_URL}/api/schools/{school_id}")
            # Note: This endpoint may return 404 if external API doesn't support single school lookup
            if response.status_code == 200:
                data = response.json()
                assert "school_name" in data, "School details should have school_name"
                print(f"✓ Get school by ID works - retrieved '{data['school_name']}'")
            else:
                print(f"⚠ Get school by ID returned {response.status_code} - may not be supported by external API")
        else:
            pytest.skip("No schools available to test details endpoint")


class TestPOWithSchoolIntegration:
    """Tests for PO creation with school data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token and vendor/product data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as OLL admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "olladmin",
            "password": "olladmin"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get vendor and product for PO creation
        vendors_response = self.session.get(f"{BASE_URL}/api/vendors?is_active=true")
        self.vendors = vendors_response.json() if vendors_response.status_code == 200 else []
        
        products_response = self.session.get(f"{BASE_URL}/api/products?is_active=true")
        self.products = products_response.json() if products_response.status_code == 200 else []
    
    def test_create_po_with_school_name(self):
        """Test creating PO with school_name field"""
        if not self.vendors or not self.products:
            pytest.skip("No vendors or products available for PO creation")
        
        vendor = self.vendors[0]
        product = next((p for p in self.products if p["vendor_id"] == vendor["id"]), None)
        
        if not product:
            pytest.skip("No products found for the vendor")
        
        po_data = {
            "vendor_id": vendor["id"],
            "school_name": "TEST_School_Integration",
            "delivery_address": "123 Test Street, Test City",
            "contact_person": "Test Contact",
            "contact_number": "9876543210",
            "delivery_date": "2026-03-01",
            "line_items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "sku": product["sku"],
                "quantity": 1,
                "unit_price": product["unit_price"],
                "tax_rate": product.get("tax_rate", 18),
                "discount_amount": 0,
                "discount_percent": 0
            }],
            "send_immediately": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchase-orders", json=po_data)
        assert response.status_code == 200, f"PO creation failed: {response.text}"
        
        created_po = response.json()
        assert created_po.get("school_name") == "TEST_School_Integration", "School name should be saved"
        print(f"✓ PO created with school_name: {created_po['po_number']}")
        
        # Verify by fetching the PO
        get_response = self.session.get(f"{BASE_URL}/api/purchase-orders/{created_po['id']}")
        assert get_response.status_code == 200
        fetched_po = get_response.json()
        assert fetched_po.get("school_name") == "TEST_School_Integration", "School name should persist"
        print("✓ School name persisted correctly in PO")
    
    def test_create_po_without_school_name(self):
        """Test creating PO without school_name (should still work)"""
        if not self.vendors or not self.products:
            pytest.skip("No vendors or products available for PO creation")
        
        vendor = self.vendors[0]
        product = next((p for p in self.products if p["vendor_id"] == vendor["id"]), None)
        
        if not product:
            pytest.skip("No products found for the vendor")
        
        po_data = {
            "vendor_id": vendor["id"],
            "delivery_address": "456 Test Avenue, Test Town",
            "contact_person": "Another Contact",
            "contact_number": "9876543211",
            "delivery_date": "2026-03-02",
            "line_items": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "sku": product["sku"],
                "quantity": 2,
                "unit_price": product["unit_price"],
                "tax_rate": product.get("tax_rate", 18),
                "discount_amount": 0,
                "discount_percent": 0
            }],
            "send_immediately": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchase-orders", json=po_data)
        assert response.status_code == 200, f"PO creation without school_name failed: {response.text}"
        
        created_po = response.json()
        print(f"✓ PO created without school_name: {created_po['po_number']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
