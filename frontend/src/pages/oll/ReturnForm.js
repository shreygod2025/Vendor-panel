import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, Save, Loader2, Plus, Trash2, Upload, AlertCircle, IndianRupee } from "lucide-react";
import { toast } from "sonner";

const ReturnForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [returnProofUrl, setReturnProofUrl] = useState("");
  
  const [formData, setFormData] = useState({
    po_id: "",
    vendor_id: "",
    items: [],
    notes: "",
    return_proof_url: ""
  });

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    try {
      const response = await apiClient.get("/purchase-orders?status=delivered");
      setPurchaseOrders(response.data);
    } catch (error) {
      toast.error("Failed to fetch purchase orders");
    } finally {
      setLoading(false);
    }
  };

  const handlePOSelect = async (poId) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (po) {
      setSelectedPO(po);
      setFormData(prev => ({
        ...prev,
        po_id: poId,
        vendor_id: po.vendor_id,
        items: []
      }));
    }
  };

  const handleAddItem = () => {
    if (!selectedPO) return;
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: "",
        product_name: "",
        quantity: 1,
        unit_price: 0,
        original_price: 0,
        deduction_amount: 0,
        deduction_reason: "",
        reason: ""
      }]
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          if (field === 'product_id') {
            const product = selectedPO.line_items.find(li => li.product_id === value);
            return {
              ...item,
              product_id: value,
              product_name: product?.product_name || "",
              unit_price: product?.unit_price || 0,
              original_price: product?.unit_price || 0
            };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    }));
  };

  const handleProofUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    setUploading(true);
    try {
      const response = await apiClient.post("/upload", formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setReturnProofUrl(response.data.url);
      setFormData(prev => ({ ...prev, return_proof_url: response.data.url }));
      toast.success("Return proof uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload return proof");
    } finally {
      setUploading(false);
    }
  };

  const calculateTotals = () => {
    const totalValue = formData.items.reduce((sum, item) => sum + (item.quantity * item.original_price), 0);
    const totalDeductions = formData.items.reduce((sum, item) => sum + (parseFloat(item.deduction_amount) || 0), 0);
    const creditAmount = totalValue - totalDeductions;
    return { totalValue, totalDeductions, creditAmount };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    if (!formData.return_proof_url) {
      toast.error("Return proof is mandatory. Please upload a photo/document of the returned items.");
      return;
    }

    // Validate each item has product selected
    const invalidItems = formData.items.filter(item => !item.product_id || !item.reason);
    if (invalidItems.length > 0) {
      toast.error("Please select a product and reason for all items");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post("/returns", formData);
      toast.success("Return created successfully and sent to vendor");
      navigate("/oll/returns");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create return");
    } finally {
      setSaving(false);
    }
  };

  const { totalValue, totalDeductions, creditAmount } = calculateTotals();

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
    <div data-testid="return-form-page">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/oll/returns")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="page-title">Create Return</h1>
            <p className="page-subtitle">Create a product return request with cost details</p>
          </div>
        </div>
      </div>

      <div className="page-container">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          {/* PO Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Purchase Order</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={formData.po_id} onValueChange={handlePOSelect}>
                <SelectTrigger data-testid="po-select">
                  <SelectValue placeholder="Select a delivered PO" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} - {po.vendor_name} ({formatCurrency(po.grand_total)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedPO && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">PO Number:</span>
                      <span className="ml-2 font-mono font-medium">{selectedPO.po_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Vendor:</span>
                      <span className="ml-2 font-medium">{selectedPO.vendor_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Total Items:</span>
                      <span className="ml-2 font-medium">{selectedPO.line_items.length}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">PO Value:</span>
                      <span className="ml-2 font-medium text-blue-600">{formatCurrency(selectedPO.grand_total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Return Proof Upload */}
          {selectedPO && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Return Proof (Mandatory)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Please upload photos or documents showing the items being returned</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleProofUpload}
                      disabled={uploading}
                      className="flex-1"
                      data-testid="return-proof-upload"
                    />
                    {uploading && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                  </div>
                  
                  {returnProofUrl && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <span className="text-emerald-700 text-sm font-medium">Return proof uploaded successfully</span>
                      <a 
                        href={returnProofUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 underline text-sm"
                      >
                        View
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Return Items */}
          {selectedPO && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Return Items</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.items.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Click "Add Item" to add products for return</p>
                ) : (
                  formData.items.map((item, index) => {
                    const itemTotal = item.quantity * item.original_price;
                    const itemCredit = itemTotal - (parseFloat(item.deduction_amount) || 0);
                    
                    return (
                      <div key={index} className="p-4 bg-slate-50 rounded-lg space-y-4 border border-slate-200">
                        <div className="flex items-start justify-between">
                          <span className="text-sm font-medium text-slate-500">Item #{index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* Product Select */}
                          <div>
                            <Label>Product *</Label>
                            <Select 
                              value={item.product_id} 
                              onValueChange={(v) => handleItemChange(index, 'product_id', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedPO.line_items.map((li) => (
                                  <SelectItem key={li.product_id} value={li.product_id}>
                                    {li.product_name} ({formatCurrency(li.unit_price)})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Quantity */}
                          <div>
                            <Label>Quantity *</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          
                          {/* Return Reason */}
                          <div>
                            <Label>Reason *</Label>
                            <Select 
                              value={item.reason} 
                              onValueChange={(v) => handleItemChange(index, 'reason', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="damaged">Damaged</SelectItem>
                                <SelectItem value="defective">Defective</SelectItem>
                                <SelectItem value="wrong_item">Wrong Item</SelectItem>
                                <SelectItem value="quality_issue">Quality Issue</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Original Price (Read-only) */}
                          <div>
                            <Label>Original Price (per unit)</Label>
                            <div className="h-10 px-3 flex items-center bg-slate-100 rounded-md border border-slate-200 font-mono text-sm">
                              {formatCurrency(item.original_price)}
                            </div>
                          </div>
                        </div>

                        {/* Deduction Section */}
                        <div className="pt-3 border-t border-slate-200">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label>Deduction Amount (optional)</Label>
                              <div className="relative">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.deduction_amount}
                                  onChange={(e) => handleItemChange(index, 'deduction_amount', parseFloat(e.target.value) || 0)}
                                  className="pl-9"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <Label>Deduction Reason</Label>
                              <Input
                                value={item.deduction_reason || ""}
                                onChange={(e) => handleItemChange(index, 'deduction_reason', e.target.value)}
                                placeholder="e.g., Missing accessories, Partial damage..."
                              />
                            </div>
                          </div>
                        </div>

                        {/* Item Summary */}
                        {item.product_id && (
                          <div className="p-3 bg-white rounded border border-slate-200">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Item Total ({item.quantity} x {formatCurrency(item.original_price)}):</span>
                              <span className="font-mono">{formatCurrency(itemTotal)}</span>
                            </div>
                            {item.deduction_amount > 0 && (
                              <div className="flex justify-between text-sm text-red-600">
                                <span>Deduction:</span>
                                <span className="font-mono">- {formatCurrency(item.deduction_amount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-medium pt-1 border-t border-slate-100 mt-1">
                              <span className="text-emerald-700">Credit Amount:</span>
                              <span className="font-mono text-emerald-600">{formatCurrency(itemCredit)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Notes */}
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes about this return..."
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Card */}
          {selectedPO && formData.items.length > 0 && (
            <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border-blue-200">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-700 mb-4">Return Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Return Value:</span>
                    <span className="font-mono font-medium">{formatCurrency(totalValue)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Total Deductions:</span>
                    <span className="font-mono font-medium">- {formatCurrency(totalDeductions)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-300">
                    <span className="text-emerald-700">Credit Amount to Vendor:</span>
                    <span className="font-mono text-emerald-600">{formatCurrency(creditAmount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/oll/returns")}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#1e3a8a] hover:bg-[#1e40af]"
              disabled={saving || !selectedPO || formData.items.length === 0 || !formData.return_proof_url}
              data-testid="save-return-btn"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create & Send Return
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReturnForm;
