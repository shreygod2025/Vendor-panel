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
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ReturnForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  
  const [formData, setFormData] = useState({
    po_id: "",
    vendor_id: "",
    items: [],
    notes: ""
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
              product_name: product?.product_name || ""
            };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post("/returns", formData);
      toast.success("Return created successfully");
      navigate("/oll/returns");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create return");
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
    <div data-testid="return-form-page">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/oll/returns")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="page-title">Create Return</h1>
            <p className="page-subtitle">Create a product return request</p>
          </div>
        </div>
      </div>

      <div className="page-container">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
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
                      {po.po_number} - {po.vendor_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

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
                  formData.items.map((item, index) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-lg space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label>Product</Label>
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
                                    {li.product_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div>
                            <Label>Reason</Label>
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
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}

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

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/oll/returns")}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#1e3a8a] hover:bg-[#1e40af]"
              disabled={saving || !selectedPO}
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
                  Create Return
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
