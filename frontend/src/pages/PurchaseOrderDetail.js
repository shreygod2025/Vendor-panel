import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiClient, useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  ArrowLeft,
  Send,
  Check,
  X,
  Truck,
  Package,
  ExternalLink,
  Loader2,
  CheckCircle,
  Clock,
  Edit,
  AlertTriangle,
  FileText,
  Download,
  Image
} from "lucide-react";
import { toast } from "sonner";

const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOLL = user?.role === "oll";
  const isDistributor = user?.role === "distributor";

  const [order, setOrder] = useState(null);
  const [dispatch, setDispatch] = useState(null);
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deliveryDialog, setDeliveryDialog] = useState(false);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  
  // Raise Issue Dialog State
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({
    issue_type: "quality",
    priority: "medium",
    description: ""
  });

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await apiClient.get(`/purchase-orders/${id}`);
      setOrder(response.data);
      
      // Fetch dispatch details if dispatched
      if (["dispatched", "delivered", "closed"].includes(response.data.status)) {
        try {
          const dispatchRes = await apiClient.get(`/dispatch/${id}`);
          setDispatch(dispatchRes.data);
        } catch (e) {
          // No dispatch yet
        }
      }

      // Initialize delivery items
      setDeliveryItems(response.data.line_items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        expected_quantity: item.quantity,
        received_quantity: item.quantity,
        is_damaged: false,
        is_missing: false,
        notes: ""
      })));
    } catch (error) {
      toast.error("Failed to fetch purchase order");
      navigate(isOLL ? "/oll/purchase-orders" : "/vendor/purchase-orders");
    } finally {
      setLoading(false);
    }
  };

  const handleSendToVendor = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/purchase-orders/${id}/send`);
      toast.success("PO sent to vendor successfully");
      fetchOrder();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send PO");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/purchase-orders/${id}/confirm`);
      toast.success("PO confirmed successfully");
      fetchOrder();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to confirm PO");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Enter reason for rejection:");
    if (reason === null) return;
    
    setActionLoading(true);
    try {
      await apiClient.post(`/purchase-orders/${id}/reject?reason=${encodeURIComponent(reason)}`);
      toast.success("PO rejected");
      fetchOrder();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject PO");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/purchase-orders/${id}/deliver`, {
        po_id: id,
        items: deliveryItems,
        notes: deliveryNotes
      });
      toast.success("Delivery confirmed");
      setDeliveryDialog(false);
      fetchOrder();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to confirm delivery");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClosePO = async () => {
    if (!window.confirm("Are you sure you want to close this PO?")) return;
    
    setActionLoading(true);
    try {
      await apiClient.post(`/purchase-orders/${id}/close`);
      toast.success("PO closed successfully");
      fetchOrder();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to close PO");
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: "bg-slate-100 text-slate-600 border-slate-200",
      sent: "bg-blue-100 text-blue-700 border-blue-200",
      confirmed: "bg-indigo-100 text-indigo-700 border-indigo-200",
      dispatched: "bg-amber-100 text-amber-700 border-amber-200",
      delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
      closed: "bg-slate-100 text-slate-500 border-slate-200",
      rejected: "bg-red-100 text-red-700 border-red-200"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  const getTrackingUrl = () => {
    return `${window.location.origin}/track/${order?.tracking_token}`;
  };

  const copyTrackingLink = () => {
    navigator.clipboard.writeText(getTrackingUrl());
    toast.success("Tracking link copied to clipboard");
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

  if (!order) return null;

  const statusSteps = [
    { key: "draft", label: "Draft" },
    { key: "sent", label: "Sent" },
    { key: "confirmed", label: "Confirmed" },
    { key: "dispatched", label: "Dispatched" },
    { key: "delivered", label: "Delivered" },
    { key: "closed", label: "Closed" }
  ];

  const currentStepIndex = statusSteps.findIndex(s => s.key === order.status);

  return (
    <div data-testid="po-detail-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(isOLL ? "/oll/purchase-orders" : "/vendor/purchase-orders")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="page-title">{order.po_number}</h1>
                <span className={`badge border ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <p className="page-subtitle">Created on {formatDate(order.created_at)}</p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            {order.status !== "rejected" && (
              <Button variant="outline" size="sm" onClick={copyTrackingLink}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Copy Tracking Link
              </Button>
            )}
            
            {/* Edit button - for draft, sent, and confirmed POs */}
            {isOLL && (order.status === "draft" || order.status === "sent" || order.status === "confirmed") && (
              <Link to={`/oll/purchase-orders/${order.id}/edit`}>
                <Button variant="outline" data-testid="edit-po-btn">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit PO
                </Button>
              </Link>
            )}
            
            {isOLL && order.status === "draft" && (
              <Button
                className="bg-[#1e3a8a] hover:bg-[#1e40af]"
                onClick={handleSendToVendor}
                disabled={actionLoading}
                data-testid="send-to-vendor-btn"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send to Vendor
              </Button>
            )}

            {!isOLL && order.status === "sent" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  data-testid="reject-po-btn"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleConfirm}
                  disabled={actionLoading}
                  data-testid="confirm-po-btn"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Confirm
                </Button>
              </>
            )}

            {!isOLL && order.status === "confirmed" && (
              <Link to={`/vendor/dispatch/${order.id}`}>
                <Button className="bg-amber-600 hover:bg-amber-700" data-testid="add-dispatch-btn">
                  <Truck className="w-4 h-4 mr-2" />
                  Add Dispatch
                </Button>
              </Link>
            )}

            {isOLL && order.status === "dispatched" && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setDeliveryDialog(true)}
                disabled={actionLoading}
                data-testid="confirm-delivery-btn"
              >
                <Package className="w-4 h-4 mr-2" />
                Confirm Delivery
              </Button>
            )}

            {isOLL && order.status === "delivered" && (
              <Button
                variant="outline"
                onClick={handleClosePO}
                disabled={actionLoading}
                data-testid="close-po-btn"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Close PO
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="page-container space-y-6">
        {/* Status Timeline */}
        {order.status !== "rejected" && (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                {statusSteps.map((step, index) => (
                  <div key={step.key} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        index <= currentStepIndex 
                          ? 'bg-[#1e3a8a] text-white' 
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {index < currentStepIndex ? (
                          <Check className="w-5 h-5" />
                        ) : index === currentStepIndex ? (
                          <Clock className="w-5 h-5" />
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                      <span className={`mt-2 text-xs font-medium ${
                        index <= currentStepIndex ? 'text-slate-900' : 'text-slate-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                    {index < statusSteps.length - 1 && (
                      <div className={`w-16 lg:w-24 h-1 mx-2 ${
                        index < currentStepIndex ? 'bg-[#1e3a8a]' : 'bg-slate-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vendor & Delivery */}
            <Card>
              <CardHeader>
                <CardTitle>Delivery Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Vendor</p>
                    <p className="font-medium">{order.vendor_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Contact Person</p>
                    <p className="font-medium">{order.contact_person}</p>
                    <p className="text-sm text-slate-500">{order.contact_number}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Delivery Address</p>
                  <p className="font-medium">{order.delivery_address}</p>
                </div>
                {order.notes && (
                  <div>
                    <p className="text-sm text-slate-500">Notes</p>
                    <p className="text-sm">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Products ({order.line_items.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.line_items.map((item, index) => {
                      const itemTotal = item.quantity * item.unit_price;
                      const discount = item.discount_percent > 0 
                        ? itemTotal * (item.discount_percent / 100) 
                        : item.discount_amount;
                      const afterDiscount = itemTotal - discount;
                      const tax = afterDiscount * (item.tax_rate / 100);
                      const lineTotal = afterDiscount + tax;

                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-slate-500">{item.sku}</p>
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {discount > 0 ? `-${formatCurrency(discount)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right">{item.tax_rate}%</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCurrency(lineTotal)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Dispatch Info */}
            {dispatch && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Dispatch Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Courier Partner</p>
                      <p className="font-medium">{dispatch.courier_partner}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Tracking ID</p>
                      <p className="font-mono font-medium">{dispatch.tracking_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Dispatch Date</p>
                      <p className="font-medium">{dispatch.dispatch_date}</p>
                    </div>
                    {dispatch.notes && (
                      <div>
                        <p className="text-sm text-slate-500">Notes</p>
                        <p className="text-sm">{dispatch.notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Discount</span>
                    <span className="font-mono text-red-600">-{formatCurrency(order.total_discount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax (GST)</span>
                    <span className="font-mono">{formatCurrency(order.total_tax)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Grand Total</span>
                      <span className="font-mono text-[#1e3a8a]">{formatCurrency(order.grand_total)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delivery Confirmation Dialog */}
      <Dialog open={deliveryDialog} onOpenChange={setDeliveryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Delivery</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {deliveryItems.map((item, index) => (
              <div key={index} className="p-4 bg-slate-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-slate-500">Expected: {item.expected_quantity}</p>
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Received</Label>
                    <Input
                      type="number"
                      min="0"
                      value={item.received_quantity}
                      onChange={(e) => {
                        const newItems = [...deliveryItems];
                        newItems[index].received_quantity = parseInt(e.target.value) || 0;
                        setDeliveryItems(newItems);
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={item.is_damaged}
                      onCheckedChange={(checked) => {
                        const newItems = [...deliveryItems];
                        newItems[index].is_damaged = checked;
                        setDeliveryItems(newItems);
                      }}
                    />
                    <Label className="text-sm">Damaged</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={item.is_missing}
                      onCheckedChange={(checked) => {
                        const newItems = [...deliveryItems];
                        newItems[index].is_missing = checked;
                        setDeliveryItems(newItems);
                      }}
                    />
                    <Label className="text-sm">Missing</Label>
                  </div>
                </div>
              </div>
            ))}
            <div>
              <Label>Notes</Label>
              <Textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Any additional notes about the delivery..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryDialog(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleConfirmDelivery}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrderDetail;
