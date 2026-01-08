import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient, useAuth } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
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
} from "../../components/ui/dialog";
import { Plus, Search, RotateCcw, FileCheck, Trash2, Eye, FileText, Download } from "lucide-react";
import { toast } from "sonner";

const ReturnsList = () => {
  const { user } = useAuth();
  const isOLL = user?.role === "oll";
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [creditNoteDialogOpen, setCreditNoteDialogOpen] = useState(false);

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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this return?")) return;
    try {
      await apiClient.delete(`/returns/${id}`);
      toast.success("Return deleted successfully");
      fetchReturns();
    } catch (error) {
      toast.error("Failed to delete return");
    }
  };

  const viewCreditNote = (ret) => {
    setSelectedReturn(ret);
    setCreditNoteDialogOpen(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-700",
      approved: "bg-blue-100 text-blue-700",
      credit_issued: "bg-emerald-100 text-emerald-700",
      rejected: "bg-red-100 text-red-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  const filteredReturns = returns.filter((ret) => {
    return ret.return_number?.toLowerCase().includes(search.toLowerCase()) ||
           (ret.credit_note_number && ret.credit_note_number.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div data-testid="returns-list-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Returns</h1>
            <p className="page-subtitle">Manage product returns and credit notes</p>
          </div>
          {isOLL && (
            <Link to="/oll/returns/new">
              <Button className="bg-[#1e3a8a] hover:bg-[#1e40af]" data-testid="create-return-btn">
                <Plus className="w-4 h-4 mr-2" />
                Create Return
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="page-container">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{returns.length}</p>
                  <p className="text-sm text-slate-500">Total Returns</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {returns.filter(r => r.credit_note_number).length}
                  </p>
                  <p className="text-sm text-slate-500">Credit Notes Issued</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(returns.reduce((sum, r) => sum + (r.total_value || 0), 0))}
                  </p>
                  <p className="text-sm text-slate-500">Total Credit Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by return or credit note number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : filteredReturns.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No returns found</p>
                <p className="text-sm">Create a return request when needed</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Return Number</TableHead>
                    <TableHead>Credit Note #</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Credit Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.map((ret) => (
                    <TableRow key={ret.id} data-testid={`return-row-${ret.id}`}>
                      <TableCell className="font-mono font-medium">{ret.return_number}</TableCell>
                      <TableCell>
                        {ret.credit_note_number ? (
                          <span className="font-mono text-emerald-600">{ret.credit_note_number}</span>
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{ret.po_number || '-'}</TableCell>
                      <TableCell>{ret.vendor_name || '-'}</TableCell>
                      <TableCell>{ret.items?.length || 0} items</TableCell>
                      <TableCell className="font-mono font-medium text-emerald-600">
                        {formatCurrency(ret.total_value || 0)}
                      </TableCell>
                      <TableCell>
                        <span className={`badge ${getStatusColor(ret.status)}`}>
                          {ret.status?.replace('_', ' ') || 'pending'}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500">{formatDate(ret.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {ret.credit_note_number && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewCreditNote(ret)}
                              className="text-emerald-600 hover:bg-emerald-50"
                              title="View Credit Note"
                              data-testid={`view-credit-note-${ret.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          {isOLL && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(ret.id)}
                              className="text-red-600 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Credit Note Dialog */}
      <Dialog open={creditNoteDialogOpen} onOpenChange={setCreditNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-600" />
              Credit Note Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedReturn && (
            <div className="space-y-4">
              {/* Credit Note Header */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-emerald-600">Credit Note Number</span>
                  <span className="font-mono font-bold text-emerald-800">{selectedReturn.credit_note_number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-600">Issue Date</span>
                  <span className="text-emerald-800">{formatDate(selectedReturn.credit_note_date)}</span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Return Number</span>
                  <span className="font-mono">{selectedReturn.return_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">PO Number</span>
                  <span className="font-mono">{selectedReturn.po_number || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Vendor</span>
                  <span>{selectedReturn.vendor_name || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <span className={`badge ${getStatusColor(selectedReturn.status)}`}>
                    {selectedReturn.status?.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Returned Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs text-center">Qty</TableHead>
                        <TableHead className="text-xs text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedReturn.items || []).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{item.product_name}</TableCell>
                          <TableCell className="text-sm text-center">{item.quantity}</TableCell>
                          <TableCell className="text-sm text-right font-mono">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Total */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">Total Credit Value</span>
                  <span className="text-xl font-bold text-emerald-600 font-mono">
                    {formatCurrency(selectedReturn.total_value || 0)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {selectedReturn.notes && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Notes</p>
                  <p className="text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
                    {selectedReturn.notes}
                  </p>
                </div>
              )}

              {/* Credit Note File */}
              {selectedReturn.credit_note_file_url && (
                <div className="pt-2 border-t">
                  <a 
                    href={selectedReturn.credit_note_file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <Download className="w-4 h-4" />
                    Download Credit Note Document
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReturnsList;
