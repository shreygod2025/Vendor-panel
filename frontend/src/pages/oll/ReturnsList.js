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
import { Plus, Search, RotateCcw, FileCheck, Trash2, Eye, FileText, Download, XCircle, Clock, CheckCircle, Image, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const ReturnsList = () => {
  const { user } = useAuth();
  const isOLL = user?.role === "oll";
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

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

  const viewDetails = (ret) => {
    setSelectedReturn(ret);
    setDetailsDialogOpen(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
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
      sent: "bg-amber-100 text-amber-700",
      confirmed: "bg-emerald-100 text-emerald-700",
      rejected: "bg-red-100 text-red-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  const getStatusLabel = (status) => {
    const labels = {
      sent: "Sent to Vendor",
      confirmed: "Credit Note Issued",
      rejected: "Rejected by Vendor"
    };
    return labels[status] || status;
  };

  const filteredReturns = returns.filter((ret) => {
    return ret.return_number?.toLowerCase().includes(search.toLowerCase()) ||
           ret.po_number?.toLowerCase().includes(search.toLowerCase()) ||
           ret.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
           (ret.credit_note_number && ret.credit_note_number.toLowerCase().includes(search.toLowerCase()));
  });

  // Calculate stats
  const sentCount = returns.filter(r => r.status === "sent").length;
  const confirmedCount = returns.filter(r => r.status === "confirmed").length;
  const rejectedCount = returns.filter(r => r.status === "rejected").length;
  const totalCreditValue = returns.reduce((sum, r) => sum + (r.credit_amount || r.total_value || 0), 0);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sentCount}</p>
                  <p className="text-sm text-slate-500">Pending with Vendor</p>
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
                  <p className="text-2xl font-bold">{confirmedCount}</p>
                  <p className="text-sm text-slate-500">Credit Notes Received</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{rejectedCount}</p>
                  <p className="text-sm text-slate-500">Rejected</p>
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
                    {formatCurrency(totalCreditValue)}
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
              placeholder="Search by return number, PO, vendor, or credit note..."
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
                    <TableHead>Return #</TableHead>
                    <TableHead>PO #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Credit Amount</TableHead>
                    <TableHead>Credit Note #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.map((ret) => (
                    <TableRow key={ret.id} data-testid={`return-row-${ret.id}`}>
                      <TableCell className="font-mono font-medium">{ret.return_number}</TableCell>
                      <TableCell className="font-mono text-sm text-slate-500">{ret.po_number || '-'}</TableCell>
                      <TableCell>{ret.vendor_name || '-'}</TableCell>
                      <TableCell>{ret.items?.length || 0} items</TableCell>
                      <TableCell className="font-mono font-medium text-emerald-600">
                        {formatCurrency(ret.credit_amount || ret.total_value)}
                      </TableCell>
                      <TableCell>
                        {ret.credit_note_number ? (
                          <span className="font-mono text-emerald-600">{ret.credit_note_number}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`badge ${getStatusColor(ret.status)}`}>
                          {getStatusLabel(ret.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500">{formatDate(ret.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewDetails(ret)}
                            className="text-blue-600 hover:bg-blue-50"
                            title="View Details"
                            data-testid={`view-return-${ret.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {ret.credit_note_url && (
                            <a
                              href={ret.credit_note_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Download Credit Note"
                            >
                              <Download className="w-4 h-4" />
                            </a>
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

      {/* Return Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Return Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedReturn && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-sm text-slate-500">Return Number</span>
                  <p className="font-mono font-bold">{selectedReturn.return_number}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">PO Number</span>
                  <p className="font-mono">{selectedReturn.po_number || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Vendor</span>
                  <p>{selectedReturn.vendor_name || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Status</span>
                  <p>
                    <span className={`badge ${getStatusColor(selectedReturn.status)}`}>
                      {getStatusLabel(selectedReturn.status)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Return Proof */}
              {selectedReturn.return_proof_url && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-700">Return Proof</span>
                    </div>
                    <a 
                      href={selectedReturn.return_proof_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View
                    </a>
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Returned Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs text-center">Qty</TableHead>
                        <TableHead className="text-xs text-right">Original Price</TableHead>
                        <TableHead className="text-xs text-right">Deduction</TableHead>
                        <TableHead className="text-xs">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedReturn.items || []).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{item.product_name}</TableCell>
                          <TableCell className="text-sm text-center">{item.quantity}</TableCell>
                          <TableCell className="text-sm text-right font-mono">
                            {formatCurrency(item.original_price || item.unit_price)}
                          </TableCell>
                          <TableCell className="text-sm text-right font-mono text-red-600">
                            {item.deduction_amount > 0 ? `- ${formatCurrency(item.deduction_amount)}` : '-'}
                          </TableCell>
                          <TableCell className="text-sm capitalize">{item.reason?.replace('_', ' ') || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Deduction Reasons */}
              {selectedReturn.items?.some(item => item.deduction_reason) && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <h4 className="font-medium text-amber-800 mb-2">Deduction Details</h4>
                  {selectedReturn.items.filter(item => item.deduction_reason).map((item, idx) => (
                    <p key={idx} className="text-sm text-amber-700">
                      <strong>{item.product_name}:</strong> {item.deduction_reason}
                    </p>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-gradient-to-r from-slate-50 to-emerald-50 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total Return Value:</span>
                    <span className="font-mono">{formatCurrency(selectedReturn.total_value)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Total Deductions:</span>
                    <span className="font-mono">- {formatCurrency(selectedReturn.total_deductions || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold pt-2 border-t border-slate-200">
                    <span className="text-emerald-700">Credit Amount:</span>
                    <span className="text-xl font-mono text-emerald-600">
                      {formatCurrency(selectedReturn.credit_amount || selectedReturn.total_value)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Credit Note (if confirmed) */}
              {selectedReturn.status === "confirmed" && selectedReturn.credit_note_number && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium text-emerald-800">Credit Note Received</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-emerald-600">Number:</span>
                      <span className="ml-2 font-mono font-bold">{selectedReturn.credit_note_number}</span>
                    </div>
                    <div>
                      <span className="text-emerald-600">Date:</span>
                      <span className="ml-2">{formatDate(selectedReturn.credit_note_date)}</span>
                    </div>
                  </div>
                  {selectedReturn.credit_note_url && (
                    <a 
                      href={selectedReturn.credit_note_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
                    >
                      <Download className="w-4 h-4" />
                      Download Credit Note Document
                    </a>
                  )}
                </div>
              )}

              {/* Rejection (if rejected) */}
              {selectedReturn.status === "rejected" && selectedReturn.rejection_reason && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-700">Rejected by Vendor</span>
                  </div>
                  <p className="text-sm text-red-700">{selectedReturn.rejection_reason}</p>
                </div>
              )}

              {/* Notes */}
              {selectedReturn.notes && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Notes</p>
                  <p className="text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
                    {selectedReturn.notes}
                  </p>
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
