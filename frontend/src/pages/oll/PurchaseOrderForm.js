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
import { ArrowLeft, Save, Loader2, Plus, Trash2, Package, MapPin } from "lucide-react";
import { toast } from "sonner";

const PurchaseOrderForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [formData, setFormData] = useState({
    vendor_id: "",
    custom_po_number: "",
    school_name: "",
    delivery_address: "",
    contact_person: "",
    contact_number: "",
    delivery_date: "",
    order_discount_amount: 0,
    order_discount_percent: 0,
    notes: "",
    final_comments: "",
    line_items: [
      // Start with one empty row
      {
        product_id: "",
        product_name: "",
        sku: "",
        quantity: 1,
        unit_price: 0,
        tax_rate: 18,
        discount_amount: 0,
        discount_percent: 0,
        comment: ""
      }
    ]
  });

  const [totals, setTotals] = useState({
    subtotal: 0,
    total_discount: 0,
    total_tax: 0,
    grand_total: 0
  });

  const [nextPoNumber, setNextPoNumber] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

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

      // Fetch next PO number for new POs
      if (!isEdit) {
        try {
          const nextPORes = await apiClient.get("/purchase-orders/next-po-number");
          setNextPoNumber(nextPORes.data.next_po_number);
        } catch (e) {
          // Ignore if endpoint doesn't exist yet
        }
      }

      if (isEdit) {
        const poRes = await apiClient.get(`/purchase-orders/${id}`);
        setFormData({
          vendor_id: poRes.data.vendor_id,
          custom_po_number: poRes.data.po_number || "",
          school_name: poRes.data.school_name || "",
          delivery_address: poRes.data.delivery_address,
          contact_person: poRes.data.contact_person,
          contact_number: poRes.data.contact_number,
          delivery_date: poRes.data.delivery_date || "",
          order_discount_amount: poRes.data.order_discount_amount,
          order_discount_percent: poRes.data.order_discount_percent,
          notes: poRes.data.notes || "",
          final_comments: poRes.data.final_comments || "",
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
      if (!item.product_id) return;
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
    // Recalculate tax after order discount if any
    if (orderDiscount > 0) {
      totalTax = 0;
      formData.line_items.forEach(item => {
        if (!item.product_id) return;
        const itemTotal = item.quantity * item.unit_price;
        let itemDiscount = 0;
        if (item.discount_percent > 0) {
          itemDiscount = itemTotal * (item.discount_percent / 100);
        } else {
          itemDiscount = item.discount_amount || 0;
        }
        const itemAfterDiscount = itemTotal - itemDiscount;
        // Apply proportional order discount
        const proportionalOrderDiscount = orderDiscount * (itemAfterDiscount / (subtotal - totalItemDiscount));
        const taxableAmount = itemAfterDiscount - proportionalOrderDiscount;
        const itemTax = taxableAmount * (item.tax_rate / 100);
        totalTax += itemTax;
      });
    }
    
    const grandTotal = subtotal - totalDiscount + totalTax;

    setTotals({
      subtotal: Math.round(subtotal * 100) / 100,
      total_discount: Math.round(totalDiscount * 100) / 100,
      total_tax: Math.round(totalTax * 100) / 100,
      grand_total: Math.round(grandTotal * 100) / 100
    });
  };

  // Get available products - if vendor is selected, filter by vendor; otherwise show all
  const getAvailableProducts = () => {
    if (formData.vendor_id) {
      return products.filter(p => p.vendor_id === formData.vendor_id && p.is_active);
    }
    return products.filter(p => p.is_active);
  };

  const handleAddProduct = () => {
    setFormData(prev => ({
      ...prev,
      line_items: [...prev.line_items, {
        product_id: "",
        product_name: "",
        sku: "",
        quantity: 1,
        unit_price: 0,
        tax_rate: 18,
        discount_amount: 0,
        discount_percent: 0,
        comment: ""
      }]
    }));
  };

  const handleProductSelect = (index, productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Auto-set vendor if not already set
    if (!formData.vendor_id) {
      setFormData(prev => ({
        ...prev,
        vendor_id: product.vendor_id,
        line_items: prev.line_items.map((item, i) => 
          i === index ? {
            ...item,
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            unit_price: product.unit_price,
            tax_rate: product.tax_rate
          } : item
        )
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        line_items: prev.line_items.map((item, i) => 
          i === index ? {
            ...item,
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            unit_price: product.unit_price,
            tax_rate: product.tax_rate
          } : item
        )
      }));
    }
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => {
      const newLineItems = prev.line_items.filter((_, i) => i !== index);
      // If no line items left, add one empty row and clear vendor selection
      if (newLineItems.length === 0) {
        return { 
          ...prev, 
          vendor_id: "", 
          line_items: [{
            product_id: "",
            product_name: "",
            sku: "",
            quantity: 1,
            unit_price: 0,
            tax_rate: 18,
            discount_amount: 0,
            discount_percent: 0,
            comment: ""
          }] 
        };
      }
      return { ...prev, line_items: newLineItems };
    });
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items.map((item, i) => 
        i === index ? { ...item, [field]: field === 'comment' ? value : (parseFloat(value) || 0) } : item
      )
    }));
  };

  const downloadPDF = async (orderId, poNumber) => {
    try {
      const response = await apiClient.get(`/purchase-orders/${orderId}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PO-${poNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download PDF:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Filter out empty line items
    const validLineItems = formData.line_items.filter(item => item.product_id);
    
    if (validLineItems.length === 0) {
      toast.error("Please add at least one product");
      return;
    }

    if (!formData.vendor_id) {
      toast.error("Vendor is required");
      return;
    }

    const submitData = {
      ...formData,
      line_items: validLineItems
    };

    setSaving(true);
    try {
      if (isEdit) {
        await apiClient.put(`/purchase-orders/${id}`, submitData);
        toast.success("Purchase order updated successfully");
        navigate("/oll/purchase-orders");
      } else {
        const response = await apiClient.post("/purchase-orders", submitData);
        toast.success("Purchase order created successfully");
        // Auto-download PDF after creation
        const createdPO = response.data;
        await downloadPDF(createdPO.id, createdPO.po_number);
        navigate("/oll/purchase-orders");
      }
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

  const getSelectedVendorName = () => {
    const vendor = vendors.find(v => v.id === formData.vendor_id);
    return vendor?.name || "";
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

  const availableProducts = getAvailableProducts();
  const validLineItemsCount = formData.line_items.filter(item => item.product_id).length;

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
          {/* Delivery Details - Now First */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="form-label">Vendor</Label>
                  <Select 
                    value={formData.vendor_id} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      vendor_id: value, 
                      line_items: [{
                        product_id: "",
                        product_name: "",
                        sku: "",
                        quantity: 1,
                        unit_price: 0,
                        tax_rate: 18,
                        discount_amount: 0,
                        discount_percent: 0,
                        comment: ""
                      }] 
                    }))}
                    disabled={isEdit || formData.line_items.some(item => item.product_id)}
                  >
                    <SelectTrigger data-testid="vendor-select">
                      <SelectValue placeholder="Auto-selected from products" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">Auto-selected from products</p>
                </div>
                <div>
                  <Label className="form-label">PO Number (Optional)</Label>
                  <Input
                    value={formData.custom_po_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, custom_po_number: e.target.value.toUpperCase() }))}
                    placeholder={nextPoNumber || "Auto-generated"}
                    data-testid="custom-po-number-input"
                    disabled={isEdit}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {nextPoNumber ? `Next: ${nextPoNumber} (leave blank to use)` : "Leave blank to auto-generate"}
                  </p>
                </div>
                <div>
                  <Label className="form-label">Delivery Date *</Label>
                  <Input
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                    required
                    data-testid="delivery-date-input"
                  />
                </div>
              </div>

              <div>
                <Label className="form-label">Delivery Address *</Label>
                <Textarea
                  value={formData.delivery_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                  rows={2}
                  required
                  placeholder="Enter complete delivery address"
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
                    placeholder="Name of contact person"
                    data-testid="contact-person-input"
                  />
                </div>
                <div>
                  <Label className="form-label">Contact Number *</Label>
                  <Input
                    value={formData.contact_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_number: e.target.value }))}
                    required
                    placeholder="+91 9876543210"
                    data-testid="contact-number-input"
                  />
                </div>
              </div>

              <div>
                <Label className="form-label">Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Additional notes for this order (visible to vendor)"
                  data-testid="notes-input"
                />
              </div>
            </CardContent>
          </Card>

          {/* Products Table - Below Delivery Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Products
                  </CardTitle>
                  {formData.vendor_id && (
                    <p className="text-sm text-slate-500 mt-1">
                      Vendor: <span className="font-medium text-slate-700">{getSelectedVendorName()}</span>
                    </p>
                  )}
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddProduct}
                  data-testid="add-product-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Row
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-[250px]">Product</TableHead>
                      <TableHead className="w-24 text-center">Qty</TableHead>
                      <TableHead className="w-32 text-right">Unit Price</TableHead>
                      <TableHead className="w-24 text-center">Disc %</TableHead>
                      <TableHead className="w-24 text-center">Tax</TableHead>
                      <TableHead className="w-32 text-right">Line Total</TableHead>
                      <TableHead className="w-[200px]">Comment</TableHead>
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
                            <Select 
                              value={item.product_id} 
                              onValueChange={(v) => handleProductSelect(index, v)}
                            >
                              <SelectTrigger data-testid={`product-select-${index}`} className="w-full">
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableProducts.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    <div className="flex flex-col">
                                      <span>{product.name}</span>
                                      <span className="text-xs text-slate-500">{product.sku} • {product.vendor_name}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              className="w-20 text-center"
                              data-testid={`qty-input-${index}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm text-right">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount_percent}
                              onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)}
                              className="w-16 text-center"
                              data-testid={`discount-input-${index}`}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Select 
                              value={String(item.tax_rate)} 
                              onValueChange={(v) => handleItemChange(index, 'tax_rate', v)}
                            >
                              <SelectTrigger className="w-24 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">No GST</SelectItem>
                                <SelectItem value="5">5%</SelectItem>
                                <SelectItem value="18">18%</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-slate-900">
                            {item.product_id ? formatCurrency(lineTotal) : "₹0.00"}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.comment || ""}
                              onChange={(e) => handleItemChange(index, 'comment', e.target.value)}
                              placeholder="Add comment..."
                              className="text-sm"
                              data-testid={`comment-input-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
            </CardContent>
          </Card>

          {/* Order Discount, Final Comments & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Discount & Final Comments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="form-label">Order Discount (₹)</Label>
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
                  <Label className="form-label">Final Comments</Label>
                  <Textarea
                    value={formData.final_comments}
                    onChange={(e) => setFormData(prev => ({ ...prev, final_comments: e.target.value }))}
                    rows={4}
                    placeholder="Any final comments, special instructions, or internal notes for this order..."
                    data-testid="final-comments-input"
                  />
                  <p className="text-xs text-slate-500 mt-1">These comments are for internal reference</p>
                </div>
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card className="bg-slate-50">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal ({validLineItemsCount} items)</span>
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
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Grand Total</span>
                      <span className="font-mono text-[#1e3a8a]">{formatCurrency(totals.grand_total)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
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
              disabled={saving || validLineItemsCount === 0}
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
