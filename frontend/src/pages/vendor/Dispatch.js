import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ArrowLeft, Save, Loader2, Truck, Upload, FileText, Image } from "lucide-react";
import { toast } from "sonner";

const VendorDispatch = () => {
  const { poId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  
  const [formData, setFormData] = useState({
    po_id: poId,
    courier_partner: "",
    tracking_id: "",
    dispatch_date: new Date().toISOString().split('T')[0],
    proof_url: "",
    notes: ""
  });

  useEffect(() => {
    fetchOrder();
  }, [poId]);

  const fetchOrder = async () => {
    try {
      const response = await apiClient.get(`/purchase-orders/${poId}`);
      setOrder(response.data);
      
      if (response.data.status !== "confirmed") {
        toast.error("Only confirmed POs can be dispatched");
        navigate("/vendor/purchase-orders");
      }
    } catch (error) {
      toast.error("Failed to fetch order");
      navigate("/vendor/purchase-orders");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await apiClient.post("/dispatch", formData);
      toast.success("Dispatch details added successfully");
      navigate("/vendor/purchase-orders");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add dispatch details");
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
    <div data-testid="dispatch-form-page">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/vendor/purchase-orders")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="page-title">Add Dispatch Details</h1>
            <p className="page-subtitle">PO: {order?.po_number}</p>
          </div>
        </div>
      </div>

      <div className="page-container">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dispatch Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Dispatch Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="form-label">Courier Partner *</Label>
                      <Input
                        value={formData.courier_partner}
                        onChange={(e) => setFormData(prev => ({ ...prev, courier_partner: e.target.value }))}
                        placeholder="e.g., Delhivery, BlueDart"
                        required
                        data-testid="courier-input"
                      />
                    </div>
                    <div>
                      <Label className="form-label">Tracking ID *</Label>
                      <Input
                        value={formData.tracking_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, tracking_id: e.target.value }))}
                        placeholder="e.g., AWB123456789"
                        required
                        data-testid="tracking-id-input"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="form-label">Dispatch Date *</Label>
                    <Input
                      type="date"
                      value={formData.dispatch_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, dispatch_date: e.target.value }))}
                      required
                      data-testid="dispatch-date-input"
                    />
                  </div>

                  <div>
                    <Label className="form-label">Proof URL (Optional)</Label>
                    <Input
                      value={formData.proof_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, proof_url: e.target.value }))}
                      placeholder="https://drive.google.com/..."
                      data-testid="proof-url-input"
                    />
                    <p className="text-xs text-slate-500 mt-1">Upload proof to Google Drive and paste the link here</p>
                  </div>

                  <div>
                    <Label className="form-label">Notes (Optional)</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional dispatch notes..."
                      rows={3}
                      data-testid="dispatch-notes-input"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/vendor/purchase-orders")}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-amber-600 hover:bg-amber-700"
                      disabled={saving}
                      data-testid="submit-dispatch-btn"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Truck className="w-4 h-4 mr-2" />
                          Submit Dispatch
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </div>

          {/* Order Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Delivery Address</p>
                  <p className="font-medium">{order?.delivery_address}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Contact Person</p>
                  <p className="font-medium">{order?.contact_person}</p>
                  <p className="text-sm text-slate-500">{order?.contact_number}</p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm text-slate-500">Items</p>
                  <div className="mt-2 space-y-2">
                    {order?.line_items?.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{item.product_name} x{item.quantity}</span>
                        <span className="font-mono">{formatCurrency(item.unit_price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold">
                    <span>Grand Total</span>
                    <span className="font-mono text-[#1e3a8a]">{formatCurrency(order?.grand_total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDispatch;
