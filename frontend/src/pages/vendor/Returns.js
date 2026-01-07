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
import { RotateCcw, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

const VendorReturns = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showCreditNoteDialog, setShowCreditNoteDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [creditNoteItems, setCreditNoteItems] = useState([]);
  const [creditNoteTotal, setCreditNoteTotal] = useState(0);

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      const response = await apiClient.get("/returns");
      setReturns(response.data);
    } catch (error) {
      toast.error("Failed to fetch returns");
    } finally {
      setLoading(false);
    }
  };

  const openCreditNoteDialog = (ret) => {
    setSelectedReturn(ret);
    const items = ret.items.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: 0,
      total: 0
    }));
    setCreditNoteItems(items);
    setCreditNoteTotal(0);
    setShowCreditNoteDialog(true);
  };

  const updateItemPrice = (index, price) => {
    const newItems = [...creditNoteItems];
    newItems[index].price = parseFloat(price) || 0;
    newItems[index].total = newItems[index].quantity * newItems[index].price;
    setCreditNoteItems(newItems);
    setCreditNoteTotal(newItems.reduce((sum, item) => sum + item.total, 0));
  };

  const handleCreateCreditNote = async () => {
    setSaving(true);
    try {
      await apiClient.post("/credit-notes", {
        return_id: selectedReturn.id,
        items: creditNoteItems,
        total_value: creditNoteTotal,
        notes: ""
      });
      toast.success("Credit note created successfully");
      setShowCreditNoteDialog(false);
      fetchReturns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create credit note");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-700",
      credit_issued: "bg-green-100 text-green-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  return (
    <div data-testid="vendor-returns-page">
      <div className="page-header">
        <h1 className="page-title">Returns</h1>
        <p className="page-subtitle">View and process return requests</p>
      </div>

      <div className="page-container">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : returns.length === 0 ? (
            <div className="empty-state py-12">
              <RotateCcw className="empty-state-icon" />
              <p className="empty-state-title">No returns found</p>
              <p className="empty-state-text">Return requests will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Return Number</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((ret) => (
                  <TableRow key={ret.id}>
                    <TableCell className="font-mono font-medium">{ret.return_number}</TableCell>
                    <TableCell>{ret.items?.length || 0} items</TableCell>
                    <TableCell>
                      <span className={`badge ${getStatusColor(ret.status)}`}>
                        {ret.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(ret.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {ret.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => openCreditNoteDialog(ret)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                          data-testid={`issue-credit-note-${ret.id}`}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Issue Credit Note
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Credit Note Dialog */}
      <Dialog open={showCreditNoteDialog} onOpenChange={setShowCreditNoteDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Issue Credit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Return: {selectedReturn?.return_number}
            </p>
            <div className="space-y-3">
              {creditNoteItems.map((item, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                  </div>
                  <div className="w-32">
                    <Label className="text-xs">Unit Price (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItemPrice(index, e.target.value)}
                    />
                  </div>
                  <div className="w-32 text-right">
                    <Label className="text-xs">Total</Label>
                    <p className="font-mono font-medium">{formatCurrency(item.total)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Credit Value</span>
                <span className="font-mono text-emerald-600">{formatCurrency(creditNoteTotal)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreditNoteDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateCreditNote}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={saving || creditNoteTotal <= 0}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Issue Credit Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorReturns;
