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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { 
  Eye, FileText, Truck, Check, X, Package, Loader2, Clock, 
  ChevronDown, ChevronRight, Circle, Receipt, Download
} from "lucide-react";
import { toast } from "sonner";

const VendorPurchaseOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("confirmation");
  const [expandedSections, setExpandedSections] = useState({
    pending: true,
    confirmed: true,
    rejected: true,
    dispatched: true,
    pending_approval: true
  });
  
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
    delivery_proof_file: null,
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);

  // Invoice state
  const [invoices, setInvoices] = useState([]);
  const [viewInvoiceDialog, setViewInvoiceDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    document.title = "OLL - Vendor Orders";
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const [ordersRes, invoicesRes] = await Promise.all([
        apiClient.get("/purchase-orders"),
        apiClient.get("/invoices")
      ]);
      // Filter out draft POs - vendor should not see drafts
      const filteredOrders = ordersRes.data.filter(order => order.status !== "draft");
      setOrders(filteredOrders);
      setInvoices(invoicesRes.data);
    } catch (error) {
      toast.error("Failed to fetch purchase orders");
    } finally {
      setLoading(false);
    }
  };

  const getInvoiceForPO = (poId) => {
    return invoices.find(inv => inv.po_id === poId);
  };

  const openViewInvoice = (poId) => {
    const invoice = getInvoiceForPO(poId);
    if (invoice) {
      setSelectedInvoice(invoice);
      setViewInvoiceDialog(true);
    } else {
      toast.error("No invoice found for this PO");
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

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRejectPO, setSelectedRejectPO] = useState(null);
  const [selectedRejectReason, setSelectedRejectReason] = useState("");
  const [customRejectReason, setCustomRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const rejectReasons = [
    "Delivery timeline too short",
    "Material not available",
    "Price discrepancy",
    "Quantity too high",
    "Product discontinued",
    "Unable to fulfill order",
    "Other (specify below)"
  ];

  const openRejectDialog = (order) => {
    setSelectedRejectPO(order);
    setSelectedRejectReason("");
    setCustomRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRejectPO) return;
    
    let reason = selectedRejectReason;
    if (selectedRejectReason === "Other (specify below)" && customRejectReason.trim()) {
      reason = customRejectReason.trim();
    } else if (!reason) {
      toast.error("Please select a reason for rejection");
      return;
    }
    
    setRejecting(true);
    try {
      await apiClient.post(`/purchase-orders/${selectedRejectPO.id}/reject?reason=${encodeURIComponent(reason)}`);
      toast.success("PO rejected");
      setRejectDialogOpen(false);
      setSelectedRejectPO(null);
      setSelectedRejectReason("");
      setCustomRejectReason("");
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject PO");
    } finally {
      setRejecting(false);
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
      delivery_proof_file: null,
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

    if (!deliveryForm.invoice_file) {
      toast.error("Please upload the invoice document");
      return;
    }

    if (!deliveryForm.delivery_proof_file) {
      toast.error("Please upload delivery proof image");
      return;
    }

    setSubmitting(true);
    try {
      // Convert file to base64 for storage
      const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = (error) => reject(error);
        });
      };

      const invoiceFileBase64 = await fileToBase64(deliveryForm.invoice_file);
      const logisticsFileBase64 = deliveryForm.logistics_bill_file 
        ? await fileToBase64(deliveryForm.logistics_bill_file) 
        : null;
      const deliveryProofBase64 = await fileToBase64(deliveryForm.delivery_proof_file);

      const deliveryData = {
        invoice_number: deliveryForm.invoice_number,
        invoice_amount: parseFloat(deliveryForm.invoice_amount),
        invoice_date: deliveryForm.invoice_date,
        logistics_cost: parseFloat(deliveryForm.logistics_cost) || 0,
        invoice_file_url: invoiceFileBase64,
        logistics_bill_url: logisticsFileBase64,
        delivery_proof_url: deliveryProofBase64,
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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
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
      toast.success("PDF downloaded successfully");
    } catch (error) {
      toast.error("Failed to download PDF");
    }
  };

  // Categorize orders by status
  const categorizedOrders = {
    // PO Confirmation section
    pending: orders.filter(o => o.status === "sent"),
    confirmed: orders.filter(o => o.status === "confirmed"),
    rejected: orders.filter(o => o.status === "rejected"),
    // Dispatched section
    dispatched: orders.filter(o => o.status === "dispatched"),
    pending_approval: orders.filter(o => o.status === "pending_approval"),
    // Delivered section
    delivered: orders.filter(o => o.status === "delivered" || o.status === "closed")
  };

  const renderOrderRow = (order) => {
    return (
      <TableRow key={order.id}>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-mono font-medium">{order.po_number}</span>
            {order.status === "rejected" && order.rejection_reason && (
              <span className="text-xs text-red-600 mt-1 max-w-[200px] truncate" title={order.rejection_reason}>
                Reason: {order.rejection_reason}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>{order.contact_person || "-"}</TableCell>
        <TableCell>{order.line_items?.length || 0} items</TableCell>
        <TableCell className="font-mono font-medium">{formatCurrency(order.grand_total)}</TableCell>
        <TableCell>
          <span className={`badge ${getStatusColor(order.status)}`}>
            {order.status === "pending_approval" ? "Pending Approval" : order.status}
          </span>
        </TableCell>
        <TableCell className="text-slate-500">{formatDate(order.created_at)}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Link to={`/vendor/purchase-orders/${order.id}`}>
              <Button variant="ghost" size="sm" title="View">
                <Eye className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadPDF(order.id, order.po_number)}
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </Button>
            
            {order.status === "sent" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openRejectDialog(order)}
                  className="text-red-600 hover:bg-red-50"
                  data-testid={`reject-po-${order.id}`}
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
    );
  };

  const renderTable = (ordersList, emptyMessage) => {
    if (ordersList.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500">
          <p className="text-sm">{emptyMessage}</p>
        </div>
      );
    }
    return (
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
          {ordersList.map(order => renderOrderRow(order))}
        </TableBody>
      </Table>
    );
  };

  const renderDeliveredTable = (ordersList) => {
    if (ordersList.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500">
          <p className="text-sm">No delivered orders</p>
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>PO Number</TableHead>
            <TableHead>Receiver</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Logistics Cost</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordersList.map(order => {
            const invoice = getInvoiceForPO(order.id);
            return (
              <TableRow key={order.id}>
                <TableCell className="font-mono font-medium">{order.po_number}</TableCell>
                <TableCell>{order.receiver_name || order.contact_person || "-"}</TableCell>
                <TableCell>{order.line_items?.length || 0} items</TableCell>
                <TableCell className="font-mono font-medium">{formatCurrency(order.grand_total)}</TableCell>
                <TableCell className="font-mono text-slate-600">
                  {invoice?.logistics_cost ? formatCurrency(invoice.logistics_cost) : "-"}
                </TableCell>
                <TableCell>
                  <span className={`badge ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link to={`/vendor/purchase-orders/${order.id}`}>
                      <Button variant="ghost" size="sm" title="View PO">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    {invoice ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="View Invoice" 
                        className="text-emerald-600"
                        onClick={() => openViewInvoice(order.id)}
                      >
                        <Receipt className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" disabled title="No Invoice">
                        <Receipt className="w-4 h-4 opacity-30" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderSubSection = (title, orders, sectionKey, icon, iconColor) => {
    const isExpanded = expandedSections[sectionKey];
    return (
      <div className="border rounded-lg overflow-hidden mb-4">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center`}>
              {icon}
            </div>
            <span className="font-medium text-slate-700">{title}</span>
            <span className="text-sm text-slate-500">({orders.length})</span>
          </div>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
        </button>
        {isExpanded && (
          <div className="p-4 border-t">
            {renderTable(orders, `No ${title.toLowerCase()} orders`)}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="vendor-po-list-page">
      <div className="page-header">
        <h1 className="page-title">Purchase Orders</h1>
        <p className="page-subtitle">View and manage your purchase orders</p>
      </div>

      <div className="page-container">
        {orders.length === 0 ? (
          <div className="empty-state py-12">
            <FileText className="empty-state-icon" />
            <p className="empty-state-title">No purchase orders found</p>
            <p className="empty-state-text">Purchase orders will appear here when OLL creates them for you</p>
          </div>
        ) : (
          <Tabs defaultValue="confirmation" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-auto p-1">
              <TabsTrigger value="confirmation" className="py-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <div className="flex flex-col items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>PO Confirmation</span>
                  <span className="text-xs opacity-70">({categorizedOrders.pending.length + categorizedOrders.confirmed.length + categorizedOrders.rejected.length})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="dispatched" className="py-3 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                <div className="flex flex-col items-center gap-1">
                  <Truck className="w-4 h-4" />
                  <span>Dispatched</span>
                  <span className="text-xs opacity-70">({categorizedOrders.dispatched.length + categorizedOrders.pending_approval.length})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="delivered" className="py-3 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <div className="flex flex-col items-center gap-1">
                  <Package className="w-4 h-4" />
                  <span>Delivered</span>
                  <span className="text-xs opacity-70">({categorizedOrders.delivered.length})</span>
                </div>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="confirmation" className="space-y-4">
              {renderSubSection(
                "Pending Confirmation",
                categorizedOrders.pending,
                "pending",
                <Clock className="w-4 h-4 text-blue-600" />,
                "bg-blue-100"
              )}
              {renderSubSection(
                "Confirmed",
                categorizedOrders.confirmed,
                "confirmed",
                <Check className="w-4 h-4 text-indigo-600" />,
                "bg-indigo-100"
              )}
              {renderSubSection(
                "Rejected",
                categorizedOrders.rejected,
                "rejected",
                <Circle className="w-4 h-4 text-red-600" />,
                "bg-red-100"
              )}
            </TabsContent>

            <TabsContent value="dispatched" className="space-y-4">
              {renderSubSection(
                "In Transit",
                categorizedOrders.dispatched,
                "dispatched",
                <Truck className="w-4 h-4 text-amber-600" />,
                "bg-amber-100"
              )}
              {renderSubSection(
                "Pending OLL Approval",
                categorizedOrders.pending_approval,
                "pending_approval",
                <Clock className="w-4 h-4 text-purple-600" />,
                "bg-purple-100"
              )}
            </TabsContent>

            <TabsContent value="delivered" className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="p-4 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Package className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="font-medium text-slate-700">Completed Deliveries</span>
                    <span className="text-sm text-slate-500">({categorizedOrders.delivered.length})</span>
                  </div>
                </div>
                <div className="p-4 border-t">
                  {renderDeliveredTable(categorizedOrders.delivered)}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Delivery & Invoice Dialog */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <strong>Important:</strong> Invoice, delivery proof, and logistics details are required.
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
              <Label className="form-label">Upload Invoice *</Label>
              <div className="mt-1 flex items-center gap-3">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, invoice_file: e.target.files[0] }))}
                  className="text-sm"
                  required
                />
                {deliveryForm.invoice_file && (
                  <span className="text-xs text-emerald-600">✓ {deliveryForm.invoice_file.name}</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Required: Upload invoice PDF or image</p>
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
              <Label className="form-label">Delivery Proof Image *</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, delivery_proof_file: e.target.files[0] }))}
                  className="text-sm"
                  required
                />
                {deliveryForm.delivery_proof_file && (
                  <span className="text-xs text-emerald-600">✓ {deliveryForm.delivery_proof_file.name}</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Upload photo proof of delivery (required)</p>
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

      {/* View Invoice Dialog */}
      <Dialog open={viewInvoiceDialog} onOpenChange={setViewInvoiceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              Invoice Details
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Invoice Number</p>
                  <p className="font-mono font-medium">{selectedInvoice.invoice_number}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Invoice Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.invoice_date)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">PO Number</p>
                  <p className="font-mono">{selectedInvoice.po_number || "-"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Due Date</p>
                  <p className="font-medium">{selectedInvoice.due_date ? formatDate(selectedInvoice.due_date) : "-"}</p>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">Invoice Amount</span>
                  <span className="font-mono font-medium">{formatCurrency(selectedInvoice.amount)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">Logistics Cost</span>
                  <span className="font-mono">{formatCurrency(selectedInvoice.logistics_cost || 0)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">Paid Amount</span>
                  <span className="font-mono text-emerald-600">{formatCurrency(selectedInvoice.paid_amount || 0)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-medium">
                  <span>Outstanding</span>
                  <span className="font-mono text-amber-600">{formatCurrency(selectedInvoice.amount - (selectedInvoice.paid_amount || 0))}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className={`badge ${
                  selectedInvoice.payment_status === "fully_paid" ? "bg-emerald-100 text-emerald-700" :
                  selectedInvoice.payment_status === "partially_paid" ? "bg-amber-100 text-amber-700" :
                  "bg-blue-100 text-blue-700"
                }`}>
                  {selectedInvoice.payment_status === "fully_paid" ? "Cleared" :
                   selectedInvoice.payment_status === "partially_paid" ? "Partially Paid" : "Pending"}
                </span>
              </div>

              {/* Invoice Document */}
              {selectedInvoice.file_url && (
                <div className="p-4 border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-emerald-800">Invoice Document</p>
                        <p className="text-xs text-emerald-600">Uploaded document</p>
                      </div>
                    </div>
                    <a 
                      href={selectedInvoice.file_url} 
                      download={`Invoice-${selectedInvoice.invoice_number}.pdf`}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
              )}

              {selectedInvoice.notes && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600 mb-1">Notes</p>
                  <p className="text-sm text-amber-800">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewInvoiceDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject PO Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <X className="w-5 h-5" />
              Reject Purchase Order
            </DialogTitle>
            <DialogDescription>
              Please select a reason for rejecting PO {selectedRejectPO?.po_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="form-label mb-2 block">Reason for Rejection *</Label>
              <Select
                value={selectedRejectReason}
                onValueChange={setSelectedRejectReason}
              >
                <SelectTrigger data-testid="reject-reason-select">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {rejectReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedRejectReason === "Other (specify below)" && (
              <div>
                <Label className="form-label mb-2 block">Custom Reason</Label>
                <Textarea
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  placeholder="Enter your reason..."
                  rows={3}
                  data-testid="custom-reject-reason"
                />
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Once rejected, OLL admin will be notified and may contact you for clarification.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejecting || (!selectedRejectReason || (selectedRejectReason === "Other (specify below)" && !customRejectReason.trim()))}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-reject-btn"
            >
              {rejecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Reject PO
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
