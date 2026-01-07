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
import { Plus, Search, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const ReturnsList = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
      credit_issued: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  const filteredReturns = returns.filter((ret) => {
    const matchesSearch = ret.return_number.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || ret.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div data-testid="returns-list-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Returns</h1>
            <p className="page-subtitle">Manage product returns</p>
          </div>
          <Link to="/oll/returns/new">
            <Button className="bg-[#1e3a8a] hover:bg-[#1e40af]" data-testid="create-return-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create Return
            </Button>
          </Link>
        </div>
      </div>

      <div className="page-container">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by return number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="credit_issued">Credit Issued</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="empty-state py-12">
              <RotateCcw className="empty-state-icon" />
              <p className="empty-state-title">No returns found</p>
              <p className="empty-state-text">Create a return request when needed</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Return Number</TableHead>
                  <TableHead>PO ID</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.map((ret) => (
                  <TableRow key={ret.id} data-testid={`return-row-${ret.id}`}>
                    <TableCell className="font-mono font-medium">{ret.return_number}</TableCell>
                    <TableCell className="font-mono text-sm">{ret.po_id.slice(0, 8)}...</TableCell>
                    <TableCell>{ret.vendor_name}</TableCell>
                    <TableCell>{ret.items?.length || 0} items</TableCell>
                    <TableCell>
                      <span className={`badge ${getStatusColor(ret.status)}`}>
                        {ret.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(ret.created_at)}</TableCell>
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

export default ReturnsList;
