import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../App";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  CalendarClock,
  AlertTriangle,
  CreditCard,
  Plus,
  ArrowRight,
  Truck,
  Clock,
  FileText,
  Building2,
  Package,
  RotateCcw,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";

const OLLDashboard = () => {
  const [stats, setStats] = useState(null);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "OLL - Dashboard";
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [statsRes, invoicesRes] = await Promise.all([
        apiClient.get("/dashboard/stats"),
        apiClient.get("/invoices")
      ]);
      setStats(statsRes.data);
      
      // Calculate pending invoices with due date info
      const invoices = invoicesRes.data || [];
      const pending = invoices
        .filter(inv => {
          const paidAmount = inv.paid_amount || 0;
          return paidAmount < inv.amount;
        })
        .map(inv => {
          const invoiceDate = new Date(inv.invoice_date);
          const dueDate = new Date(invoiceDate);
          dueDate.setDate(dueDate.getDate() + 7);
          const today = new Date();
          const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
          
          return {
            ...inv,
            dueDate,
            daysRemaining,
            isOverdue: daysRemaining < 0,
            pendingAmount: inv.amount - (inv.paid_amount || 0)
          };
        })
        .sort((a, b) => a.daysRemaining - b.daysRemaining);
      
      setPendingInvoices(pending);
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
      confirmed: "bg-indigo-100 text-indigo-700",
      dispatched: "bg-amber-100 text-amber-700",
      open: "bg-red-100 text-red-700",
      pending: "bg-yellow-100 text-yellow-700",
      partially_paid: "bg-blue-100 text-blue-700"
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

  const getDueDateStatus = (daysRemaining) => {
    if (daysRemaining < 0) {
      return { label: `${Math.abs(daysRemaining)}d overdue`, color: "bg-red-100 text-red-700" };
    } else if (daysRemaining <= 3) {
      return { label: `${daysRemaining}d left`, color: "bg-amber-100 text-amber-700" };
    } else {
      return { label: `${daysRemaining}d left`, color: "bg-emerald-100 text-emerald-700" };
    }
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
    <div data-testid="oll-dashboard">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Overview of your vendor management system</p>
          </div>
          <Link to="/oll/analytics">
            <Button variant="outline">
              <BarChart3 className="w-4 h-4 mr-2" />
              View Analytics
            </Button>
          </Link>
        </div>
      </div>

      <div className="page-container space-y-6">
        {/* Quick Actions - Now at the top */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Link to="/oll/purchase-orders/new">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <span className="text-sm">Create PO</span>
                </Button>
              </Link>
              <Link to="/oll/vendors/new">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <Building2 className="w-6 h-6 text-purple-600" />
                  <span className="text-sm">Add Vendor</span>
                </Button>
              </Link>
              <Link to="/oll/products/new">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <Package className="w-6 h-6 text-emerald-600" />
                  <span className="text-sm">Add Product</span>
                </Button>
              </Link>
              <Link to="/oll/issues">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                  <span className="text-sm">View Issues</span>
                </Button>
              </Link>
              <Link to="/oll/returns">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <RotateCcw className="w-6 h-6 text-red-600" />
                  <span className="text-sm">Create Return</span>
                </Button>
              </Link>
              <Link to="/oll/analytics">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                  <span className="text-sm">Analytics</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Main Grid - Cards below */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Upcoming Deliveries */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-blue-600" />
                  Upcoming Deliveries
                </CardTitle>
                <Link to="/oll/deliveries" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.upcoming_deliveries?.length > 0 ? (
                <div className="space-y-3">
                  {stats.upcoming_deliveries.slice(0, 4).map((delivery) => (
                    <Link 
                      key={delivery.id} 
                      to={`/oll/purchase-orders/${delivery.id}`}
                      className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm font-medium">{delivery.po_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(delivery.status)}`}>
                          {delivery.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(delivery.delivery_date)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No upcoming deliveries</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Issues */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Pending Issues
                  {stats?.pending_issues > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      {stats.pending_issues}
                    </span>
                  )}
                </CardTitle>
                <Link to="/oll/issues" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.open_issues?.length > 0 ? (
                <div className="space-y-3">
                  {stats.open_issues.slice(0, 4).map((issue) => (
                    <Link 
                      key={issue.id}
                      to="/oll/issues"
                      className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm">{issue.issue_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 truncate">{issue.description}</p>
                      <p className="text-xs text-slate-400 mt-1 capitalize">{issue.issue_type.replace('_', ' ')}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No open issues</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Payments - Breakdown */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  Pending Payments
                </CardTitle>
                <Link to="/oll/invoices" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-emerald-50 rounded-lg">
                <p className="text-sm text-emerald-600">Total Pending</p>
                <p className="text-2xl font-bold text-emerald-700 font-mono">
                  {formatCurrency(pendingInvoices.reduce((sum, inv) => sum + inv.pendingAmount, 0))}
                </p>
              </div>
              
              {/* Payment Breakdown */}
              {pendingInvoices.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pendingInvoices.slice(0, 5).map((invoice) => {
                    const dueDateStatus = getDueDateStatus(invoice.daysRemaining);
                    return (
                      <div key={invoice.id} className="p-2 rounded-lg bg-slate-50 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700">{invoice.vendor_name || "Unknown"}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${dueDateStatus.color}`}>
                            {dueDateStatus.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-500 text-xs">Due: {formatDate(invoice.dueDate)}</span>
                          <span className="font-mono font-medium">{formatCurrency(invoice.pendingAmount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-2">No pending payments</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OLLDashboard;
