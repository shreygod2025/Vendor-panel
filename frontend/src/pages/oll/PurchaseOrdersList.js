import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Plus, Search, Eye, FileText, ExternalLink, Check, Circle, Clock, Truck, Package, ChevronDown, ChevronRight, AlertTriangle, RotateCcw, MoreHorizontal, Edit, CheckCircle, XCircle, Loader2, Trash2, Receipt, Download, Image, X, MessageSquare, Paperclip, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { toast } from "sonner";

const PurchaseOrdersList = () => {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("confirmation");
  const [expandedSections, setExpandedSections] = useState({
    request: true,
    raised: true,
    confirmed: true,
    changes: true,
    pending_approval: true,
    dispatched: true
  });
  
  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [selectedPOInvoice, setSelectedPOInvoice] = useState(null);

  // View Invoice dialog state
  const [viewInvoiceDialog, setViewInvoiceDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Raise Issue dialog state
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [poIssuesDialogOpen, setPoIssuesDialogOpen] = useState(false);
  const [poIssues, setPoIssues] = useState([]);
  const [loadingPoIssues, setLoadingPoIssues] = useState(false);
  const [issueForm, setIssueForm] = useState({
    issue_type: "quality",
    priority: "medium",
    description: "",
    attachment_url: ""
  });
  const [issueAttachment, setIssueAttachment] = useState(null);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 50;
  
  // Delete request dialog
  const [requestDeleteDialogOpen, setRequestDeleteDialogOpen] = useState(false);
  const [poToDelete, setPoToDelete] = useState(null);
  const [deletingRequest, setDeletingRequest] = useState(false);
  
  // Invoice upload dialog for delivered POs
  const [invoiceUploadDialog, setInvoiceUploadDialog] = useState(false);
  const [poForInvoice, setPoForInvoice] = useState(null);
  const [invoiceUploadForm, setInvoiceUploadForm] = useState({
    invoice_url: "",
    logistics_invoice_url: "",
    invoice_number: "",
    invoice_date: "",
    invoice_amount: "",
    logistics_cost: ""
  });
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  useEffect(() => {
    document.title = "OLL - Purchase Orders";
    fetchData();
  }, []);

  const fetchData = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setPage(1);
      }
      
      const currentPage = loadMore ? page + 1 : 1;
      
      // Use optimized endpoint that returns POs with invoice status
      const response = await apiClient.get(`/purchase-orders/list-with-invoices?page=${currentPage}&limit=${ITEMS_PER_PAGE}`);
      
      if (loadMore) {
        setOrders(prev => [...prev, ...response.data.orders]);
        setPage(currentPage);
      } else {
        setOrders(response.data.orders);
        setVendors(response.data.vendors);
        setTotalCount(response.data.total);
        // Build invoice map from PO data
        const invMap = {};
        response.data.orders.forEach(o => {
          if (o.has_invoice) {
            invMap[o.id] = { po_id: o.id, payment_status: o.invoice_status };
          }
        });
        setInvoices(Object.values(invMap));
      }
      
      setHasMore(response.data.orders.length === ITEMS_PER_PAGE);
    } catch (error) {
      toast.error("Failed to fetch purchase orders");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreOrders = () => {
    if (!loadingMore && hasMore) {
      fetchData(true);
    }
  };

  // Delete PO request
  const handleDeleteRequest = async () => {
    if (!poToDelete) return;
    
    setDeletingRequest(true);
    try {
      await apiClient.delete(`/purchase-orders/${poToDelete.id}`);
      toast.success(`Request ${poToDelete.po_number} deleted successfully`);
      setRequestDeleteDialogOpen(false);
      setPoToDelete(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete request");
    } finally {
      setDeletingRequest(false);
    }
  };

  // Upload invoices for delivered PO
  const handleInvoiceUpload = async () => {
    if (!poForInvoice) return;
    
    setUploadingInvoice(true);
    try {
      const payload = {
        invoice_url: invoiceUploadForm.invoice_url || null,
        logistics_invoice_url: invoiceUploadForm.logistics_invoice_url || null,
        invoice_number: invoiceUploadForm.invoice_number || null,
        invoice_date: invoiceUploadForm.invoice_date || null,
        invoice_amount: invoiceUploadForm.invoice_amount ? parseFloat(invoiceUploadForm.invoice_amount) : null,
        logistics_cost: invoiceUploadForm.logistics_cost ? parseFloat(invoiceUploadForm.logistics_cost) : null
      };
      
      await apiClient.post(`/purchase-orders/${poForInvoice.id}/admin-upload-invoices`, payload);
      toast.success("Invoices uploaded successfully");
      setInvoiceUploadDialog(false);
      setPoForInvoice(null);
      setInvoiceUploadForm({
        invoice_url: "",
        logistics_invoice_url: "",
        invoice_number: "",
        invoice_date: "",
        invoice_amount: "",
        logistics_cost: ""
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload invoices");
    } finally {
      setUploadingInvoice(false);
    }
  };

  const openInvoiceUploadDialog = (order) => {
    const existingInvoice = getInvoiceForPO(order.id);
    setPoForInvoice(order);
    setInvoiceUploadForm({
      invoice_url: existingInvoice?.invoice_url || existingInvoice?.file_url || "",
      logistics_invoice_url: existingInvoice?.logistics_bill_url || "",
      invoice_number: existingInvoice?.invoice_number || "",
      invoice_date: existingInvoice?.invoice_date || "",
      invoice_amount: existingInvoice?.amount || "",
      logistics_cost: existingInvoice?.logistics_cost || ""
    });
    setInvoiceUploadDialog(true);
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
      request: "bg-orange-100 text-orange-700",
      draft: "status-draft",
      sent: "status-sent",
      confirmed: "status-confirmed",
      dispatched: "status-dispatched",
      pending_approval: "bg-purple-100 text-purple-700",
      delivered: "status-delivered",
      closed: "status-closed",
      rejected: "status-rejected"
    };
    return colors[status] || "status-draft";
  };

  const getTrackingUrl = (token) => {
    return `${window.location.origin}/track/${token}`;
  };

  const copyTrackingLink = (token) => {
    navigator.clipboard.writeText(getTrackingUrl(token));
    toast.success("Tracking link copied to clipboard");
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

  // Filter orders by search and vendor
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.po_number.toLowerCase().includes(search.toLowerCase());
    const matchesVendor = vendorFilter === "all" || order.vendor_id === vendorFilter;
    return matchesSearch && matchesVendor;
  });

  // Categorize orders by status
  const categorizedOrders = {
    // External Requests (new)
    request: filteredOrders.filter(o => o.status === "request"),
    // PO Confirmation section
    raised: filteredOrders.filter(o => o.status === "draft" || o.status === "sent"),
    confirmed: filteredOrders.filter(o => o.status === "confirmed"),
    changes: filteredOrders.filter(o => o.status === "rejected"),
    // Dispatched section (includes pending_approval)
    dispatched: filteredOrders.filter(o => o.status === "dispatched"),
    pending_approval: filteredOrders.filter(o => o.status === "pending_approval"),
    // Delivered section
    delivered: filteredOrders.filter(o => o.status === "delivered" || o.status === "closed")
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleApproveRequest = async (orderId) => {
    try {
      await apiClient.post(`/purchase-orders/${orderId}/approve-request`);
      toast.success("Request approved and sent to vendor");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve request");
    }
  };

  const handleApproveDelivery = async () => {
    if (!selectedPO) return;
    setApproving(true);
    try {
      await apiClient.post(`/purchase-orders/${selectedPO.id}/approve-delivery`);
      toast.success("Delivery approved successfully");
      setApprovalDialogOpen(false);
      setSelectedPO(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve delivery");
    } finally {
      setApproving(false);
    }
  };

  const handleRejectDelivery = async () => {
    if (!selectedPO) return;
    setApproving(true);
    try {
      await apiClient.post(`/purchase-orders/${selectedPO.id}/reject-delivery?reason=${encodeURIComponent(rejectionReason)}`);
      toast.success("Delivery rejected");
      setRejectDialogOpen(false);
      setSelectedPO(null);
      setRejectionReason("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject delivery");
    } finally {
      setApproving(false);
    }
  };

  const handleDeletePO = async () => {
    if (!selectedPO) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/purchase-orders/${selectedPO.id}`);
      toast.success("PO deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedPO(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete PO");
    } finally {
      setDeleting(false);
    }
  };

  // TEMPORARY: Force delete for delivered POs (includes related invoices, payments, etc.)
  const handleForceDeletePO = async (order) => {
    if (!window.confirm(`⚠️ PERMANENT DELETE\n\nThis will delete PO ${order.po_number} and ALL related data:\n- Invoices\n- Payments\n- Dispatches\n- Issues\n\nThis cannot be undone. Continue?`)) {
      return;
    }
    
    try {
      const response = await apiClient.delete(`/purchase-orders/${order.id}?force=true`);
      toast.success(`Deleted PO and ${response.data.deleted_invoices || 0} invoices, ${response.data.deleted_payments || 0} payments`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete PO");
    }
  };

  const handleReRaisePO = async (orderId) => {
    try {
      await apiClient.put(`/purchase-orders/${orderId}`, { status: "sent" });
      toast.success("PO re-raised and sent to vendor");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to re-raise PO");
    }
  };

  const handleRaiseIssue = async () => {
    if (!selectedPO || !issueForm.description.trim()) {
      toast.error("Please provide issue description");
      return;
    }
    
    setSubmittingIssue(true);
    try {
      let attachmentUrl = null;
      if (issueAttachment) {
        const reader = new FileReader();
        attachmentUrl = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(issueAttachment);
        });
      }
      
      await apiClient.post("/issues", {
        po_id: selectedPO.id,
        vendor_id: selectedPO.vendor_id,
        issue_type: issueForm.issue_type,
        priority: issueForm.priority,
        description: issueForm.description,
        attachment_url: attachmentUrl,
        affected_items: []
      });
      toast.success("Issue raised successfully");
      setIssueDialogOpen(false);
      setSelectedPO(null);
      setIssueForm({ issue_type: "quality", priority: "medium", description: "", attachment_url: "" });
      setIssueAttachment(null);
      // Refresh PO issues if dialog is open
      if (poIssuesDialogOpen && selectedPO) {
        fetchPoIssues(selectedPO.id);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to raise issue");
    } finally {
      setSubmittingIssue(false);
    }
  };

  const handleIssueAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error("Only PNG, JPEG, and PDF files are allowed");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setIssueAttachment(file);
    }
  };

  const fetchPoIssues = async (poId) => {
    setLoadingPoIssues(true);
    try {
      const response = await apiClient.get(`/issues?po_id=${poId}`);
      setPoIssues(response.data);
    } catch (error) {
      toast.error("Failed to fetch issues for this PO");
      setPoIssues([]);
    } finally {
      setLoadingPoIssues(false);
    }
  };

  const openPoIssuesDialog = async (order) => {
    setSelectedPO(order);
    setPoIssuesDialogOpen(true);
    await fetchPoIssues(order.id);
  };

  const getIssueStatusColor = (status) => {
    const colors = {
      open: "bg-red-100 text-red-700",
      in_progress: "bg-blue-100 text-blue-700",
      resolved: "bg-emerald-100 text-emerald-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  const getIssuePriorityColor = (priority) => {
    const colors = {
      critical: "bg-red-100 text-red-700",
      high: "bg-orange-100 text-orange-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-slate-100 text-slate-600"
    };
    return colors[priority] || "bg-slate-100 text-slate-600";
  };

  const renderOrderRow = (order, showActions = false, showApprovalActions = false) => {
    const canEdit = order.status === "request" || order.status === "draft" || order.status === "sent" || order.status === "confirmed" || order.status === "rejected";
    const canDelete = order.status === "request" || order.status === "draft" || order.status === "sent" || order.status === "confirmed" || order.status === "rejected";
    const canReRaise = order.status === "rejected";
    
    return (
      <TableRow key={order.id} data-testid={`po-row-${order.id}`}>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-mono font-medium text-slate-900">{order.po_number}</span>
            {order.created_by_role === "distributor" && (
              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded mt-1 w-fit">
                By Distributor: {order.created_by_name || 'Unknown'}
              </span>
            )}
            {order.status === "rejected" && order.rejection_reason && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded mt-1 max-w-[250px] truncate" title={order.rejection_reason}>
                Rejected: {order.rejection_reason}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>{order.vendor_name}</TableCell>
        <TableCell className="text-slate-600">{order.city || '-'}</TableCell>
        <TableCell>
          <div className="flex flex-col">
            {order.school_name && (
              <span className="font-medium text-slate-900">{order.school_name}</span>
            )}
            <span className={order.school_name ? "text-sm text-slate-500" : ""}>
              {order.receiver_name || order.contact_person || "-"}
            </span>
          </div>
        </TableCell>
        <TableCell>{order.line_items?.length || 0} items</TableCell>
        <TableCell className="font-mono font-medium">{formatCurrency(order.grand_total)}</TableCell>
        <TableCell>
          <span className={`badge ${getStatusColor(order.status)}`}>
            {order.status === "pending_approval" ? "Pending Approval" : order.status}
          </span>
        </TableCell>
        <TableCell className="text-slate-500">{order.delivery_date ? formatDate(order.delivery_date) : "-"}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Link to={`/oll/purchase-orders/${order.id}`}>
              <Button variant="ghost" size="sm" data-testid={`view-po-${order.id}`} title="View">
                <Eye className="w-4 h-4" />
              </Button>
            </Link>
            {canEdit && (
              <Link to={`/oll/purchase-orders/${order.id}/edit`}>
                <Button variant="ghost" size="sm" data-testid={`edit-po-${order.id}`} title="Edit">
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPO(order);
                  setDeleteDialogOpen(true);
                }}
                className="text-red-600 hover:bg-red-50"
                title="Delete PO"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            {canReRaise && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReRaisePO(order.id)}
                className="text-blue-600 hover:bg-blue-50"
                title="Re-raise PO"
                data-testid={`reraise-po-${order.id}`}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadPDF(order.id, order.po_number)}
              title="Download PDF"
              data-testid={`download-pdf-${order.id}`}
            >
              <Download className="w-4 h-4" />
            </Button>
            {/* Combined Issues Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-600 hover:bg-amber-50"
                  title="Issues"
                  data-testid={`issues-${order.id}`}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => openPoIssuesDialog(order)}
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Issues
                </DropdownMenuItem>
                {["dispatched", "delivered", "closed", "pending_approval"].includes(order.status) && (
                  <DropdownMenuItem 
                    onClick={() => {
                      setSelectedPO(order);
                      setIssueDialogOpen(true);
                    }}
                    className="flex items-center gap-2 text-amber-600"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Raise New Issue
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyTrackingLink(order.tracking_token)}
              title="Copy tracking link"
              data-testid={`copy-tracking-${order.id}`}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            {showApprovalActions && order.status === "pending_approval" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedPO(order);
                    setRejectDialogOpen(true);
                  }}
                  className="text-red-600 hover:bg-red-50"
                  title="Reject Delivery"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedPO(order);
                    // Find the invoice for this PO
                    const poInvoice = invoices.find(inv => inv.po_id === order.id);
                    setSelectedPOInvoice(poInvoice || null);
                    setApprovalConfirmed(false);
                    setApprovalDialogOpen(true);
                  }}
                  className="text-emerald-600 hover:bg-emerald-50"
                  title="Approve Delivery"
                >
                  <CheckCircle className="w-4 h-4" />
                </Button>
              </>
            )}
            {showActions && (order.status === "delivered" || order.status === "closed") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={`/oll/issues?po_id=${order.id}`} className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Raise Issue
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/oll/returns?po_id=${order.id}`} className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" />
                      Create Return
                    </Link>
                  </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
    </TableRow>
    );
  };

  const renderTable = (ordersList, emptyMessage, showActions = false, showApprovalActions = false) => {
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
            <TableHead>Vendor</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Receiver</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Grand Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Delivery Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordersList.map(order => renderOrderRow(order, showActions, showApprovalActions))}
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
            <TableHead>Vendor</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Receiver</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Grand Total</TableHead>
            <TableHead>Logistics Cost</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordersList.map(order => {
            const invoice = getInvoiceForPO(order.id);
            return (
              <TableRow key={order.id} data-testid={`po-row-${order.id}`}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-mono font-medium text-slate-900">{order.po_number}</span>
                    {order.created_by_role === "distributor" && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded mt-1 w-fit">
                        By Distributor: {order.created_by_name || 'Unknown'}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{order.vendor_name}</TableCell>
                <TableCell className="text-slate-600">{order.city || '-'}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    {order.school_name && (
                      <span className="font-medium text-slate-900">{order.school_name}</span>
                    )}
                    <span className={order.school_name ? "text-sm text-slate-500" : ""}>
                      {order.receiver_name || order.contact_person || "-"}
                    </span>
                  </div>
                </TableCell>
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
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/oll/purchase-orders/${order.id}`}>
                      <Button variant="ghost" size="sm" title="View PO">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      title="Upload Invoices" 
                      className="text-blue-600"
                      onClick={() => openInvoiceUploadDialog(order)}
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/oll/issues?po_id=${order.id}`} className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Raise Issue
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/oll/returns?po_id=${order.id}`} className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4" />
                          Create Return
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleForceDeletePO(order)}
                        className="flex items-center gap-2 text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete PO & Data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderSubSection = (title, orders, sectionKey, icon, iconColor, showApprovalActions = false) => {
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
            {renderTable(orders, `No ${title.toLowerCase()} orders`, false, showApprovalActions)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div data-testid="po-list-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Purchase Orders</h1>
            <p className="page-subtitle">Manage all purchase orders</p>
          </div>
          <Link to="/oll/purchase-orders/new">
            <Button className="bg-[#1e3a8a] hover:bg-[#1e40af]" data-testid="create-po-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create PO
            </Button>
          </Link>
        </div>
      </div>

      <div className="page-container">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by PO number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="w-[200px]" data-testid="vendor-filter">
              <SelectValue placeholder="Filter by vendor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state py-12">
            <FileText className="empty-state-icon" />
            <p className="empty-state-title">No purchase orders found</p>
            <p className="empty-state-text">Create your first purchase order</p>
            <Link to="/oll/purchase-orders/new" className="mt-4">
              <Button>Create PO</Button>
            </Link>
          </div>
        ) : (
          <>
          <Tabs defaultValue="requests" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 h-auto p-1">
              <TabsTrigger value="requests" className="py-3 data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                <div className="flex flex-col items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span>Requests</span>
                  <span className="text-xs opacity-70">({categorizedOrders.request.length})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="confirmation" className="py-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <div className="flex flex-col items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>PO Confirmation</span>
                  <span className="text-xs opacity-70">({categorizedOrders.raised.length + categorizedOrders.confirmed.length + categorizedOrders.changes.length})</span>
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

            {/* External Requests Tab */}
            <TabsContent value="requests" className="space-y-4">
              {categorizedOrders.request.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">No pending requests</p>
                    <p className="text-sm">External PO requests will appear here</p>
                    <p className="text-xs mt-2 text-blue-600">Share link: {window.location.origin}/add</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-orange-50">
                          <TableHead>Request #</TableHead>
                          <TableHead>Requester</TableHead>
                          <TableHead>School</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Products</TableHead>
                          <TableHead>Delivery Date</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categorizedOrders.request.map((order) => (
                          <TableRow key={order.id} className="hover:bg-orange-50/50">
                            <TableCell>
                              <div className="font-mono font-medium">{order.po_number}</div>
                              <div className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-orange-700">{order.requester_name || 'N/A'}</div>
                              <div className="text-xs text-slate-500">External Request</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{order.school_name || '-'}</div>
                              <div className="text-xs text-slate-500 max-w-48 truncate">{order.delivery_address}</div>
                            </TableCell>
                            <TableCell className="text-slate-600">{order.city || '-'}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {order.line_items.slice(0, 2).map((item, idx) => (
                                  <div key={idx} className="text-slate-600">
                                    {item.product_name} x{item.quantity}
                                  </div>
                                ))}
                                {order.line_items.length > 2 && (
                                  <div className="text-xs text-slate-400">+{order.line_items.length - 2} more</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{new Date(order.delivery_date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              {order.vendor_name ? (
                                <span className="badge bg-emerald-100 text-emerald-700">{order.vendor_name}</span>
                              ) : (
                                <span className="badge bg-red-100 text-red-700">Not Assigned</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    setPoToDelete(order);
                                    setRequestDeleteDialogOpen(true);
                                  }}
                                  data-testid={`delete-request-${order.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                                <Link to={`/oll/purchase-orders/${order.id}/edit`} className="inline-block">
                                  <Button size="sm" variant="outline" className="text-blue-600" data-testid={`edit-request-${order.id}`}>
                                    <Edit className="w-4 h-4 mr-1" />
                                    Edit & Assign
                                  </Button>
                                </Link>
                                {order.vendor_id && (
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => handleApproveRequest(order.id)}
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    Approve
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="confirmation" className="space-y-4">
              {renderSubSection(
                "Raised",
                categorizedOrders.raised,
                "raised",
                <FileText className="w-4 h-4 text-blue-600" />,
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
                "Changes/Rejected",
                categorizedOrders.changes,
                "changes",
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
                "Pending Approval",
                categorizedOrders.pending_approval,
                "pending_approval",
                <Clock className="w-4 h-4 text-purple-600" />,
                "bg-purple-100",
                true // showApprovalActions
              )}
            </TabsContent>

            <TabsContent value="delivered">
              <Card>
                <CardContent className="p-4">
                  {renderDeliveredTable(categorizedOrders.delivered)}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Load More Button */}
          {hasMore && !loading && (
            <div className="flex justify-center mt-6">
              <Button 
                variant="outline" 
                onClick={loadMoreOrders}
                disabled={loadingMore}
                className="px-8"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>Load More ({orders.length} of {totalCount})</>
                )}
              </Button>
            </div>
          )}
        </>
        )}
      </div>

      {/* Approve Delivery Dialog - Enhanced */}
      <Dialog open={approvalDialogOpen} onOpenChange={(open) => {
        setApprovalDialogOpen(open);
        if (!open) {
          setApprovalConfirmed(false);
          setSelectedPOInvoice(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Approve Delivery - {selectedPO?.po_number}
            </DialogTitle>
            <DialogDescription>
              Review all details before approving this delivery.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Vendor & School Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Vendor</p>
                <p className="font-medium">{selectedPO?.vendor_name}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">School</p>
                <p className="font-medium">{selectedPO?.school_name || "-"}</p>
              </div>
            </div>

            {/* Financial Comparison Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-right p-3 font-medium">PO Amount</th>
                    <th className="text-right p-3 font-medium">Invoice Amount</th>
                    <th className="text-right p-3 font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Subtotal/Base Amount */}
                  <tr className="border-t">
                    <td className="p-3">Subtotal (Before Tax)</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(selectedPO?.subtotal || 0)}</td>
                    <td className="p-3 text-right font-mono">
                      {formatCurrency((selectedPOInvoice?.amount || 0) / 1.18)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {(() => {
                        const poSubtotal = selectedPO?.subtotal || 0;
                        const invSubtotal = (selectedPOInvoice?.amount || 0) / 1.18;
                        const diff = invSubtotal - poSubtotal;
                        return (
                          <span className={diff !== 0 ? (diff > 0 ? "text-red-600" : "text-green-600") : ""}>
                            {diff !== 0 ? (diff > 0 ? "+" : "") + formatCurrency(diff) : "-"}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                  
                  {/* GST on PO vs Invoice */}
                  <tr className="border-t">
                    <td className="p-3">GST (18%)</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(selectedPO?.total_tax || 0)}</td>
                    <td className="p-3 text-right font-mono">
                      {formatCurrency((selectedPOInvoice?.amount || 0) - (selectedPOInvoice?.amount || 0) / 1.18)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {(() => {
                        const poTax = selectedPO?.total_tax || 0;
                        const invTax = (selectedPOInvoice?.amount || 0) - (selectedPOInvoice?.amount || 0) / 1.18;
                        const diff = invTax - poTax;
                        return (
                          <span className={diff !== 0 ? (diff > 0 ? "text-red-600" : "text-green-600") : ""}>
                            {diff !== 0 ? (diff > 0 ? "+" : "") + formatCurrency(diff) : "-"}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* Total Amount */}
                  <tr className="border-t bg-blue-50">
                    <td className="p-3 font-medium">Total Amount</td>
                    <td className="p-3 text-right font-mono font-medium">{formatCurrency(selectedPO?.grand_total || 0)}</td>
                    <td className="p-3 text-right font-mono font-medium">{formatCurrency(selectedPOInvoice?.amount || 0)}</td>
                    <td className="p-3 text-right font-mono font-medium">
                      {(() => {
                        const poTotal = selectedPO?.grand_total || 0;
                        const invTotal = selectedPOInvoice?.amount || 0;
                        const diff = invTotal - poTotal;
                        return (
                          <span className={diff !== 0 ? (diff > 0 ? "text-red-600" : "text-green-600") : ""}>
                            {diff !== 0 ? (diff > 0 ? "+" : "") + formatCurrency(diff) : "-"}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* Logistics Cost */}
                  <tr className="border-t">
                    <td className="p-3">Logistics Cost</td>
                    <td className="p-3 text-right font-mono text-slate-400">N/A</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(selectedPOInvoice?.logistics_cost || 0)}</td>
                    <td className="p-3 text-right font-mono">-</td>
                  </tr>

                  {/* GST on Logistics */}
                  <tr className="border-t">
                    <td className="p-3">GST on Logistics (18%)</td>
                    <td className="p-3 text-right font-mono text-slate-400">N/A</td>
                    <td className="p-3 text-right font-mono">
                      {formatCurrency((selectedPOInvoice?.logistics_cost || 0) * 0.18)}
                    </td>
                    <td className="p-3 text-right font-mono">-</td>
                  </tr>

                  {/* Final Payable */}
                  <tr className="border-t-2 border-slate-300 bg-emerald-50">
                    <td className="p-3 font-bold text-emerald-800">Final Payable Total</td>
                    <td className="p-3 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-800">
                      {formatCurrency(
                        (selectedPOInvoice?.amount || 0) + 
                        (selectedPOInvoice?.logistics_cost || 0) * 1.18
                      )}
                    </td>
                    <td className="p-3 text-right font-mono">-</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Document Previews */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Document Previews</p>
              <div className="grid grid-cols-3 gap-3">
                {/* PO PDF Preview */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">PO Document</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      try {
                        const response = await apiClient.get(`/purchase-orders/${selectedPO?.id}/pdf`, {
                          responseType: 'blob'
                        });
                        const blob = new Blob([response.data], { type: 'application/pdf' });
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${selectedPO?.po_number || 'PO'}.pdf`;
                        link.click();
                        window.URL.revokeObjectURL(url);
                      } catch (error) {
                        toast.error("Failed to download PO PDF");
                      }
                    }}
                  >
                    <Download className="w-3 h-3 mr-1" /> Download PO
                  </Button>
                </div>

                {/* Invoice Preview */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Invoice</span>
                  </div>
                  {selectedPOInvoice?.file_url || selectedPOInvoice?.invoice_url ? (
                    <a
                      href={selectedPOInvoice?.file_url || selectedPOInvoice?.invoice_url}
                      download={`Invoice-${selectedPOInvoice?.invoice_number || 'invoice'}.pdf`}
                      className="w-full"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="w-3 h-3 mr-1" /> Download Invoice
                      </Button>
                    </a>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-1">Not uploaded</p>
                  )}
                </div>

                {/* Logistics Bill Preview */}
                <div className="border rounded-lg p-3 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium">Logistics Bill</span>
                  </div>
                  {selectedPOInvoice?.logistics_bill_url ? (
                    <a
                      href={selectedPOInvoice?.logistics_bill_url}
                      download="logistics_bill.pdf"
                      className="w-full"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="w-3 h-3 mr-1" /> Download Bill
                      </Button>
                    </a>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-1">Not uploaded</p>
                  )}
                </div>
              </div>
              
              {/* Delivery Proof Image */}
              {selectedPOInvoice?.delivery_proof_url && (
                <div className="mt-3 border rounded-lg p-3 bg-emerald-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Image className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">Delivery Proof</span>
                  </div>
                  <div className="flex gap-3">
                    <img 
                      src={selectedPOInvoice.delivery_proof_url} 
                      alt="Delivery Proof" 
                      className="max-h-32 rounded border cursor-pointer hover:opacity-80"
                      onClick={() => window.open(selectedPOInvoice.delivery_proof_url, '_blank')}
                    />
                    <a
                      href={selectedPOInvoice.delivery_proof_url}
                      download="delivery_proof.png"
                    >
                      <Button variant="outline" size="sm">
                        <Download className="w-3 h-3 mr-1" /> Download
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-3 p-4 border-2 border-emerald-200 bg-emerald-50 rounded-lg">
              <input
                type="checkbox"
                id="approval-confirm"
                checked={approvalConfirmed}
                onChange={(e) => setApprovalConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="approval-confirm" className="text-sm text-emerald-800">
                <span className="font-medium">I confirm that I have reviewed all documents and financial details.</span>
                <br />
                <span className="text-emerald-600">I approve this delivery and acknowledge the final payable amount of {formatCurrency(
                  (selectedPOInvoice?.amount || 0) + 
                  (selectedPOInvoice?.logistics_cost || 0) * 1.18
                )}.</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleApproveDelivery}
              disabled={approving || !approvalConfirmed}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {approving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Approve Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Delivery Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Reject Delivery
            </DialogTitle>
            <DialogDescription>
              Reject the delivery for PO {selectedPO?.po_number}? This will return the order to dispatched status.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> The auto-created invoice will be deleted if you reject this delivery.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Reason for rejection</label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleRejectDelivery}
              disabled={approving}
              className="bg-red-600 hover:bg-red-700"
            >
              {approving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete PO Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Delete Purchase Order
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete PO {selectedPO?.po_number}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This will permanently delete the purchase order and all associated data.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleDeletePO}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
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
                  <p className="text-xs text-slate-500">Vendor</p>
                  <p className="font-medium">{selectedInvoice.vendor_name || "-"}</p>
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
                        <p className="text-xs text-emerald-600">Uploaded by vendor</p>
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

      {/* Raise Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Raise Issue for {selectedPO?.po_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Issue Type</Label>
              <Select 
                value={issueForm.issue_type} 
                onValueChange={(v) => setIssueForm(prev => ({ ...prev, issue_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quality">Quality Issue</SelectItem>
                  <SelectItem value="quantity">Quantity Mismatch</SelectItem>
                  <SelectItem value="damage">Damaged Goods</SelectItem>
                  <SelectItem value="delay">Delivery Delay</SelectItem>
                  <SelectItem value="wrong_item">Wrong Item</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select 
                value={issueForm.priority} 
                onValueChange={(v) => setIssueForm(prev => ({ ...prev, priority: v }))}
              >
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
                placeholder="Describe the issue in detail..."
                rows={4}
              />
            </div>
            <div>
              <Label>Attachment (Optional)</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleIssueAttachmentChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-1">Supported: PNG, JPEG, PDF (max 5MB)</p>
              </div>
              {issueAttachment && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                  {issueAttachment.type.startsWith('image/') ? (
                    <Image className="w-4 h-4 text-blue-600" />
                  ) : (
                    <FileText className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="text-sm text-blue-700 flex-1 truncate">{issueAttachment.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIssueAttachment(null)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRaiseIssue}
              disabled={submittingIssue}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {submittingIssue ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Raise Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View PO Issues Dialog */}
      <Dialog open={poIssuesDialogOpen} onOpenChange={setPoIssuesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Issues for {selectedPO?.po_number}
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setIssueDialogOpen(true);
                }}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Issue
              </Button>
            </DialogTitle>
            <DialogDescription>
              View all issues raised for this purchase order
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {loadingPoIssues ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : poIssues.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No issues found</p>
                <p className="text-sm">No issues have been raised for this PO yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {poIssues.map((issue) => (
                  <div key={issue.id} className="p-4 border rounded-lg hover:bg-slate-50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-mono font-medium text-sm">{issue.issue_number}</span>
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="capitalize text-sm">{issue.issue_type?.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge text-xs ${getIssuePriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                        <span className={`badge text-xs ${getIssueStatusColor(issue.status)}`}>
                          {issue.status?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{issue.description}</p>
                    {issue.attachment_url && (
                      <div className="mb-2">
                        {issue.attachment_url.startsWith('data:image') ? (
                          <img 
                            src={issue.attachment_url} 
                            alt="Attachment" 
                            className="max-w-[200px] max-h-[100px] rounded border"
                          />
                        ) : (
                          <a 
                            href={issue.attachment_url} 
                            download="attachment.pdf"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            <Paperclip className="w-3 h-3" />
                            Download Attachment
                          </a>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        Created by {issue.created_by_name || 'Unknown'} ({issue.created_by_role || 'oll'})
                      </span>
                      <span>{new Date(issue.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                    {issue.replies?.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex items-center gap-1 text-xs text-blue-600">
                          <MessageSquare className="w-3 h-3" />
                          {issue.replies.length} {issue.replies.length === 1 ? 'reply' : 'replies'}
                        </div>
                      </div>
                    )}
                    {issue.resolution && (
                      <div className="mt-2 p-2 bg-emerald-50 rounded text-sm">
                        <span className="font-medium text-emerald-700">Resolution: </span>
                        <span className="text-emerald-600">{issue.resolution}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setPoIssuesDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Request Dialog */}
      <Dialog open={requestDeleteDialogOpen} onOpenChange={setRequestDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete PO Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this PO request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {poToDelete && (
            <div className="py-4">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">PO Number:</span>
                  <span className="font-mono font-medium">{poToDelete.po_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requester:</span>
                  <span className="font-medium">{poToDelete.requester_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">School:</span>
                  <span>{poToDelete.school_name || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDeleteDialogOpen(false)} disabled={deletingRequest}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteRequest}
              disabled={deletingRequest}
            >
              {deletingRequest ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Upload Dialog */}
      <Dialog open={invoiceUploadDialog} onOpenChange={setInvoiceUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Invoices</DialogTitle>
            <DialogDescription>
              {poForInvoice && `Upload invoice files for ${poForInvoice.po_number}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input
                  placeholder="INV-001"
                  value={invoiceUploadForm.invoice_number}
                  onChange={(e) => setInvoiceUploadForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={invoiceUploadForm.invoice_date}
                  onChange={(e) => setInvoiceUploadForm(prev => ({ ...prev, invoice_date: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={invoiceUploadForm.invoice_amount}
                  onChange={(e) => setInvoiceUploadForm(prev => ({ ...prev, invoice_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Logistics Cost (₹)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={invoiceUploadForm.logistics_cost}
                  onChange={(e) => setInvoiceUploadForm(prev => ({ ...prev, logistics_cost: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                Product Invoice URL
              </Label>
              <Input
                placeholder="https://drive.google.com/..."
                value={invoiceUploadForm.invoice_url}
                onChange={(e) => setInvoiceUploadForm(prev => ({ ...prev, invoice_url: e.target.value }))}
              />
              <p className="text-xs text-slate-500">Paste a link to the product invoice (Google Drive, etc.)</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-600" />
                Logistics Invoice URL
              </Label>
              <Input
                placeholder="https://drive.google.com/..."
                value={invoiceUploadForm.logistics_invoice_url}
                onChange={(e) => setInvoiceUploadForm(prev => ({ ...prev, logistics_invoice_url: e.target.value }))}
              />
              <p className="text-xs text-slate-500">Paste a link to the logistics/shipping invoice</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceUploadDialog(false)} disabled={uploadingInvoice}>
              Cancel
            </Button>
            <Button onClick={handleInvoiceUpload} disabled={uploadingInvoice}>
              {uploadingInvoice ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Invoices
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrdersList;
