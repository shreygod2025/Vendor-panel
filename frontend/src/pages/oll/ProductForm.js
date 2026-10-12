import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    vendor_id: "",
    unit_price: "",
    tax_rate: "18",
    description: "",
    unit: "pcs",
    is_active: true
  });

  useEffect(() => {
    fetchVendors();
    if (isEdit) {
      fetchProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchVendors = async () => {
    try {
      const response = await apiClient.get("/vendors?is_active=true");
      setVendors(response.data);
    } catch (error) {
      toast.error("Failed to fetch vendors");
    }
  };

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/products/${id}`);
      setFormData({
        ...response.data,
        unit_price: response.data.unit_price.toString(),
        tax_rate: response.data.tax_rate.toString()
      });
    } catch (error) {
      toast.error("Failed to fetch product");
      navigate("/oll/products");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...formData,
      unit_price: parseFloat(formData.unit_price),
      tax_rate: parseFloat(formData.tax_rate)
    };

    try {
      if (isEdit) {
        await apiClient.put(`/products/${id}`, payload);
        toast.success("Product updated successfully");
      } else {
        await apiClient.post("/products", payload);
        toast.success("Product created successfully");
      }
      navigate("/oll/products");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="product-form-page">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/oll/products")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="page-title">{isEdit ? "Edit Product" : "Add Product"}</h1>
            <p className="page-subtitle">
              {isEdit ? "Update product information" : "Add a new product"}
            </p>
          </div>
        </div>
      </div>

      <div className="page-container">
        <form onSubmit={handleSubmit}>
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="form-label">Product Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    data-testid="product-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="sku" className="form-label">SKU / Product ID *</Label>
                  <Input
                    id="sku"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    required
                    placeholder="e.g., PUMP-A100"
                    data-testid="product-sku-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="vendor_id" className="form-label">Vendor *</Label>
                <Select 
                  value={formData.vendor_id} 
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, vendor_id: value }))}
                >
                  <SelectTrigger data-testid="product-vendor-select">
                    <SelectValue placeholder="Select a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="unit_price" className="form-label">Unit Price (₹) *</Label>
                  <Input
                    id="unit_price"
                    name="unit_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unit_price}
                    onChange={handleChange}
                    required
                    data-testid="product-price-input"
                  />
                </div>
                <div>
                  <Label htmlFor="tax_rate" className="form-label">Tax Rate (GST %) *</Label>
                  <Select 
                    value={formData.tax_rate} 
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, tax_rate: value }))}
                  >
                    <SelectTrigger data-testid="product-tax-select">
                      <SelectValue placeholder="Select tax rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Exempt)</SelectItem>
                      <SelectItem value="5">5% GST</SelectItem>
                      <SelectItem value="12">12% GST</SelectItem>
                      <SelectItem value="18">18% GST</SelectItem>
                      <SelectItem value="28">28% GST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="unit" className="form-label">Unit *</Label>
                  <Select 
                    value={formData.unit} 
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger data-testid="product-unit-select">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="ltr">Liters (ltr)</SelectItem>
                      <SelectItem value="mtr">Meters (mtr)</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="set">Set</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="form-label">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Brief description of the product"
                  data-testid="product-description-input"
                />
              </div>

              <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Active Status</p>
                  <p className="text-sm text-slate-500">Enable or disable this product</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                  data-testid="product-active-switch"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/oll/products")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1e3a8a] hover:bg-[#1e40af]"
                  disabled={saving}
                  data-testid="save-product-btn"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {isEdit ? "Update Product" : "Create Product"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
