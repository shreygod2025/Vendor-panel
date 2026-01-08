import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Eye, FileText, Truck, Check, X, Package, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

const VendorPurchaseOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Delivery dialog state
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [deliveryForm, setDeliveryForm] = useState({
    invoice_number: "",
    invoice_amount: "",
    invoice_date: "",
    invoice_file: null,
    logistics_cost: "",
    logistics_bill_file: null,
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await apiClient.get("/purchase-orders");
      // Filter out draft POs - vendor should not see drafts
      const filteredOrders = response.data.filter(order => order.status !== "draft");
      setOrders(filteredOrders);
    } catch (error) {
      toast.error("Failed to fetch purchase orders");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    try {
      await apiClient.post(`/purchase-orders/${id}/confirm`);
      toast.success("PO confirmed successfully");
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to confirm PO");
    }
  };

  const handleReject = async (id) => {
    const reason = prompt("Enter reason for rejection:");
    if (reason === null) return;
    
    try {
      await apiClient.post(`/purchase-orders/${id}/reject?reason=${encodeURIComponent(reason)}`);
      toast.success("PO rejected");
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject PO");
    }
  };

  const openDeliveryDialog = (order) => {
    setSelectedPO(order);
    setDeliveryForm({
      invoice_number: "",
      invoice_amount: order.grand_total || "",
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_file: null,
      logistics_cost: "",
      logistics_bill_file: null,
      notes: ""
    });
    setDeliveryDialogOpen(true);
  };

  const handleDeliverySubmit = async () => {
    if (!deliveryForm.invoice_number || !deliveryForm.invoice_amount || !deliveryForm.invoice_date) {
      toast.error("Please fill in all required invoice fields");
      return;
    }

    if (!deliveryForm.logistics_cost) {
      toast.error("Please enter logistics cost");
      return;
    }

    setSubmitting(true);
    try {
      // Submit delivery via new vendor-deliver endpoint
      const deliveryData = {
        invoice_number: deliveryForm.invoice_number,
        invoice_amount: parseFloat(deliveryForm.invoice_amount),
        invoice_date: deliveryForm.invoice_date,
        logistics_cost: parseFloat(deliveryForm.logistics_cost) || 0,
        invoice_file_url: deliveryForm.invoice_file ? URL.createObjectURL(deliveryForm.invoice_file) : null,
        logistics_bill_url: deliveryForm.logistics_bill_file ? URL.createObjectURL(deliveryForm.logistics_bill_file) : null,
        notes: deliveryForm.notes
      };
      
      await apiClient.post(`/purchase-orders/${selectedPO.id}/vendor-deliver`, deliveryData);
      
      toast.success("Delivery submitted for OLL approval");
      setDeliveryDialogOpen(false);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit delivery");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      sent: "bg-blue-100 text-blue-700",
      confirmed: "bg-indigo-100 text-indigo-700",
      dispatched: "bg-amber-100 text-amber-700",
      pending_approval: "bg-purple-100 text-purple-700",
      delivered: "bg-emerald-100 text-emerald-700",
      closed: "bg-slate-100 text-slate-500",
      rejected: "bg-red-100 text-red-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  const filteredOrders = orders.filter((order) => {
    return statusFilter === "all" || order.status === statusFilter;
  });

  return (
    <div data-testid="vendor-po-list-page">
      <div className="page-header">
        <h1 className="page-title">Purchase Orders</h1>
        <p className="page-subtitle">View and manage your purchase orders</p>
      </div>

      <div className="page-container">
        <div className="flex gap-4 mb-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state py-12">
              <FileText className="empty-state-icon" />
              <p className="empty-state-title">No purchase orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>PO Number</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">{order.po_number}</TableCell>
                    <TableCell>{order.receiver_name || order.contact_person || "-"}</TableCell>
                    <TableCell>{order.line_items?.length || 0} items</TableCell>
                    <TableCell className="font-mono font-medium">{formatCurrency(order.grand_total)}</TableCell>
                    <TableCell>
                      <span className={`badge ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(order.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/vendor/purchase-orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        
                        {order.status === "sent" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReject(order.id)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConfirm(order.id)}
                              className="text-emerald-600 hover:bg-emerald-50"
                              data-testid={`confirm-po-${order.id}`}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        
                        {order.status === "confirmed" && (
                          <Link to={`/vendor/dispatch/${order.id}`}>
                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                              <Truck className="w-4 h-4 mr-1" />
                              Dispatch
                            </Button>
                          </Link>
                        )}

                        {order.status === "dispatched" && (
                          <Button 
                            size="sm" 
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => openDeliveryDialog(order)}
                          >
                            <Package className="w-4 h-4 mr-1" />
                            Mark Delivered
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Delivery & Invoice Dialog */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Mark as Delivered
            </DialogTitle>
            <DialogDescription>
              Upload invoice and logistics details to mark PO {selectedPO?.po_number} as delivered
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Important:</strong> Invoice and logistics details are required to mark delivery complete.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="form-label">Invoice Number *</Label>
                <Input
                  value={deliveryForm.invoice_number}
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                  placeholder="INV-001"
                />
              </div>
              <div>
                <Label className="form-label">Invoice Date *</Label>
                <Input
                  type="date"
                  value={deliveryForm.invoice_date}
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, invoice_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="form-label">Invoice Amount (₹) *</Label>
                <Input
                  type="number"
                  value={deliveryForm.invoice_amount}
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, invoice_amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="form-label">Logistics Cost (₹) *</Label>
                <Input
                  type="number"
                  value={deliveryForm.logistics_cost}
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, logistics_cost: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label className="form-label">Upload Invoice</Label>
              <div className="mt-1 flex items-center gap-3">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, invoice_file: e.target.files[0] }))}
                  className="text-sm"
                />
                {deliveryForm.invoice_file && (
                  <span className="text-xs text-emerald-600">✓ {deliveryForm.invoice_file.name}</span>
                )}
              </div>
            </div>

            <div>
              <Label className="form-label">Upload Logistics Bill</Label>
              <div className="mt-1 flex items-center gap-3">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, logistics_bill_file: e.target.files[0] }))}
                  className="text-sm"
                />
                {deliveryForm.logistics_bill_file && (
                  <span className="text-xs text-emerald-600">✓ {deliveryForm.logistics_bill_file.name}</span>
                )}
              </div>
            </div>

            <div>
              <Label className="form-label">Notes</Label>
              <Textarea
                value={deliveryForm.notes}
                onChange={(e) => setDeliveryForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeliverySubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm Delivery
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorPurchaseOrders;
