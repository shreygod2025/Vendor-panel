import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../App";
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
import { Plus, Search, Eye, FileText, ExternalLink, Check, Circle, Clock, Truck, Package, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const PurchaseOrdersList = () => {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("confirmation");
  const [expandedSections, setExpandedSections] = useState({
    raised: true,
    confirmed: true,
    changes: true
  });

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

  const getTrackingUrl = (token) => {
    return `${window.location.origin}/track/${token}`;
  };

  const copyTrackingLink = (token) => {
    navigator.clipboard.writeText(getTrackingUrl(token));
    toast.success("Tracking link copied to clipboard");
  };

  // Filter orders by search and vendor
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.po_number.toLowerCase().includes(search.toLowerCase());
    const matchesVendor = vendorFilter === "all" || order.vendor_id === vendorFilter;
    return matchesSearch && matchesVendor;
  });

  // Categorize orders by status
  const categorizedOrders = {
    // PO Confirmation section
    raised: filteredOrders.filter(o => o.status === "draft" || o.status === "sent"),
    confirmed: filteredOrders.filter(o => o.status === "confirmed"),
    changes: filteredOrders.filter(o => o.status === "rejected"),
    // Dispatched section
    dispatched: filteredOrders.filter(o => o.status === "dispatched"),
    // Delivered section
    delivered: filteredOrders.filter(o => o.status === "delivered" || o.status === "closed")
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const renderOrderRow = (order) => (
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
  );

  const renderTable = (ordersList, emptyMessage) => {
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
            <TableHead>Items</TableHead>
            <TableHead>Grand Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordersList.map(renderOrderRow)}
        </TableBody>
      </Table>
    );
  };

  const renderSubSection = (title, orders, sectionKey, icon, iconColor) => {
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
            {renderTable(orders, `No ${title.toLowerCase()} orders`)}
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
          <Tabs defaultValue="confirmation" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-auto p-1">
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
                  <span className="text-xs opacity-70">({categorizedOrders.dispatched.length})</span>
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

            <TabsContent value="dispatched">
              <Card>
                <CardContent className="p-4">
                  {renderTable(categorizedOrders.dispatched, "No dispatched orders")}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="delivered">
              <Card>
                <CardContent className="p-4">
                  {renderTable(categorizedOrders.delivered, "No delivered orders")}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default PurchaseOrdersList;
