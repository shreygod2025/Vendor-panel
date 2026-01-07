import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
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
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const PurchaseOrderForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [vendorProducts, setVendorProducts] = useState([]);
  
  const [formData, setFormData] = useState({
    vendor_id: "",
    delivery_address: "",
    contact_person: "",
    contact_number: "",
    order_discount_amount: 0,
    order_discount_percent: 0,
    notes: "",
    line_items: []
  });

  const [totals, setTotals] = useState({
    subtotal: 0,
    total_discount: 0,
    total_tax: 0,
    grand_total: 0
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.vendor_id) {
      const filtered = products.filter(p => p.vendor_id === formData.vendor_id && p.is_active);
      setVendorProducts(filtered);
    } else {
      setVendorProducts([]);
    }
  }, [formData.vendor_id, products]);

  useEffect(() => {
    calculateTotals();
  }, [formData.line_items, formData.order_discount_amount, formData.order_discount_percent]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [vendorsRes, productsRes] = await Promise.all([
        apiClient.get("/vendors?is_active=true"),
        apiClient.get("/products?is_active=true")
      ]);
      setVendors(vendorsRes.data);
      setProducts(productsRes.data);

      if (isEdit) {
        const poRes = await apiClient.get(`/purchase-orders/${id}`);
        setFormData({
          vendor_id: poRes.data.vendor_id,
          delivery_address: poRes.data.delivery_address,
          contact_person: poRes.data.contact_person,
          contact_number: poRes.data.contact_number,
          order_discount_amount: poRes.data.order_discount_amount,
          order_discount_percent: poRes.data.order_discount_percent,
          notes: poRes.data.notes || "",
          line_items: poRes.data.line_items
        });
      }
    } catch (error) {
      toast.error("Failed to fetch data");
      navigate("/oll/purchase-orders");
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalItemDiscount = 0;
    let totalTax = 0;

    formData.line_items.forEach(item => {
      const itemTotal = item.quantity * item.unit_price;
      
      let itemDiscount = 0;
      if (item.discount_percent > 0) {
        itemDiscount = itemTotal * (item.discount_percent / 100);
      } else {
        itemDiscount = item.discount_amount || 0;
      }
      
      totalItemDiscount += itemDiscount;
      const itemAfterDiscount = itemTotal - itemDiscount;
      const itemTax = itemAfterDiscount * (item.tax_rate / 100);
      totalTax += itemTax;
      subtotal += itemTotal;
    });

    let orderDiscount = 0;
    if (formData.order_discount_percent > 0) {
      orderDiscount = (subtotal - totalItemDiscount) * (formData.order_discount_percent / 100);
    } else {
      orderDiscount = formData.order_discount_amount;
    }

    const totalDiscount = totalItemDiscount + orderDiscount;
    const taxableAmount = subtotal - totalDiscount;
    totalTax = taxableAmount * 0.18; // Simplified: average 18%
    const grandTotal = subtotal - totalDiscount + totalTax;

    setTotals({
      subtotal: Math.round(subtotal * 100) / 100,
      total_discount: Math.round(totalDiscount * 100) / 100,
      total_tax: Math.round(totalTax * 100) / 100,
      grand_total: Math.round(grandTotal * 100) / 100
    });
  };

  const handleAddProduct = (productId) => {
    const product = vendorProducts.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = formData.line_items.findIndex(item => item.product_id === productId);
    if (existingIndex !== -1) {
      toast.error("Product already added");
      return;
    }

    const newItem = {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      quantity: 1,
      unit_price: product.unit_price,
      tax_rate: product.tax_rate,
      discount_amount: 0,
      discount_percent: 0
    };

    setFormData(prev => ({
      ...prev,
      line_items: [...prev.line_items, newItem]
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items.map((item, i) => 
        i === index ? { ...item, [field]: parseFloat(value) || 0 } : item
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.line_items.length === 0) {
      toast.error("Please add at least one product");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await apiClient.put(`/purchase-orders/${id}`, formData);
        toast.success("Purchase order updated successfully");
      } else {
        await apiClient.post("/purchase-orders", formData);
        toast.success("Purchase order created successfully");
      }
      navigate("/oll/purchase-orders");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save purchase order");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
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
    <div data-testid="po-form-page">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/oll/purchase-orders")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="page-title">{isEdit ? "Edit Purchase Order" : "Create Purchase Order"}</h1>
            <p className="page-subtitle">
              {isEdit ? "Update purchase order details" : "Create a new purchase order"}
            </p>
          </div>
        </div>
      </div>

      <div className="page-container">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vendor Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor & Delivery Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="form-label">Select Vendor *</Label>
                <Select 
                  value={formData.vendor_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, vendor_id: value, line_items: [] }))}
                  disabled={isEdit}
                >
                  <SelectTrigger data-testid="vendor-select">
                    <SelectValue placeholder="Select a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="form-label">Delivery Address *</Label>
                <Textarea
                  value={formData.delivery_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                  rows={2}
                  required
                  data-testid="delivery-address-input"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="form-label">Contact Person *</Label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                    required
                    data-testid="contact-person-input"
                  />
                </div>
                <div>
                  <Label className="form-label">Contact Number *</Label>
                  <Input
                    value={formData.contact_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_number: e.target.value }))}
                    required
                    data-testid="contact-number-input"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Products</CardTitle>
                {formData.vendor_id && (
                  <Select onValueChange={handleAddProduct}>
                    <SelectTrigger className="w-[250px]" data-testid="add-product-select">
                      <SelectValue placeholder="Add product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {formatCurrency(product.unit_price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {formData.line_items.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {formData.vendor_id ? (
                    <p>Select products from the dropdown above</p>
                  ) : (
                    <p>Select a vendor first to add products</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="w-24">Qty</TableHead>
                        <TableHead className="w-32">Unit Price</TableHead>
                        <TableHead className="w-32">Discount (%)</TableHead>
                        <TableHead className="w-24">Tax</TableHead>
                        <TableHead className="w-32 text-right">Total</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.line_items.map((item, index) => {
                        const itemTotal = item.quantity * item.unit_price;
                        const discount = item.discount_percent > 0 
                          ? itemTotal * (item.discount_percent / 100) 
                          : item.discount_amount;
                        const afterDiscount = itemTotal - discount;
                        const tax = afterDiscount * (item.tax_rate / 100);
                        const lineTotal = afterDiscount + tax;

                        return (
                          <TableRow key={index} data-testid={`line-item-${index}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                <p className="text-xs text-slate-500">{item.sku}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                className="w-20"
                                data-testid={`qty-input-${index}`}
                              />
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatCurrency(item.unit_price)}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={item.discount_percent}
                                onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)}
                                className="w-20"
                                data-testid={`discount-input-${index}`}
                              />
                            </TableCell>
                            <TableCell>{item.tax_rate}%</TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {formatCurrency(lineTotal)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                                className="text-red-600 hover:text-red-700"
                                data-testid={`remove-item-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Discount & Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Discount & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="form-label">Discount Amount (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.order_discount_amount}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        order_discount_amount: parseFloat(e.target.value) || 0,
                        order_discount_percent: 0
                      }))}
                      data-testid="order-discount-amount"
                    />
                  </div>
                  <div>
                    <Label className="form-label">Or Discount (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.order_discount_percent}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        order_discount_percent: parseFloat(e.target.value) || 0,
                        order_discount_amount: 0
                      }))}
                      data-testid="order-discount-percent"
                    />
                  </div>
                </div>
                <div>
                  <Label className="form-label">Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Additional notes for this order"
                    data-testid="notes-input"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Discount</span>
                    <span className="font-mono text-red-600">-{formatCurrency(totals.total_discount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax (GST)</span>
                    <span className="font-mono">{formatCurrency(totals.total_tax)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Grand Total</span>
                      <span className="font-mono text-[#1e3a8a]">{formatCurrency(totals.grand_total)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/oll/purchase-orders")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#1e3a8a] hover:bg-[#1e40af]"
              disabled={saving}
              data-testid="save-po-btn"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEdit ? "Update PO" : "Create PO"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;
