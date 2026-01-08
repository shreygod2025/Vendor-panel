import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../App";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  Package,
  DollarSign,
  AlertTriangle,
  CalendarClock
} from "lucide-react";
import { toast } from "sonner";

const VendorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upcomingDeliveries, setUpcomingDeliveries] = useState([]);
  const [pendingIssues, setPendingIssues] = useState([]);
  const [earnings, setEarnings] = useState({ total: 0, paid: 0, pending: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, posRes, issuesRes, invoicesRes, paymentsRes] = await Promise.all([
        apiClient.get("/dashboard/stats"),
        apiClient.get("/purchase-orders"),
        apiClient.get("/issues"),
        apiClient.get("/invoices"),
        apiClient.get("/payments")
      ]);
      
      setStats(statsRes.data);
      
      // Filter POs that are sent or confirmed (not draft) for upcoming deliveries
      const pos = posRes.data.filter(po => po.status !== "draft");
      const upcoming = pos.filter(po => 
        po.status === "sent" || po.status === "confirmed"
      ).slice(0, 5);
      setUpcomingDeliveries(upcoming);
      
      // Filter issues that are open
      const openIssues = (issuesRes.data || []).filter(i => i.status === "open");
      setPendingIssues(openIssues.slice(0, 5));
      
      // Calculate earnings
      const invoices = invoicesRes.data || [];
      const payments = paymentsRes.data || [];
      const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0);
      const totalPaid = payments.reduce((sum, pay) => sum + pay.amount, 0);
      setEarnings({
        total: totalInvoiced,
        paid: totalPaid,
        pending: totalInvoiced - totalPaid
      });
    } catch (error) {
      toast.error("Failed to fetch dashboard stats");
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
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      sent: "bg-blue-100 text-blue-700",
      confirmed: "bg-indigo-100 text-indigo-700",
      dispatched: "bg-amber-100 text-amber-700",
      delivered: "bg-emerald-100 text-emerald-700",
      closed: "bg-slate-100 text-slate-500"
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

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="vendor-dashboard">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Vendor Dashboard</h1>
        <p className="page-subtitle">Manage your purchase orders and deliveries</p>
      </div>

      <div className="page-container space-y-6">
        {/* Pending Actions Alert */}
        {(stats?.pending_pos > 0 || stats?.pending_returns > 0) && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-blue-800">
                    You have pending actions
                  </p>
                  <p className="text-sm text-blue-600">
                    {stats?.pending_pos > 0 && `${stats.pending_pos} PO(s) awaiting confirmation`}
                    {stats?.pending_pos > 0 && stats?.pending_returns > 0 && " • "}
                    {stats?.pending_returns > 0 && `${stats.pending_returns} return(s) pending`}
                  </p>
                </div>
                <Link to="/vendor/purchase-orders">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    Take Action
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Grid - 3 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Upcoming Deliveries */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-blue-600" />
                  Upcoming Deliveries
                </CardTitle>
                <Link to="/vendor/purchase-orders" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingDeliveries.length > 0 ? (
                <div className="space-y-3">
                  {upcomingDeliveries.map((po) => (
                    <Link 
                      key={po.id} 
                      to={`/vendor/purchase-orders/${po.id}`}
                      className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm font-medium">{po.po_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(po.status)}`}>
                          {po.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">
                          {po.status === "sent" ? "Awaiting Confirmation" : "Ready to Dispatch"}
                        </span>
                        <span className="text-sm font-mono">{formatCurrency(po.grand_total)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No pending deliveries</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Issues */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Pending Issues
                  {pendingIssues.length > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      {pendingIssues.length}
                    </span>
                  )}
                </CardTitle>
                <Link to="/vendor/issues" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {pendingIssues.length > 0 ? (
                <div className="space-y-3">
                  {pendingIssues.map((issue) => (
                    <div 
                      key={issue.id}
                      className="p-3 rounded-lg bg-slate-50"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm">{issue.issue_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 truncate">{issue.description}</p>
                      <p className="text-xs text-slate-400 mt-1 capitalize">{issue.issue_type?.replace('_', ' ')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No pending issues</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Earnings */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Earnings
                </CardTitle>
                <Link to="/vendor/payments" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  Details <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <p className="text-sm text-emerald-600">Total Invoiced</p>
                  <p className="text-2xl font-bold text-emerald-700 font-mono">
                    {formatCurrency(earnings.total)}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600">Received</p>
                    <p className="text-lg font-bold text-blue-700 font-mono">
                      {formatCurrency(earnings.paid)}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <p className="text-xs text-amber-600">Pending</p>
                    <p className="text-lg font-bold text-amber-700 font-mono">
                      {formatCurrency(earnings.pending)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link to="/vendor/purchase-orders">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <span>View POs</span>
                </Button>
              </Link>
              <Link to="/vendor/invoices">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <FileText className="w-6 h-6 text-purple-600" />
                  <span>Upload Invoice</span>
                </Button>
              </Link>
              <Link to="/vendor/returns">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <RotateCcw className="w-6 h-6 text-amber-600" />
                  <span>View Returns</span>
                </Button>
              </Link>
              <Link to="/vendor/payments">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  <span>Payment Status</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorDashboard;
