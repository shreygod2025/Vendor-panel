import { useState, useEffect } from "react";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
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
import { Plus, Receipt, Loader2 } from "lucide-react";
import { toast } from "sonner";

const VendorInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    po_id: "",
    invoice_number: "",
    invoice_date: "",
    amount: "",
    file_url: "",
    notes: ""
  });

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

  return (
    <div data-testid="vendor-invoices-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Invoices</h1>
            <p className="page-subtitle">Upload and manage your invoices</p>
          </div>
          <Button 
            className="bg-[#1e3a8a] hover:bg-[#1e40af]" 
            onClick={() => setShowDialog(true)}
            data-testid="upload-invoice-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Upload Invoice
          </Button>
        </div>
      </div>

      <div className="page-container">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : invoices.length === 0 ? (
            <div className="empty-state py-12">
              <Receipt className="empty-state-icon" />
              <p className="empty-state-title">No invoices found</p>
              <p className="empty-state-text">Upload your first invoice</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell className="font-mono text-sm">{invoice.po_number || invoice.po_id?.slice(0, 8) + '...'}</TableCell>
                    <TableCell>{invoice.invoice_date}</TableCell>
                    <TableCell className="font-mono font-medium">{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell>
                      <span className={`badge ${
                        invoice.payment_status === 'fully_paid' ? 'bg-emerald-100 text-emerald-700' :
                        invoice.payment_status === 'partially_paid' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {invoice.payment_status === 'fully_paid' ? 'Paid' :
                         invoice.payment_status === 'partially_paid' ? 'Partially Paid' :
                         'Pending'}
                      </span>
                      {invoice.payment_status === 'partially_paid' && invoice.paid_amount && (
                        <span className="text-xs text-slate-500 block mt-1">
                          Paid: {formatCurrency(invoice.paid_amount)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(invoice.created_at)}</TableCell>
                  </TableRow>
                ))}
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
                placeholder="https://drive.google.com/..."
              />
              <p className="text-xs text-slate-500 mt-1">Upload to Google Drive and paste the link</p>
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
    </div>
  );
};

export default VendorInvoices;
