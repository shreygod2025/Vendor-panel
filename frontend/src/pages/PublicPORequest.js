import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import { Plus, Trash2, Loader2, Send, Package, User, MapPin, FileText, Search, Check, ChevronsUpDown } from "lucide-react";
import { toast, Toaster } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const PublicPORequest = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productPopoverOpen, setProductPopoverOpen] = useState({});  // Track popover state
  
  // School search state
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolResults, setSchoolResults] = useState([]);
  const [searchingSchools, setSearchingSchools] = useState(false);
  
  const [formData, setFormData] = useState({
    delivery_date: "",
    school_name: "",
    city: "",  // Add city field
    delivery_address: "",
    contact_person: "",
    contact_number: "",
    notes: "",
    requester_name: "",
    items: [{ product_id: "", product_name: "", quantity: 1 }]
  });

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get(`${API}/api/public/products`);
        setProducts(response.data || []);
      } catch (error) {
        console.error("Failed to fetch products");
        toast.error("Failed to load products list");
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

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
      city: school.city || prev.city,  // Add city field
      delivery_address: [school.address, school.city, school.state].filter(Boolean).join(", "),
      contact_person: school.contact_name || prev.contact_person,
      contact_number: school.contact_phone || prev.contact_number
    }));
    setSchoolSearch(school.school_name);
    setSchoolResults([]);
    toast.success("School details auto-filled");
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: "", product_name: "", quantity: 1 }]
    }));
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length === 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleProductSelect = (index, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map((item, i) => 
          i === index ? { 
            ...item, 
            product_id: productId, 
            product_name: product.name 
          } : item
        )
      }));
    }
  };

  const handleQuantityChange = (index, quantity) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, quantity: parseInt(quantity) || 1 } : item
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validations
    if (!formData.requester_name.trim()) {
      toast.error("Please enter your name");
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
    
    const validItems = formData.items.filter(item => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("Please select at least one product");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/public/po-request`, {
        delivery_date: formData.delivery_date,
        school_name: formData.school_name || schoolSearch || null,
        city: formData.city || null,  // Add city field
        delivery_address: formData.delivery_address,
        contact_person: formData.contact_person,
        contact_number: formData.contact_number,
        notes: formData.notes,
        requester_name: formData.requester_name,
        products: validItems.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity
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

  // Group products by vendor for easier selection
  const groupedProducts = products.reduce((acc, product) => {
    const vendorName = product.vendor_name || "Other";
    if (!acc[vendorName]) {
      acc[vendorName] = [];
    }
    acc[vendorName].push(product);
    return acc;
  }, {});

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
              {/* School Name with Search (Optional) */}
              <div className="relative">
                <Label htmlFor="school_name">School Name (Optional - Search from database)</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="school_name"
                    value={formData.school_name || schoolSearch}
                    onChange={(e) => {
                      if (formData.school_name) {
                        setFormData(prev => ({ ...prev, school_name: "" }));
                      }
                      setSchoolSearch(e.target.value);
                    }}
                    placeholder="Type to search schools or leave empty..."
                    className="pl-10"
                    data-testid="school-name"
                  />
                </div>
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

              {/* City and Delivery Address */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
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
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City name"
                    className="mt-1"
                    data-testid="city"
                  />
                </div>
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
                  onClick={handleAddItem}
                  data-testid="add-product-btn"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Product
                </Button>
              </div>
              <CardDescription>
                Select products from our catalog
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingProducts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-slate-500">Loading products...</span>
                </div>
              ) : (
                formData.items.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <Label className="text-xs text-slate-500">Product *</Label>
                      <Popover 
                        open={productPopoverOpen[index]} 
                        onOpenChange={(open) => setProductPopoverOpen(prev => ({ ...prev, [index]: open }))}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={productPopoverOpen[index]}
                            className="w-full justify-between font-normal mt-1"
                            data-testid={`product-select-${index}`}
                          >
                            {item.product_id ? (
                              <span className="truncate">
                                {products.find(p => p.id === item.product_id)?.name || item.product_name || "Select product"}
                              </span>
                            ) : (
                              <span className="text-slate-500">Search product...</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search products..." />
                            <CommandList>
                              <CommandEmpty>No product found.</CommandEmpty>
                              {Object.entries(groupedProducts).map(([vendorName, vendorProducts]) => (
                                <CommandGroup key={vendorName} heading={vendorName}>
                                  {vendorProducts.map(product => (
                                    <CommandItem
                                      key={product.id}
                                      value={`${product.name} ${product.sku || ''} ${vendorName}`}
                                      onSelect={() => {
                                        handleProductSelect(index, product.id);
                                        setProductPopoverOpen(prev => ({ ...prev, [index]: false }));
                                      }}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${item.product_id === product.id ? "opacity-100" : "opacity-0"}`}
                                      />
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{product.name}</span>
                                          {product.in_stock === false && (
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                                              Out of stock
                                            </span>
                                          )}
                                        </div>
                                        {product.sku && (
                                          <span className="text-xs text-slate-500">SKU: {product.sku}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="w-24">
                      <Label className="text-xs text-slate-500">Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        className="mt-1"
                        data-testid={`product-qty-${index}`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                      disabled={formData.items.length === 1}
                      className="mt-5 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
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
              disabled={loading || loadingProducts}
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
              <li>Admin will verify vendor and add pricing details</li>
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
