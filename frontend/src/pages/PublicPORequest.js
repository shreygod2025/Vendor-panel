import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Plus, Trash2, Loader2, Send, Package, User, MapPin, Phone, Calendar, FileText } from "lucide-react";
import { toast, Toaster } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const PublicPORequest = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolResults, setSchoolResults] = useState([]);
  const [searchingSchools, setSearchingSchools] = useState(false);
  
  const [formData, setFormData] = useState({
    delivery_date: "",
    school_name: "",
    delivery_address: "",
    contact_person: "",
    contact_number: "",
    notes: "",
    requester_name: "",
    products: [{ product_name: "", quantity: 1 }]
  });

  // Debounce school search
  useEffect(() => {
    if (schoolSearch.length < 2) {
      setSchoolResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingSchools(true);
      try {
        const response = await axios.get(`${API}/api/schools/search?q=${encodeURIComponent(schoolSearch)}&limit=5`);
        setSchoolResults(response.data.schools || []);
      } catch (error) {
        console.log("School search failed");
        setSchoolResults([]);
      } finally {
        setSearchingSchools(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [schoolSearch]);

  const handleSchoolSelect = (school) => {
    setFormData(prev => ({
      ...prev,
      school_name: school.school_name,
      delivery_address: [school.address, school.city, school.state].filter(Boolean).join(", "),
      contact_person: school.contact_name || prev.contact_person,
      contact_number: school.contact_phone || prev.contact_number
    }));
    setSchoolSearch("");
    setSchoolResults([]);
    toast.success("School details auto-filled");
  };

  const handleAddProduct = () => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { product_name: "", quantity: 1 }]
    }));
  };

  const handleRemoveProduct = (index) => {
    if (formData.products.length === 1) return;
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const handleProductChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.map((p, i) => 
        i === index ? { ...p, [field]: value } : p
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Use schoolSearch as school_name if user didn't select from autocomplete
    const finalSchoolName = formData.school_name || schoolSearch;
    
    // Validations
    if (!formData.requester_name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!finalSchoolName.trim()) {
      toast.error("Please enter school name");
      return;
    }
    if (!formData.delivery_address.trim()) {
      toast.error("Please enter delivery address");
      return;
    }
    if (!formData.contact_person.trim()) {
      toast.error("Please enter contact person name");
      return;
    }
    if (!formData.contact_number.trim()) {
      toast.error("Please enter contact number");
      return;
    }
    if (!formData.delivery_date) {
      toast.error("Please select delivery date");
      return;
    }
    
    const validProducts = formData.products.filter(p => p.product_name.trim() && p.quantity > 0);
    if (validProducts.length === 0) {
      toast.error("Please add at least one product");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/public/po-request`, {
        delivery_date: formData.delivery_date,
        school_name: finalSchoolName,
        delivery_address: formData.delivery_address,
        contact_person: formData.contact_person,
        contact_number: formData.contact_number,
        notes: formData.notes,
        requester_name: formData.requester_name,
        products: validProducts.map(p => ({
          product_name: p.product_name.trim(),
          quantity: parseInt(p.quantity)
        }))
      });

      toast.success("PO Request submitted successfully!");
      
      // Redirect to tracking page after short delay
      setTimeout(() => {
        navigate(`/track/${response.data.tracking_token}`);
      }, 1500);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <div className="bg-[#1e3a8a] text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">Raise Purchase Order Request</h1>
          <p className="text-blue-200 mt-1">Submit your PO request for review and approval</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Requester Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-blue-600" />
                Your Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="requester_name">Your Name *</Label>
                <Input
                  id="requester_name"
                  value={formData.requester_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, requester_name: e.target.value }))}
                  placeholder="Enter your full name"
                  className="mt-1"
                  data-testid="requester-name"
                />
              </div>
            </CardContent>
          </Card>

          {/* School & Delivery Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-blue-600" />
                Delivery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* School Name with Search */}
              <div className="relative">
                <Label htmlFor="school_name">School Name *</Label>
                <Input
                  id="school_name"
                  value={formData.school_name || schoolSearch}
                  onChange={(e) => {
                    if (formData.school_name) {
                      setFormData(prev => ({ ...prev, school_name: "" }));
                    }
                    setSchoolSearch(e.target.value);
                  }}
                  placeholder="Type to search schools..."
                  className="mt-1"
                  data-testid="school-name"
                />
                {searchingSchools && (
                  <div className="absolute right-3 top-9">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  </div>
                )}
                {schoolResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {schoolResults.map((school, idx) => (
                      <div
                        key={idx}
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => handleSchoolSelect(school)}
                      >
                        <p className="font-medium">{school.school_name}</p>
                        <p className="text-sm text-slate-500">
                          {[school.city, school.state].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery Address */}
              <div>
                <Label htmlFor="delivery_address">Delivery Address *</Label>
                <Textarea
                  id="delivery_address"
                  value={formData.delivery_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                  placeholder="Complete delivery address"
                  className="mt-1"
                  rows={2}
                  data-testid="delivery-address"
                />
              </div>

              {/* Contact Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_person">Contact Person *</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                    placeholder="Name of contact person"
                    className="mt-1"
                    data-testid="contact-person"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_number">Contact Number *</Label>
                  <Input
                    id="contact_number"
                    value={formData.contact_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_number: e.target.value }))}
                    placeholder="Phone number"
                    className="mt-1"
                    data-testid="contact-number"
                  />
                </div>
              </div>

              {/* Delivery Date */}
              <div>
                <Label htmlFor="delivery_date">Expected Delivery Date *</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                  className="mt-1"
                  min={new Date().toISOString().split('T')[0]}
                  data-testid="delivery-date"
                />
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5 text-blue-600" />
                  Products Required
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddProduct}
                  data-testid="add-product-btn"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Product
                </Button>
              </div>
              <CardDescription>
                Enter the products you need (quantity only, no pricing required)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.products.map((product, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500">Product Name</Label>
                    <Input
                      value={product.product_name}
                      onChange={(e) => handleProductChange(index, 'product_name', e.target.value)}
                      placeholder="e.g., Robotics Kit, Arduino Board..."
                      data-testid={`product-name-${index}`}
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs text-slate-500">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={product.quantity}
                      onChange={(e) => handleProductChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      data-testid={`product-qty-${index}`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveProduct(index)}
                    disabled={formData.products.length === 1}
                    className="mt-5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-blue-600" />
                Additional Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any special instructions or requirements..."
                rows={3}
                data-testid="notes"
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              size="lg"
              className="bg-[#1e3a8a] hover:bg-[#1e40af]"
              disabled={loading}
              data-testid="submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Raise PO Request
                </>
              )}
            </Button>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <p className="font-medium mb-1">What happens next?</p>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li>Your request will be reviewed by the admin team</li>
              <li>Admin will assign a vendor and add pricing details</li>
              <li>Once approved, the PO will be sent to the vendor</li>
              <li>You can track the status using the tracking link provided after submission</li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PublicPORequest;
