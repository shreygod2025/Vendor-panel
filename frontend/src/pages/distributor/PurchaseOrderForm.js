import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Plus, Trash2, Save, ArrowLeft, Package } from "lucide-react";
import { toast } from "sonner";

const DistributorPurchaseOrderForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    vendor_id: "",
    delivery_address: "",
    receiver_name: "",
    contact_person: "",
    contact_number: "",
    delivery_date: "",
    notes: "",
    line_items: [],
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [vendorsRes, productsRes] = await Promise.all([
        apiClient.get("/vendors"),
        apiClient.get("/products"),
      ]);
      setVendors(vendorsRes.data);
      setProducts(productsRes.data);

      if (isEdit) {
        const poRes = await apiClient.get(`/purchase-orders/${id}`);
        const po = poRes.data;
        setFormData({
          vendor_id: po.vendor_id,
          delivery_address: po.delivery_address,
          receiver_name: po.receiver_name || "",
          contact_person: po.contact_person,
          contact_number: po.contact_number,
          delivery_date: po.delivery_date,
          notes: po.notes || "",
          line_items: po.line_items,
        });
      }
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        {
          product_id: "",
          product_name: "",
          sku: "",
          quantity: 1,
          unit_price: 0,
          tax_rate: 18,
          discount_amount: 0,
          discount_percent: 0,
        }
      ]
    }));
  };

  const updateLineItem = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.line_items];
      newItems[index] = { ...newItems[index], [field]: value };

      // If product is selected, auto-fill product details
      if (field === "product_id" && value) {
        const product = products.find(p => p.id === value);
        if (product) {
          newItems[index].product_name = product.name;
          newItems[index].sku = product.sku;
          // Note: unit_price and tax_rate are hidden for distributors
          // We still need to send them but the actual values will come from the product
          newItems[index].unit_price = product.unit_price;
          newItems[index].tax_rate = product.tax_rate;

          // Auto-select vendor if not already selected
          if (!prev.vendor_id && product.vendor_id) {
            return {
              ...prev,
              vendor_id: product.vendor_id,
              line_items: newItems
            };
          }
        }
      }

      return { ...prev, line_items: newItems };
    });
  };

  const removeLineItem = (index) => {
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.vendor_id) {
      toast.error("Please select products to determine vendor");
      return;
    }
    if (formData.line_items.length === 0) {
      toast.error("Please add at least one product");
      return;
    }
    if (!formData.delivery_address || !formData.contact_person || !formData.contact_number) {
      toast.error("Please fill all required fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        order_discount_amount: 0,
        order_discount_percent: 0,
        send_immediately: true,
      };

      if (isEdit) {
        await apiClient.put(`/purchase-orders/${id}`, payload);
        toast.success("Purchase order updated successfully");
      } else {
        await apiClient.post("/purchase-orders", payload);
        toast.success("Purchase order created successfully");
      }
      navigate("/distributor/purchase-orders");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save purchase order");
    } finally {
      setSaving(false);
    }
  };

  // Get products filtered by selected vendor
  const filteredProducts = formData.vendor_id 
    ? products.filter(p => p.vendor_id === formData.vendor_id)
    : products;

  // Get selected vendor name
  const selectedVendor = vendors.find(v => v.id === formData.vendor_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div data-testid="distributor-po-form">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="page-title">{isEdit ? "Edit Purchase Order" : "Create Purchase Order"}</h1>
            <p className="page-subtitle">
              {isEdit ? "Update order details" : "Add products and delivery details"}
            </p>
          </div>
        </div>
      </div>

      <div className="page-container">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Products Section - First */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Button type="button" variant="outline" onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>

              {formData.line_items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-[300px]">Product</TableHead>
                        <TableHead className="w-[100px]">SKU</TableHead>
                        <TableHead className="w-[100px]">Quantity</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.line_items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Select
                              value={item.product_id}
                              onValueChange={(value) => updateLineItem(index, "product_id", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredProducts.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                              {item.sku || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, "quantity", parseInt(e.target.value) || 1)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {formData.line_items.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">
                  Click "Add Product" to start adding items to your order
                </p>
              )}

              {selectedVendor && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Vendor:</strong> {selectedVendor.name}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Details */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="receiver_name">Receiver Name *</Label>
                  <Input
                    id="receiver_name"
                    value={formData.receiver_name}
                    onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value })}
                    placeholder="Name of person receiving delivery"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="delivery_date">Expected Delivery Date *</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="delivery_address">Delivery Address *</Label>
                <Textarea
                  id="delivery_address"
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  placeholder="Full delivery address"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_person">Contact Person *</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Contact person name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_number">Contact Number *</Label>
                  <Input
                    id="contact_number"
                    value={formData.contact_number}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    placeholder="+91 9876543210"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special instructions or notes"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#1e3a8a] hover:bg-[#1e40af]">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEdit ? "Update Order" : "Create Order"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DistributorPurchaseOrderForm;
