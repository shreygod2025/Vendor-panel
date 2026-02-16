import { useState, useEffect } from "react";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent } from "../../components/ui/card";
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
  DialogDescription,
} from "../../components/ui/dialog";
import { RotateCcw, Loader2, CheckCircle, XCircle, Eye, Upload, FileText, Image, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";

const VendorReturns = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Confirm form state
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [creditNoteUrl, setCreditNoteUrl] = useState("");
  
  // Reject form state
  const [rejectionReason, setRejectionReason] = useState("");

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

  const openConfirmDialog = (ret) => {
    setSelectedReturn(ret);
    setCreditNoteNumber("");
    setCreditNoteUrl("");
    setShowConfirmDialog(true);
  };

  const openRejectDialog = (ret) => {
    setSelectedReturn(ret);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const openDetailsDialog = (ret) => {
    setSelectedReturn(ret);
    setShowDetailsDialog(true);
  };

  const handleCreditNoteUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const response = await apiClient.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setCreditNoteUrl(response.data.url);
      toast.success("Credit note uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload credit note");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!creditNoteNumber.trim()) {
      toast.error("Please enter the credit note number");
      return;
    }
    if (!creditNoteUrl) {
      toast.error("Please upload the credit note document");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post(`/returns/${selectedReturn.id}/confirm`, {
        credit_note_number: creditNoteNumber.trim(),
        credit_note_url: creditNoteUrl
      });
      toast.success("Return confirmed and credit note issued successfully");
      setShowConfirmDialog(false);
      fetchReturns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to confirm return");
    } finally {
      setSaving(false);
    }
  };

  const handleRejectReturn = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post(`/returns/${selectedReturn.id}/reject`, {
        rejection_reason: rejectionReason.trim()
      });
      toast.success("Return rejected");
      setShowRejectDialog(false);
      fetchReturns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject return");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
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
    }).format(amount || 0);
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
      sent: "Pending Review",
      confirmed: "Credit Note Issued",
      rejected: "Rejected"
    };
    return labels[status] || status;
  };

  // Count by status
  const pendingCount = returns.filter(r => r.status === "sent").length;
  const confirmedCount = returns.filter(r => r.status === "confirmed").length;
  const rejectedCount = returns.filter(r => r.status === "rejected").length;

  return (
    <div data-testid="vendor-returns-page">
      <div className="page-header">
        <h1 className="page-title">Returns Management</h1>
        <p className="page-subtitle">Review and process return requests from OLL</p>
      </div>

      <div className="page-container">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-sm text-slate-500">Pending Review</p>
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
                  <p className="text-sm text-slate-500">Credit Notes Issued</p>
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
        </div>

        {/* Returns Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : returns.length === 0 ? (
            <div className="empty-state py-12">
              <RotateCcw className="empty-state-icon" />
              <p className="empty-state-title">No returns found</p>
              <p className="empty-state-text">Return requests from OLL will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Return #</TableHead>
                  <TableHead>PO #</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Credit Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((ret) => (
                  <TableRow key={ret.id} data-testid={`return-row-${ret.id}`}>
                    <TableCell className="font-mono font-medium">{ret.return_number}</TableCell>
                    <TableCell className="font-mono text-sm text-slate-500">{ret.po_number || '-'}</TableCell>
                    <TableCell>{ret.items?.length || 0} items</TableCell>
                    <TableCell className="font-mono font-medium text-emerald-600">
                      {formatCurrency(ret.credit_amount || ret.total_value)}
                    </TableCell>
                    <TableCell>
                      <span className={`badge ${getStatusColor(ret.status)}`}>
                        {getStatusLabel(ret.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(ret.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Details button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailsDialog(ret)}
                          title="View Details"
                          data-testid={`view-return-${ret.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {/* Actions for pending returns */}
                        {ret.status === "sent" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => openConfirmDialog(ret)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                              data-testid={`confirm-return-${ret.id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRejectDialog(ret)}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              data-testid={`reject-return-${ret.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </>
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

      {/* Return Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Return Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedReturn && (
            <div className="space-y-4">
              {/* Return Info Header */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-sm text-slate-500">Return Number</span>
                  <p className="font-mono font-medium">{selectedReturn.return_number}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">PO Number</span>
                  <p className="font-mono">{selectedReturn.po_number || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Status</span>
                  <p>
                    <span className={`badge ${getStatusColor(selectedReturn.status)}`}>
                      {getStatusLabel(selectedReturn.status)}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Created</span>
                  <p>{formatDate(selectedReturn.created_at)}</p>
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

              {/* Items Table */}
              <div>
                <h4 className="font-medium mb-2">Returned Items</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Deduction</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedReturn.items || []).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(item.original_price || item.unit_price)}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {item.deduction_amount > 0 ? `- ${formatCurrency(item.deduction_amount)}` : '-'}
                          </TableCell>
                          <TableCell className="capitalize">{item.reason?.replace('_', ' ') || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Deduction Details */}
              {selectedReturn.items?.some(item => item.deduction_reason) && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <h4 className="font-medium text-amber-800 mb-2">Deduction Notes</h4>
                  {selectedReturn.items.filter(item => item.deduction_reason).map((item, idx) => (
                    <p key={idx} className="text-sm text-amber-700">
                      <strong>{item.product_name}:</strong> {item.deduction_reason}
                    </p>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-gradient-to-r from-slate-50 to-emerald-50 rounded-lg border border-slate-200">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total Return Value:</span>
                    <span className="font-mono">{formatCurrency(selectedReturn.total_value)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Total Deductions:</span>
                    <span className="font-mono">- {formatCurrency(selectedReturn.total_deductions)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t border-slate-200">
                    <span className="text-emerald-700">Credit Amount:</span>
                    <span className="font-mono text-emerald-600">{formatCurrency(selectedReturn.credit_amount || selectedReturn.total_value)}</span>
                  </div>
                </div>
              </div>

              {/* Credit Note Info (if confirmed) */}
              {selectedReturn.status === "confirmed" && selectedReturn.credit_note_number && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium text-emerald-700">Credit Note Issued</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-emerald-600">Number:</span>
                      <span className="ml-2 font-mono font-medium">{selectedReturn.credit_note_number}</span>
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
                      className="inline-flex items-center gap-1 mt-2 text-emerald-600 hover:underline"
                    >
                      <Download className="w-4 h-4" />
                      Download Credit Note
                    </a>
                  )}
                </div>
              )}

              {/* Rejection Info (if rejected) */}
              {selectedReturn.status === "rejected" && selectedReturn.rejection_reason && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-700">Return Rejected</span>
                  </div>
                  <p className="text-sm text-red-700">{selectedReturn.rejection_reason}</p>
                </div>
              )}

              {/* Notes */}
              {selectedReturn.notes && (
                <div>
                  <h4 className="font-medium mb-1">Notes from OLL</h4>
                  <p className="text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">{selectedReturn.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Return Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Confirm Return & Issue Credit Note
            </DialogTitle>
            <DialogDescription>
              Upload your credit note document to confirm this return
            </DialogDescription>
          </DialogHeader>
          
          {selectedReturn && (
            <div className="space-y-4">
              {/* Return Summary */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Return:</span>
                    <span className="ml-2 font-mono font-medium">{selectedReturn.return_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Credit Amount:</span>
                    <span className="ml-2 font-mono font-medium text-emerald-600">
                      {formatCurrency(selectedReturn.credit_amount || selectedReturn.total_value)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Credit Note Number */}
              <div>
                <Label htmlFor="credit-note-number">Credit Note Number *</Label>
                <Input
                  id="credit-note-number"
                  value={creditNoteNumber}
                  onChange={(e) => setCreditNoteNumber(e.target.value)}
                  placeholder="e.g., CN-2024-001"
                  data-testid="credit-note-number-input"
                />
              </div>

              {/* Credit Note Upload */}
              <div>
                <Label>Upload Credit Note Document *</Label>
                <div className="mt-1">
                  <Input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleCreditNoteUpload}
                    disabled={uploading}
                    data-testid="credit-note-upload"
                  />
                  {uploading && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </div>
                  )}
                  {creditNoteUrl && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-emerald-50 rounded text-sm text-emerald-700">
                      <CheckCircle className="w-4 h-4" />
                      Credit note uploaded
                      <a href={creditNoteUrl} target="_blank" rel="noopener noreferrer" className="underline">View</a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
            <Button
              onClick={handleConfirmReturn}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={saving || !creditNoteNumber.trim() || !creditNoteUrl}
              data-testid="submit-confirm-btn"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm & Issue Credit Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Return Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Reject Return
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this return request
            </DialogDescription>
          </DialogHeader>
          
          {selectedReturn && (
            <div className="space-y-4">
              {/* Return Summary */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Return:</span>
                    <span className="ml-2 font-mono font-medium">{selectedReturn.return_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Items:</span>
                    <span className="ml-2">{selectedReturn.items?.length || 0} items</span>
                  </div>
                </div>
              </div>

              {/* Rejection Reason */}
              <div>
                <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please explain why you are rejecting this return..."
                  rows={4}
                  data-testid="rejection-reason-input"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              onClick={handleRejectReturn}
              variant="destructive"
              disabled={saving || !rejectionReason.trim()}
              data-testid="submit-reject-btn"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorReturns;
