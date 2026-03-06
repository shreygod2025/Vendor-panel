import { useState, useEffect } from "react";
import { apiClient, useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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
import { Card, CardContent } from "../components/ui/card";
import { Plus, CreditCard, Loader2, Wallet, Info, Eye, Receipt, Download, FileText } from "lucide-react";
import { toast } from "sonner";

const PaymentsList = () => {
  const { user } = useAuth();
  const isOLL = user?.role === "oll";
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [vendorCredits, setVendorCredits] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  
  const [formData, setFormData] = useState({
    amount: "",
    payment_date: "",
    payment_mode: "",
    reference_id: "",
    notes: "",
    use_credit: false,
    credit_amount: ""
  });

  // View Payment/Invoice dialog state
  const [viewDialog, setViewDialog] = useState(false);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, invoicesRes] = await Promise.all([
        apiClient.get("/payments"),
        apiClient.get("/invoices")
      ]);
      setPayments(paymentsRes.data);
      setInvoices(invoicesRes.data);

      // Fetch vendor credits for OLL users
      if (isOLL) {
        try {
          const creditsRes = await apiClient.get("/credits/by-vendor");
          const creditsMap = {};
          creditsRes.data.forEach(c => {
            creditsMap[c.vendor_id] = c;
          });
          setVendorCredits(creditsMap);
        } catch (e) {
          console.log("Could not fetch vendor credits");
        }
      }
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedInvoices.length === 0) {
      toast.error("Please select at least one invoice");
      return;
    }

    if (!formData.payment_date) {
      toast.error("Please select a payment date");
      return;
    }

    if (!formData.payment_mode) {
      toast.error("Please select a payment mode");
      return;
    }

    if (!formData.reference_id) {
      toast.error("Please enter a reference ID");
      return;
    }
    
    setSaving(true);
    
    try {
      // Record payment for each selected invoice
      for (const invoice of selectedInvoices) {
        const invoiceTotal = invoice.amount + (invoice.logistics_cost || 0);
        const invoicePending = invoiceTotal - (invoice.paid_amount || 0);
        
        if (invoicePending > 0) {
          await apiClient.post("/payments", {
            invoice_id: invoice.id,
            amount: invoicePending,
            payment_date: formData.payment_date,
            payment_mode: formData.payment_mode,
            reference_id: formData.reference_id,
            notes: formData.notes || `Payment for ${selectedInvoices.length} invoices`
          });
        }
      }
      
      toast.success(`Payment recorded for ${selectedInvoices.length} invoice(s)`);
      setShowDialog(false);
      setFormData({
        amount: "",
        payment_date: "",
        payment_mode: "",
        reference_id: "",
        notes: "",
        use_credit: false,
        credit_amount: ""
      });
      setSelectedInvoices([]);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const toggleInvoiceSelection = (invoice) => {
    setSelectedInvoices(prev => {
      const isSelected = prev.some(inv => inv.id === invoice.id);
      if (isSelected) {
        return prev.filter(inv => inv.id !== invoice.id);
      } else {
        return [...prev, invoice];
      }
    });
  };

  const getTotalPendingAmount = () => {
    return selectedInvoices.reduce((sum, inv) => {
      const total = inv.amount + (inv.logistics_cost || 0);
      const paid = inv.paid_amount || 0;
      return sum + (total - paid);
    }, 0);
  };

  const getVendorCredit = () => {
    if (selectedInvoices.length === 0) return null;
    // Get credit for the first selected invoice's vendor
    const vendorId = selectedInvoices[0].vendor_id;
    return vendorCredits[vendorId];
  };

  const openViewPayment = (payment) => {
    const invoice = payment.invoice_id ? invoices.find(inv => inv.id === payment.invoice_id) : null;
    setViewingPayment(payment);
    setViewingInvoice(invoice);
    setViewDialog(true);
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

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-700",
      partially_paid: "bg-blue-100 text-blue-700",
      fully_paid: "bg-emerald-100 text-emerald-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  return (
    <div data-testid="payments-list-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Payments</h1>
            <p className="page-subtitle">Track payment records</p>
          </div>
          {isOLL && (
            <Button 
              className="bg-[#1e3a8a] hover:bg-[#1e40af]" 
              onClick={() => setShowDialog(true)}
              data-testid="record-payment-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="page-container">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-state py-12">
              <CreditCard className="empty-state-icon" />
              <p className="empty-state-title">No payments found</p>
              <p className="empty-state-text">
                {isOLL ? "Record your first payment" : "Payments will appear here when recorded"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const invoice = payment.invoice_id ? invoices.find(inv => inv.id === payment.invoice_id) : null;
                  const isCredit = payment.payment_type === "credit";
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">
                        {isCredit ? (
                          <span className="text-purple-600">Credit Note</span>
                        ) : (
                          invoice?.invoice_number || (payment.invoice_id ? payment.invoice_id.slice(0, 8) + "..." : "-")
                        )}
                      </TableCell>
                      <TableCell className={`font-mono font-medium ${isCredit ? 'text-purple-600' : 'text-emerald-600'}`}>
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell className="capitalize">{payment.payment_mode}</TableCell>
                      <TableCell className="font-mono text-sm">{payment.reference_id || "-"}</TableCell>
                      <TableCell>
                        <span className={`badge ${getStatusColor(payment.payment_status)}`}>
                          {payment.payment_status?.replace('_', ' ') || 'completed'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewPayment(payment)}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {invoice?.file_url ? (
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

      {/* Record Payment Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          setSelectedInvoices([]);
          setFormData({
            amount: "",
            payment_date: "",
            payment_mode: "",
            reference_id: "",
            notes: "",
            use_credit: false,
            credit_amount: ""
          });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Invoice Selection - Multi Select */}
            <div>
              <Label className="mb-2 block">Select Invoices to Pay</Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {invoices.filter(inv => {
                  const total = inv.amount + (inv.logistics_cost || 0);
                  const pending = total - (inv.paid_amount || 0);
                  return pending > 0;
                }).length === 0 ? (
                  <div className="p-4 text-center text-slate-500">
                    No pending invoices found
                  </div>
                ) : (
                  invoices.filter(inv => {
                    const total = inv.amount + (inv.logistics_cost || 0);
                    const pending = total - (inv.paid_amount || 0);
                    return pending > 0;
                  }).map((inv) => {
                    const total = inv.amount + (inv.logistics_cost || 0);
                    const pending = total - (inv.paid_amount || 0);
                    const isSelected = selectedInvoices.some(s => s.id === inv.id);
                    
                    return (
                      <div 
                        key={inv.id}
                        className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}
                        onClick={() => toggleInvoiceSelection(inv)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-medium">{inv.invoice_number}</span>
                            <span className="text-sm text-slate-500">{inv.vendor_name}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-sm">
                            <span className="text-slate-500">
                              Total: {formatCurrency(total)}
                              {inv.logistics_cost > 0 && <span className="text-orange-500 ml-1">(+{formatCurrency(inv.logistics_cost)} logistics)</span>}
                            </span>
                            <span className="font-medium text-amber-600">Pending: {formatCurrency(pending)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {selectedInvoices.length > 0 && (
                <p className="text-sm text-blue-600 mt-2">
                  {selectedInvoices.length} invoice(s) selected
                </p>
              )}
            </div>

            {/* Show vendor credit if available */}
            {selectedInvoices.length > 0 && getVendorCredit()?.available_credit > 0 && (
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Wallet className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-purple-800">Vendor Credit Available</span>
                        <span className="font-mono font-bold text-purple-700">
                          {formatCurrency(getVendorCredit()?.available_credit || 0)}
                        </span>
                      </div>
                      <p className="text-xs text-purple-600 mt-1">
                        {getVendorCredit()?.vendor_name} has unused credit from returns
                      </p>
                      
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="use_credit"
                          checked={formData.use_credit}
                          onChange={(e) => {
                            const useCredit = e.target.checked;
                            const availableCredit = getVendorCredit()?.available_credit || 0;
                            const pendingAmount = getTotalPendingAmount();
                            const creditToUse = Math.min(availableCredit, pendingAmount);
                            
                            setFormData(prev => ({
                              ...prev,
                              use_credit: useCredit,
                              credit_amount: useCredit ? creditToUse.toString() : "",
                              amount: useCredit ? Math.max(0, pendingAmount - creditToUse).toString() : ""
                            }));
                          }}
                          className="h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                        />
                        <label htmlFor="use_credit" className="text-sm text-purple-700">
                          Use credit for this payment
                        </label>
                      </div>
                      
                      {formData.use_credit && (
                        <div className="mt-2">
                          <Label className="text-purple-700">Credit Amount to Use</Label>
                          <Input
                            type="number"
                            step="0.01"
                            max={Math.min(getVendorCredit()?.available_credit || 0, getTotalPendingAmount())}
                            value={formData.credit_amount}
                            onChange={(e) => {
                              const creditAmt = parseFloat(e.target.value) || 0;
                              const pendingAmount = getTotalPendingAmount();
                              setFormData(prev => ({
                                ...prev,
                                credit_amount: e.target.value,
                                amount: Math.max(0, pendingAmount - creditAmt).toString()
                              }));
                            }}
                            className="mt-1 bg-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Summary */}
            {selectedInvoices.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-slate-700 mb-3">Payment Summary</h4>
                <div className="space-y-2 text-sm">
                  {selectedInvoices.map(inv => {
                    const total = inv.amount + (inv.logistics_cost || 0);
                    const pending = total - (inv.paid_amount || 0);
                    return (
                      <div key={inv.id} className="flex justify-between">
                        <span className="text-slate-600">{inv.invoice_number}:</span>
                        <span className="font-mono">{formatCurrency(pending)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between font-bold pt-2 border-t border-slate-300">
                    <span>Total Pending:</span>
                    <span className="font-mono text-amber-600">{formatCurrency(getTotalPendingAmount())}</span>
                  </div>
                  {formData.use_credit && parseFloat(formData.credit_amount) > 0 && (
                    <>
                      <div className="flex justify-between text-purple-600">
                        <span>Credit Applied:</span>
                        <span className="font-mono">-{formatCurrency(parseFloat(formData.credit_amount))}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-600">
                        <span>Amount to Pay:</span>
                        <span className="font-mono">{formatCurrency(Math.max(0, getTotalPendingAmount() - parseFloat(formData.credit_amount)))}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Only show payment fields if there's remaining amount after credit */}
            {selectedInvoices.length > 0 && (!formData.use_credit || (formData.use_credit && parseFloat(formData.amount) > 0)) && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Payment Amount (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount || getTotalPendingAmount()}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      required={!formData.use_credit || parseFloat(formData.credit_amount) < getTotalPendingAmount()}
                    />
                  </div>
                  <div>
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={formData.payment_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Payment Mode</Label>
                    <Select value={formData.payment_mode} onValueChange={(v) => setFormData(prev => ({ ...prev, payment_mode: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="neft">NEFT</SelectItem>
                        <SelectItem value="rtgs">RTGS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reference ID *</Label>
                    <Input
                      value={formData.reference_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, reference_id: e.target.value }))}
                      required
                      placeholder="Transaction / UTR Number"
                    />
                  </div>
                </div>
              </>
            )}
            
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button 
                type="submit" 
                className="bg-[#1e3a8a] hover:bg-[#1e40af]" 
                disabled={saving || selectedInvoices.length === 0 || (!formData.use_credit && !formData.payment_mode)}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Record Payment {selectedInvoices.length > 1 ? `(${selectedInvoices.length} invoices)` : ''}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Payment Details Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              Payment & Invoice Details
            </DialogTitle>
          </DialogHeader>
          {viewingPayment && (
            <div className="space-y-4">
              {/* Payment Details */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <h4 className="font-medium text-emerald-800 mb-3">Payment Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-emerald-600">Amount Paid</p>
                    <p className="font-mono font-medium">{formatCurrency(viewingPayment.amount)}</p>
                  </div>
                  <div>
                    <p className="text-emerald-600">Payment Date</p>
                    <p className="font-medium">{formatDate(viewingPayment.payment_date)}</p>
                  </div>
                  <div>
                    <p className="text-emerald-600">Payment Mode</p>
                    <p className="font-medium capitalize">{viewingPayment.payment_mode}</p>
                  </div>
                  <div>
                    <p className="text-emerald-600">Reference ID</p>
                    <p className="font-mono text-sm">{viewingPayment.reference_id || "-"}</p>
                  </div>
                </div>
                {viewingPayment.notes && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <p className="text-emerald-600 text-sm">Notes</p>
                    <p className="text-sm text-emerald-800 mt-1">{viewingPayment.notes}</p>
                  </div>
                )}
              </div>

              {/* Invoice Details */}
              {viewingInvoice && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-slate-800 mb-3">Invoice Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Invoice Number</p>
                      <p className="font-mono font-medium">{viewingInvoice.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Invoice Date</p>
                      <p className="font-medium">{formatDate(viewingInvoice.invoice_date)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Total Amount</p>
                      <p className="font-mono">{formatCurrency(viewingInvoice.amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Outstanding</p>
                      <p className="font-mono text-amber-600">
                        {formatCurrency(viewingInvoice.amount - (viewingInvoice.paid_amount || 0))}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Invoice Document Download */}
              {viewingInvoice?.file_url && (
                <div className="p-4 border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-emerald-600" />
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

              {viewingPayment.notes && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600 mb-1">Notes</p>
                  <p className="text-sm text-amber-800">{viewingPayment.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentsList;
