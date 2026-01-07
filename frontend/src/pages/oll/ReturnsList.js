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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Plus, Search, RotateCcw, FileCheck, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

const ReturnsList = () => {
  const { user } = useAuth();
  const isOLL = user?.role === "oll";
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredReturns = returns.filter((ret) => {
    return ret.return_number.toLowerCase().includes(search.toLowerCase()) ||
           (ret.credit_note_number && ret.credit_note_number.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div data-testid="returns-list-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Returns & Credit Notes</h1>
            <p className="page-subtitle">Manage product returns and view credit notes</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                    <TableHead>Date</TableHead>
                    {isOLL && <TableHead className="text-right">Actions</TableHead>}
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
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{ret.po_number || '-'}</TableCell>
                      <TableCell>{ret.vendor_name}</TableCell>
                      <TableCell>{ret.items?.length || 0} items</TableCell>
                      <TableCell className="font-mono font-medium text-emerald-600">
                        {formatCurrency(ret.total_value || 0)}
                      </TableCell>
                      <TableCell className="text-slate-500">{formatDate(ret.created_at)}</TableCell>
                      {isOLL && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(ret.id)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReturnsList;
