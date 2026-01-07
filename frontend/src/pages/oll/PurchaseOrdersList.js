import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../App";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
import { Plus, Search, Eye, FileText, ExternalLink, Check, Circle } from "lucide-react";
import { toast } from "sonner";

const PurchaseOrdersList = () => {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, vendorsRes] = await Promise.all([
        apiClient.get("/purchase-orders"),
        apiClient.get("/vendors")
      ]);
      setOrders(ordersRes.data);
      setVendors(vendorsRes.data);
    } catch (error) {
      toast.error("Failed to fetch purchase orders");
    } finally {
      setLoading(false);
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
      draft: "status-draft",
      sent: "status-sent",
      confirmed: "status-confirmed",
      dispatched: "status-dispatched",
      delivered: "status-delivered",
      closed: "status-closed",
      rejected: "status-rejected"
    };
    return colors[status] || "status-draft";
  };

  // Stage progress indicator
  const renderStageProgress = (currentStatus) => {
    const stages = [
      { key: "confirmed", label: "Confirmed" },
      { key: "dispatched", label: "Dispatched" },
      { key: "delivered", label: "Delivered" }
    ];
    
    const statusOrder = ["draft", "sent", "confirmed", "dispatched", "delivered", "closed"];
    const currentIndex = statusOrder.indexOf(currentStatus);
    
    // Only show for confirmed, dispatched, delivered statuses
    if (currentIndex < 2) return null;
    
    return (
      <div className="flex items-center gap-1 mt-1">
        {stages.map((stage, idx) => {
          const stageIndex = statusOrder.indexOf(stage.key);
          const isCompleted = currentIndex >= stageIndex;
          const isCurrent = currentStatus === stage.key;
          
          return (
            <div key={stage.key} className="flex items-center">
              <div 
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  isCompleted 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-200 text-slate-400'
                } ${isCurrent ? 'ring-2 ring-emerald-300' : ''}`}
                title={stage.label}
              >
                {isCompleted ? <Check className="w-3 h-3" /> : <Circle className="w-2 h-2" />}
              </div>
              {idx < stages.length - 1 && (
                <div className={`w-3 h-0.5 ${currentIndex > stageIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.po_number.toLowerCase().includes(search.toLowerCase());
    const matchesVendor = vendorFilter === "all" || order.vendor_id === vendorFilter;
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesVendor && matchesStatus;
  });

  const getTrackingUrl = (token) => {
    return `${window.location.origin}/track/${token}`;
  };

  const copyTrackingLink = (token) => {
    navigator.clipboard.writeText(getTrackingUrl(token));
    toast.success("Tracking link copied to clipboard");
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
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
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Grand Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} data-testid={`po-row-${order.id}`}>
                    <TableCell>
                      <span className="font-mono font-medium text-slate-900">{order.po_number}</span>
                    </TableCell>
                    <TableCell>{order.vendor_name}</TableCell>
                    <TableCell>{order.line_items?.length || 0} items</TableCell>
                    <TableCell className="font-mono font-medium">{formatCurrency(order.grand_total)}</TableCell>
                    <TableCell>
                      <span className={`badge ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(order.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/oll/purchase-orders/${order.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`view-po-${order.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyTrackingLink(order.tracking_token)}
                          title="Copy tracking link"
                          data-testid={`copy-tracking-${order.id}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrdersList;
