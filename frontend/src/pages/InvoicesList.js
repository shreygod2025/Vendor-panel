import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient, useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Plus, Receipt, Loader2, Clock, CheckCircle, AlertTriangle, DollarSign, Eye, MoreHorizontal, FileWarning, Download } from "lucide-react";
import { toast } from "sonner";

const InvoicesList = () => {
  const { user } = useAuth();
  const isOLL = user?.role === "oll";
  const [invoices, setInvoices] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    po_id: "",
    invoice_number: "",
    invoice_date: "",
    amount: "",
    file_url: "",
    notes: ""
  });

  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_mode: "neft",
    reference_id: "",
    notes: ""
  });

  // View invoice dialog state
  const [viewInvoiceDialog, setViewInvoiceDialog] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);

  // Raise issue dialog state
  const [issueDialog, setIssueDialog] = useState(false);
  const [issueInvoice, setIssueInvoice] = useState(null);
  const [issueForm, setIssueForm] = useState({
    issue_type: "invoice_error",
    description: "",
    priority: "medium"
  });
  const [raisingIssue, setRaisingIssue] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesRes, posRes] = await Promise.all([
        apiClient.get("/invoices"),
        apiClient.get("/purchase-orders")
      ]);
      setInvoices(invoicesRes.data);
      setPurchaseOrders(posRes.data.filter(po => 
        ["delivered", "closed"].includes(po.status)
      ));
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/invoices", {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      toast.success("Invoice uploaded successfully");
      setShowDialog(false);
      setFormData({
        po_id: "",
        invoice_number: "",
        invoice_date: "",
        amount: "",
        file_url: "",
        notes: ""
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload invoice");
    } finally {
      setSaving(false);
    }
  };

  const openPaymentDialog = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: invoice.amount - (invoice.paid_amount || 0),
      payment_mode: "neft",
      reference_id: "",
      notes: ""
    });
    setShowPaymentDialog(true);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/payments", {
        invoice_id: selectedInvoice.id,
        po_id: selectedInvoice.po_id,
        amount: parseFloat(paymentData.amount),
        payment_mode: paymentData.payment_mode,
        reference_id: paymentData.reference_id,
        notes: paymentData.notes
      });
      toast.success("Payment recorded successfully");
      setShowPaymentDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const openViewInvoice = (invoice) => {
    setViewingInvoice(invoice);
    setViewInvoiceDialog(true);
  };

  const openIssueDialog = (invoice) => {
    setIssueInvoice(invoice);
    setIssueForm({
      issue_type: "invoice_error",
      description: "",
      priority: "medium"
    });
    setIssueDialog(true);
  };

  const handleRaiseIssue = async (e) => {
    e.preventDefault();
    if (!issueForm.description.trim()) {
      toast.error("Please enter issue description");
      return;
    }
    
    setRaisingIssue(true);
    try {
      await apiClient.post("/issues", {
        po_id: issueInvoice.po_id,
        issue_type: issueForm.issue_type,
        description: `Invoice Error - ${issueInvoice.invoice_number}: ${issueForm.description}`,
        priority: issueForm.priority,
        affected_items: []
      });
      toast.success("Issue raised successfully");
      setIssueDialog(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to raise issue");
    } finally {
      setRaisingIssue(false);
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
      day: 'numeric'
    });
  };

  // Calculate invoice status and overdue
  const getInvoiceStatus = (invoice) => {
    const invoiceDate = new Date(invoice.invoice_date);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 7); // 7 days to clear
    const today = new Date();
    
    const paidAmount = invoice.paid_amount || 0;
    const totalAmount = invoice.amount;
    
    if (paidAmount >= totalAmount) {
      return { status: "cleared", label: "Cleared", color: "bg-emerald-100 text-emerald-700" };
    } else if (today > dueDate) {
      return { status: "overdue", label: "Overdue", color: "bg-red-100 text-red-700" };
    } else if (paidAmount > 0) {
      return { status: "partial", label: "Partially Paid", color: "bg-amber-100 text-amber-700" };
    } else {
      return { status: "pending", label: "Pending", color: "bg-blue-100 text-blue-700" };
    }
  };

  const getDaysRemaining = (invoice) => {
    const invoiceDate = new Date(invoice.invoice_date);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 7);
    const today = new Date();
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Summary stats
  const stats = {
    total: invoices.length,
    pending: invoices.filter(i => getInvoiceStatus(i).status === "pending").length,
    overdue: invoices.filter(i => getInvoiceStatus(i).status === "overdue").length,
    cleared: invoices.filter(i => getInvoiceStatus(i).status === "cleared").length,
    totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0),
    pendingAmount: invoices.reduce((sum, i) => sum + i.amount - (i.paid_amount || 0), 0)
  };

  return (
    <div data-testid="invoices-list-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Invoices</h1>
            <p className="page-subtitle">Manage invoices and payments</p>
          </div>
          {!isOLL && (
            <Button 
              className="bg-[#1e3a8a] hover:bg-[#1e40af]" 
              onClick={() => setShowDialog(true)}
              data-testid="upload-invoice-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Upload Invoice
            </Button>
          )}
        </div>
      </div>

      <div className="page-container">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                  <p className="text-xs text-slate-500">Total Invoices</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
                  <p className="text-xs text-slate-500">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.overdue}</p>
                  <p className="text-xs text-slate-500">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.cleared}</p>
                  <p className="text-xs text-slate-500">Cleared</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Amount Banner */}
        {stats.pendingAmount > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Total Pending Amount</p>
                <p className="text-sm text-amber-600">Invoices need to be cleared within 7 days of invoice date</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(stats.pendingAmount)}</p>
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : invoices.length === 0 ? (
            <div className="empty-state py-12">
              <Receipt className="empty-state-icon" />
              <p className="empty-state-title">No invoices found</p>
              <p className="empty-state-text">
                {isOLL ? "Invoices will appear when vendors upload them" : "Upload your first invoice"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Logistics</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const statusInfo = getInvoiceStatus(invoice);
                  const daysRemaining = getDaysRemaining(invoice);
                  const paidAmount = invoice.paid_amount || 0;
                  const logisticsCost = invoice.logistics_cost || 0;
                  const totalAmount = invoice.amount + logisticsCost;
                  
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        <Link to={`/oll/purchase-orders/${invoice.po_id}`} className="font-mono text-sm text-blue-600 hover:underline">
                          {invoice.po_number || invoice.po_id?.slice(0, 8) + "..."}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.vendor_name || "-"}</TableCell>
                      <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell className="font-mono text-orange-600">{logisticsCost > 0 ? formatCurrency(logisticsCost) : "-"}</TableCell>
                      <TableCell className="font-mono font-medium">{formatCurrency(totalAmount)}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(paidAmount)}</TableCell>
                      <TableCell>
                        <span className={`badge ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {statusInfo.status === "cleared" ? (
                          <span className="text-sm text-emerald-600">✓ Completed</span>
                        ) : statusInfo.status === "overdue" ? (
                          <span className="text-sm text-red-600 font-medium">
                            {Math.abs(daysRemaining)} days overdue
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">
                            {daysRemaining} days remaining
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewInvoice(invoice)}
                            title="View Invoice"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {invoice.file_url ? (
                            <a
                              href={invoice.file_url}
                              download={`Invoice-${invoice.invoice_number}.pdf`}
                              title="Download Invoice"
                            >
                              <Button variant="ghost" size="sm" className="text-emerald-600">
                                <Download className="w-4 h-4" />
                              </Button>
                            </a>
                          ) : (
                            <Button variant="ghost" size="sm" disabled title="No document attached">
                              <Download className="w-4 h-4 opacity-30" />
                            </Button>
                          )}
                          {isOLL && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {statusInfo.status !== "cleared" && (
                                  <DropdownMenuItem onClick={() => openPaymentDialog(invoice)}>
                                    <DollarSign className="w-4 h-4 mr-2" />
                                    Record Payment
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => openIssueDialog(invoice)}>
                                  <FileWarning className="w-4 h-4 mr-2" />
                                  Raise Issue
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`/oll/purchase-orders/${invoice.po_id}`} className="flex items-center">
                                    <Receipt className="w-4 h-4 mr-2" />
                                    View PO
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Upload Invoice Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Purchase Order</Label>
              <Select value={formData.po_id} onValueChange={(v) => setFormData(prev => ({ ...prev, po_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PO" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>{po.po_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Number</Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>File URL (Optional)</Label>
              <Input
                value={formData.file_url}
                onChange={(e) => setFormData(prev => ({ ...prev, file_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#1e3a8a] hover:bg-[#1e40af]" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Upload Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-medium">{selectedInvoice?.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">Outstanding:</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(selectedInvoice?.amount - (selectedInvoice?.paid_amount || 0))}
                </span>
              </div>
            </div>
            <div>
              <Label>Payment Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentData.amount}
                onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={paymentData.payment_mode} onValueChange={(v) => setPaymentData(prev => ({ ...prev, payment_mode: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neft">NEFT</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference ID</Label>
              <Input
                value={paymentData.reference_id}
                onChange={(e) => setPaymentData(prev => ({ ...prev, reference_id: e.target.value }))}
                placeholder="Transaction reference number"
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={paymentData.notes}
                onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={viewInvoiceDialog} onOpenChange={setViewInvoiceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Invoice Details
            </DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Invoice Number</p>
                  <p className="font-mono font-medium">{viewingInvoice.invoice_number}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Invoice Date</p>
                  <p className="font-medium">{formatDate(viewingInvoice.invoice_date)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">PO Number</p>
                  <p className="font-mono">{viewingInvoice.po_number || viewingInvoice.po_id?.slice(0, 8) + "..."}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Vendor</p>
                  <p className="font-medium">{viewingInvoice.vendor_name || "-"}</p>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">Invoice Amount</span>
                  <span className="font-mono font-medium">{formatCurrency(viewingInvoice.amount)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">Logistics Cost</span>
                  <span className="font-mono">{formatCurrency(viewingInvoice.logistics_cost || 0)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">Paid Amount</span>
                  <span className="font-mono text-emerald-600">{formatCurrency(viewingInvoice.paid_amount || 0)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-medium">
                  <span>Outstanding</span>
                  <span className="font-mono text-amber-600">{formatCurrency(viewingInvoice.amount - (viewingInvoice.paid_amount || 0))}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className={`badge ${getInvoiceStatus(viewingInvoice).color}`}>
                  {getInvoiceStatus(viewingInvoice).label}
                </span>
              </div>

              {/* Invoice Document */}
              {viewingInvoice.file_url && (
                <div className="p-4 border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-emerald-800">Invoice Document</p>
                        <p className="text-xs text-emerald-600">Uploaded by vendor</p>
                      </div>
                    </div>
                    <a 
                      href={viewingInvoice.file_url} 
                      download={`Invoice-${viewingInvoice.invoice_number}.pdf`}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
              )}

              {viewingInvoice.notes && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600 mb-1">Notes</p>
                  <p className="text-sm text-amber-800">{viewingInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewInvoiceDialog(false)}>Close</Button>
            {isOLL && viewingInvoice && (
              <Link to={`/oll/purchase-orders/${viewingInvoice.po_id}`}>
                <Button>View Purchase Order</Button>
              </Link>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raise Issue Dialog */}
      <Dialog open={issueDialog} onOpenChange={setIssueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-amber-600" />
              Raise Invoice Issue
            </DialogTitle>
            <DialogDescription>
              Report an error or issue with invoice {issueInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRaiseIssue} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-medium">{issueInvoice?.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">Vendor:</span>
                <span className="font-medium">{issueInvoice?.vendor_name || "-"}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">Amount:</span>
                <span className="font-mono">{formatCurrency(issueInvoice?.amount || 0)}</span>
              </div>
            </div>
            
            <div>
              <Label>Issue Type</Label>
              <Select value={issueForm.issue_type} onValueChange={(v) => setIssueForm(prev => ({ ...prev, issue_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice_error">Invoice Error</SelectItem>
                  <SelectItem value="amount_mismatch">Amount Mismatch</SelectItem>
                  <SelectItem value="wrong_details">Wrong Details</SelectItem>
                  <SelectItem value="duplicate_invoice">Duplicate Invoice</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select value={issueForm.priority} onValueChange={(v) => setIssueForm(prev => ({ ...prev, priority: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea
                value={issueForm.description}
                onChange={(e) => setIssueForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the issue with this invoice..."
                rows={3}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIssueDialog(false)}>Cancel</Button>
              <Button 
                type="submit" 
                className="bg-amber-600 hover:bg-amber-700" 
                disabled={raisingIssue}
              >
                {raisingIssue ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileWarning className="w-4 h-4 mr-2" />}
                Raise Issue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoicesList;
