import { useState, useEffect } from "react";
import { apiClient } from "../../App";
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
import { Search, History } from "lucide-react";
import { toast } from "sonner";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await apiClient.get("/audit-logs?limit=200");
      setLogs(response.data);
    } catch (error) {
      toast.error("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionColor = (action) => {
    if (action.includes('CREATE')) return 'bg-emerald-100 text-emerald-700';
    if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-700';
    if (action.includes('DELETE')) return 'bg-red-100 text-red-700';
    if (action.includes('SEND') || action.includes('CONFIRM')) return 'bg-indigo-100 text-indigo-700';
    return 'bg-slate-100 text-slate-600';
  };

  const filteredLogs = logs.filter((log) => {
    return entityFilter === "all" || log.entity_type === entityFilter;
  });

  return (
    <div data-testid="audit-logs-page">
      <div className="page-header">
        <h1 className="page-title">Audit Logs</h1>
        <p className="page-subtitle">Track all system activities</p>
      </div>

      <div className="page-container">
        <div className="flex gap-4 mb-6">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="vendor">Vendors</SelectItem>
              <SelectItem value="product">Products</SelectItem>
              <SelectItem value="purchase_order">Purchase Orders</SelectItem>
              <SelectItem value="dispatch">Dispatch</SelectItem>
              <SelectItem value="invoice">Invoices</SelectItem>
              <SelectItem value="payment">Payments</SelectItem>
              <SelectItem value="return">Returns</SelectItem>
              <SelectItem value="credit_note">Credit Notes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="empty-state py-12">
              <History className="empty-state-icon" />
              <p className="empty-state-title">No audit logs found</p>
              <p className="empty-state-text">System activities will be logged here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-slate-500 text-sm">{formatDate(log.timestamp)}</TableCell>
                    <TableCell>
                      <span className={`badge ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">{log.entity_type.replace('_', ' ')}</TableCell>
                    <TableCell>{log.username}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-slate-500">
                      {JSON.stringify(log.details).slice(0, 50)}...
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

export default AuditLogs;
