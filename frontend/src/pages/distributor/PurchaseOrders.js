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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import { Plus, Search, Eye, Package, Truck, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const DistributorPurchaseOrders = () => {
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    try {
      const response = await apiClient.get("/purchase-orders");
      setPOs(response.data);
    } catch (error) {
      toast.error("Failed to fetch purchase orders");
    } finally {
      setLoading(false);
    }
  };

  const filteredPOs = pos.filter((po) => {
    const matchesSearch = 
      po.po_number.toLowerCase().includes(search.toLowerCase()) ||
      po.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
      po.delivery_address.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Group POs by status category
  const pendingPOs = filteredPOs.filter(po => ["sent"].includes(po.status));
  const confirmedPOs = filteredPOs.filter(po => ["confirmed"].includes(po.status));
  const dispatchedPOs = filteredPOs.filter(po => ["dispatched", "pending_approval"].includes(po.status));
  const deliveredPOs = filteredPOs.filter(po => ["delivered", "closed"].includes(po.status));

  const getStatusBadge = (status) => {
    const styles = {
      sent: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-blue-100 text-blue-700",
      dispatched: "bg-purple-100 text-purple-700",
      pending_approval: "bg-orange-100 text-orange-700",
      delivered: "bg-green-100 text-green-700",
      closed: "bg-slate-100 text-slate-700",
    };
    return styles[status] || "bg-slate-100 text-slate-600";
  };

  const POTable = ({ data, showTracking = false }) => (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50">
          <TableHead>PO Number</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead>Delivery Address</TableHead>
          <TableHead>Delivery Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Items</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-slate-500">
              No purchase orders found
            </TableCell>
          </TableRow>
        ) : (
          data.map((po) => (
            <TableRow key={po.id}>
              <TableCell>
                <span className="font-mono text-sm font-medium">{po.po_number}</span>
              </TableCell>
              <TableCell>{po.vendor_name}</TableCell>
              <TableCell className="max-w-[200px] truncate">{po.delivery_address}</TableCell>
              <TableCell>{po.delivery_date || '-'}</TableCell>
              <TableCell>
                <span className={`badge ${getStatusBadge(po.status)}`}>
                  {po.status.replace('_', ' ')}
                </span>
              </TableCell>
              <TableCell>{po.line_items?.length || 0} items</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link to={`/distributor/purchase-orders/${po.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </Link>
                  {showTracking && po.tracking_token && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const url = `${window.location.origin}/track/${po.tracking_token}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Tracking link copied!");
                      }}
                    >
                      <Truck className="w-4 h-4 mr-1" />
                      Copy Link
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div data-testid="distributor-purchase-orders">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">My Purchase Orders</h1>
            <p className="page-subtitle">Manage and track your purchase orders</p>
          </div>
          <Link to="/distributor/purchase-orders/new">
            <Button className="bg-[#1e3a8a] hover:bg-[#1e40af]">
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
              placeholder="Search by PO number, vendor, or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sent">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={["pending", "confirmed", "dispatched"]} className="space-y-4">
            {/* Pending Confirmation */}
            <AccordionItem value="pending" className="border rounded-lg bg-white">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="font-semibold">Pending Confirmation</span>
                  <span className="badge bg-yellow-100 text-yellow-700">{pendingPOs.length}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <POTable data={pendingPOs} />
              </AccordionContent>
            </AccordionItem>

            {/* Confirmed */}
            <AccordionItem value="confirmed" className="border rounded-lg bg-white">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold">Confirmed</span>
                  <span className="badge bg-blue-100 text-blue-700">{confirmedPOs.length}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <POTable data={confirmedPOs} showTracking />
              </AccordionContent>
            </AccordionItem>

            {/* Dispatched */}
            <AccordionItem value="dispatched" className="border rounded-lg bg-white">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold">In Transit</span>
                  <span className="badge bg-purple-100 text-purple-700">{dispatchedPOs.length}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <POTable data={dispatchedPOs} showTracking />
              </AccordionContent>
            </AccordionItem>

            {/* Delivered */}
            <AccordionItem value="delivered" className="border rounded-lg bg-white">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold">Delivered</span>
                  <span className="badge bg-green-100 text-green-700">{deliveredPOs.length}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <POTable data={deliveredPOs} showTracking />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </div>
  );
};

export default DistributorPurchaseOrders;
