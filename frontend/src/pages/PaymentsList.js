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
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  const [formData, setFormData] = useState({
    invoice_id: "",
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
    setSaving(true);
    
    try {
      // If using credit, first record the credit payment
      if (formData.use_credit && parseFloat(formData.credit_amount) > 0) {
        await apiClient.post("/payments", {
          invoice_id: formData.invoice_id,
          amount: parseFloat(formData.credit_amount),
          payment_date: formData.payment_date,
          payment_mode: "credit",
          reference_id: `CREDIT-${Date.now()}`,
          notes: "Payment via vendor credit"
        });
      }
      
      // If there's also a cash/bank payment
      if (parseFloat(formData.amount) > 0 && formData.payment_mode !== "credit") {
        await apiClient.post("/payments", {
          invoice_id: formData.invoice_id,
          amount: parseFloat(formData.amount),
          payment_date: formData.payment_date,
          payment_mode: formData.payment_mode,
          reference_id: formData.reference_id,
          notes: formData.notes
        });
      }
      
      toast.success("Payment recorded successfully");
      setShowDialog(false);
      setFormData({
        invoice_id: "",
        amount: "",
        payment_date: "",
        payment_mode: "",
        reference_id: "",
        notes: "",
        use_credit: false,
        credit_amount: ""
      });
      setSelectedInvoice(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const handleInvoiceSelect = (invoiceId) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    setSelectedInvoice(invoice);
    setFormData(prev => ({ 
      ...prev, 
      invoice_id: invoiceId,
      use_credit: false,
      credit_amount: ""
    }));
  };

  const getVendorCredit = () => {
    if (!selectedInvoice) return null;
    return vendorCredits[selectedInvoice.vendor_id];
  };

  const getPendingAmount = () => {
    if (!selectedInvoice) return 0;
    return selectedInvoice.amount - (selectedInvoice.paid_amount || 0);
  };

  const openViewPayment = (payment) => {
    const invoice = invoices.find(inv => inv.id === payment.invoice_id);
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
                  <TableHead>Invoice ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-sm">{payment.invoice_id.slice(0, 8)}...</TableCell>
                    <TableCell className="font-mono font-medium text-emerald-600">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell>{formatDate(payment.payment_date)}</TableCell>
                    <TableCell className="capitalize">{payment.payment_mode}</TableCell>
                    <TableCell className="font-mono text-sm">{payment.reference_id}</TableCell>
                    <TableCell>
                      <span className={`badge ${getStatusColor(payment.payment_status)}`}>
                        {payment.payment_status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openViewPayment(payment)}
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          setSelectedInvoice(null);
          setFormData({
            invoice_id: "",
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Invoice</Label>
              <Select value={formData.invoice_id} onValueChange={handleInvoiceSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.filter(inv => (inv.amount - (inv.paid_amount || 0)) > 0).map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {formatCurrency(inv.amount)} (Pending: {formatCurrency(inv.amount - (inv.paid_amount || 0))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show vendor credit if available */}
            {selectedInvoice && getVendorCredit()?.available_credit > 0 && (
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
                            const pendingAmount = getPendingAmount();
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
                            max={Math.min(getVendorCredit()?.available_credit || 0, getPendingAmount())}
                            value={formData.credit_amount}
                            onChange={(e) => {
                              const creditAmt = parseFloat(e.target.value) || 0;
                              const pendingAmount = getPendingAmount();
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
            {selectedInvoice && (
              <div className="p-3 bg-slate-50 rounded-lg text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Invoice Amount:</span>
                  <span className="font-mono">{formatCurrency(selectedInvoice.amount)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Already Paid:</span>
                  <span className="font-mono">{formatCurrency(selectedInvoice.paid_amount || 0)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1 mt-1">
                  <span>Pending Amount:</span>
                  <span className="font-mono text-amber-600">{formatCurrency(getPendingAmount())}</span>
                </div>
                {formData.use_credit && parseFloat(formData.credit_amount) > 0 && (
                  <>
                    <div className="flex justify-between text-purple-600 mt-1">
                      <span>Credit Applied:</span>
                      <span className="font-mono">-{formatCurrency(parseFloat(formData.credit_amount))}</span>
                    </div>
                    <div className="flex justify-between font-medium text-emerald-600">
                      <span>Remaining to Pay:</span>
                      <span className="font-mono">{formatCurrency(Math.max(0, getPendingAmount() - parseFloat(formData.credit_amount)))}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Only show payment fields if there's remaining amount after credit */}
            {(!formData.use_credit || (formData.use_credit && parseFloat(formData.amount) > 0)) && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Payment Amount (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      required={!formData.use_credit || parseFloat(formData.credit_amount) < getPendingAmount()}
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
                    <Label>Reference ID</Label>
                    <Input
                      value={formData.reference_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, reference_id: e.target.value }))}
                      required={!formData.use_credit || parseFloat(formData.credit_amount) < getPendingAmount()}
                      placeholder="Transaction ID"
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
                disabled={saving || (!formData.use_credit && !formData.amount)}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentsList;
