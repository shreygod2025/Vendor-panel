import { useState, useEffect } from "react";
import { apiClient, useAuth } from "../../App";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Plus, AlertTriangle, Loader2, Edit, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const IssuesPage = () => {
  const { user } = useAuth();
  const isOLL = user?.role === "oll";
  const [issues, setIssues] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [formData, setFormData] = useState({
    po_id: "",
    issue_type: "",
    description: "",
    priority: "medium"
  });

  const [resolution, setResolution] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [issuesRes, posRes] = await Promise.all([
        apiClient.get("/issues"),
        apiClient.get("/purchase-orders")
      ]);
      setIssues(issuesRes.data);
      setPurchaseOrders(posRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/issues", formData);
      toast.success("Issue created successfully");
      setShowDialog(false);
      setFormData({ po_id: "", issue_type: "", description: "", priority: "medium" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create issue");
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedIssue) return;
    setSaving(true);
    try {
      await apiClient.put(`/issues/${selectedIssue.id}`, {
        status: "resolved",
        resolution: resolution
      });
      toast.success("Issue resolved successfully");
      setShowResolveDialog(false);
      setSelectedIssue(null);
      setResolution("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to resolve issue");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this issue?")) return;
    try {
      await apiClient.delete(`/issues/${id}`);
      toast.success("Issue deleted successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete issue");
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
      open: "bg-red-100 text-red-700",
      in_progress: "bg-blue-100 text-blue-700",
      resolved: "bg-emerald-100 text-emerald-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: "bg-red-100 text-red-700",
      high: "bg-orange-100 text-orange-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-slate-100 text-slate-600"
    };
    return colors[priority] || "bg-slate-100 text-slate-600";
  };

  const issueTypes = [
    { value: "delivery_delay", label: "Delivery Delay" },
    { value: "missing_components", label: "Missing Components" },
    { value: "damaged_goods", label: "Damaged Goods" },
    { value: "quality_issue", label: "Quality Issue" },
    { value: "wrong_item", label: "Wrong Item Delivered" },
    { value: "other", label: "Other" }
  ];

  const filteredIssues = issues.filter(issue => 
    statusFilter === "all" || issue.status === statusFilter
  );

  return (
    <div data-testid="issues-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Issues</h1>
            <p className="page-subtitle">Track and resolve delivery issues</p>
          </div>
          {isOLL && (
            <Button 
              className="bg-[#1e3a8a] hover:bg-[#1e40af]" 
              onClick={() => setShowDialog(true)}
              data-testid="create-issue-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Report Issue
            </Button>
          )}
        </div>
      </div>

      <div className="page-container">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className={statusFilter === "open" ? "ring-2 ring-blue-500" : ""} onClick={() => setStatusFilter("open")}>
            <CardContent className="p-4 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{issues.filter(i => i.status === 'open').length}</p>
                  <p className="text-sm text-slate-500">Open Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={statusFilter === "in_progress" ? "ring-2 ring-blue-500" : ""} onClick={() => setStatusFilter("in_progress")}>
            <CardContent className="p-4 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{issues.filter(i => i.status === 'in_progress').length}</p>
                  <p className="text-sm text-slate-500">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={statusFilter === "all" ? "ring-2 ring-blue-500" : ""} onClick={() => setStatusFilter("all")}>
            <CardContent className="p-4 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{issues.filter(i => i.status === 'resolved').length}</p>
                  <p className="text-sm text-slate-500">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Issues Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No issues found</p>
                <p className="text-sm">All issues have been resolved or no issues reported</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Issue #</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell className="font-mono font-medium">{issue.issue_number}</TableCell>
                      <TableCell className="font-mono text-sm">{issue.po_number}</TableCell>
                      <TableCell className="capitalize">{issue.issue_type.replace('_', ' ')}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{issue.description}</TableCell>
                      <TableCell>
                        <span className={`badge ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`badge ${getStatusColor(issue.status)}`}>
                          {issue.status.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500">{formatDate(issue.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {issue.status !== "resolved" && isOLL && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedIssue(issue);
                                setShowResolveDialog(true);
                              }}
                              className="text-emerald-600 hover:bg-emerald-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {isOLL && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(issue.id)}
                              className="text-red-600 hover:bg-red-50"
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

      {/* Create Issue Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Issue</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Purchase Order</Label>
              <Select value={formData.po_id} onValueChange={(v) => setFormData(prev => ({ ...prev, po_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PO" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>{po.po_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Issue Type</Label>
                <Select value={formData.issue_type} onValueChange={(v) => setFormData(prev => ({ ...prev, issue_type: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {issueTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the issue in detail..."
                rows={4}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#1e3a8a] hover:bg-[#1e40af]" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Issue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resolve Issue Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Issue</p>
              <p className="font-medium">{selectedIssue?.issue_number}</p>
              <p className="text-sm mt-2">{selectedIssue?.description}</p>
            </div>
            <div>
              <Label>Resolution Details</Label>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Describe how the issue was resolved..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowResolveDialog(false)}>Cancel</Button>
            <Button onClick={handleResolve} className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IssuesPage;
