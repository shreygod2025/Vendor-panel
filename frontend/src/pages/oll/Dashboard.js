import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../App";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Building2,
  Package,
  FileText,
  RotateCcw,
  TrendingUp,
  Clock,
  CheckCircle,
  Truck,
  Plus,
  ArrowRight,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const OLLDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get("/dashboard/stats");
      setStats(response.data);
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

  const getStatusColor = (status) => {
    const colors = {
      draft: "bg-slate-100 text-slate-600",
      sent: "bg-blue-100 text-blue-700",
      confirmed: "bg-indigo-100 text-indigo-700",
      dispatched: "bg-amber-100 text-amber-700",
      delivered: "bg-emerald-100 text-emerald-700",
      closed: "bg-slate-100 text-slate-500",
      rejected: "bg-red-100 text-red-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="oll-dashboard">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Welcome to OLL Vendor Management System</p>
          </div>
          <Link to="/oll/purchase-orders/new">
            <Button className="bg-[#1e3a8a] hover:bg-[#1e40af]" data-testid="create-po-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create PO
            </Button>
          </Link>
        </div>
      </div>

      <div className="page-container space-y-6">
        {/* Stats Grid */}
        <div className="stats-grid">
          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="stat-icon bg-blue-100">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="stat-value">{stats?.total_vendors || 0}</div>
              <div className="stat-label">Total Vendors</div>
              <div className="mt-2 text-xs text-emerald-600">
                {stats?.active_vendors || 0} active
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="stat-icon bg-purple-100">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div className="stat-value">{stats?.total_products || 0}</div>
              <div className="stat-label">Products</div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="stat-icon bg-emerald-100">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="stat-value">{stats?.total_pos || 0}</div>
              <div className="stat-label">Purchase Orders</div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="stat-icon bg-amber-100">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <div className="stat-value">{stats?.pending_returns || 0}</div>
              <div className="stat-label">Pending Returns</div>
            </CardContent>
          </Card>
        </div>

        {/* PO Status Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-slate-400" />
              PO Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {stats?.po_by_status && Object.entries(stats.po_by_status).map(([status, count]) => (
                <div 
                  key={status} 
                  className="text-center p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="text-2xl font-bold text-slate-900">{count}</div>
                  <div className={`mt-1 text-xs font-medium px-2 py-0.5 rounded-full inline-block ${getStatusColor(status)}`}>
                    {status.replace("_", " ")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Purchase Orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-400" />
                  Recent Purchase Orders
                </CardTitle>
                <Link to="/oll/purchase-orders" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.recent_pos?.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_pos.map((po) => (
                    <Link 
                      key={po.id} 
                      to={`/oll/purchase-orders/${po.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{po.po_number}</p>
                        <p className="text-sm text-slate-500">{formatCurrency(po.grand_total)}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(po.status)}`}>
                        {po.status}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No purchase orders yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/oll/vendors/new">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                    <Building2 className="w-6 h-6 text-blue-600" />
                    <span>Add Vendor</span>
                  </Button>
                </Link>
                <Link to="/oll/products/new">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                    <Package className="w-6 h-6 text-purple-600" />
                    <span>Add Product</span>
                  </Button>
                </Link>
                <Link to="/oll/purchase-orders/new">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                    <FileText className="w-6 h-6 text-emerald-600" />
                    <span>Create PO</span>
                  </Button>
                </Link>
                <Link to="/oll/returns/new">
                  <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                    <RotateCcw className="w-6 h-6 text-amber-600" />
                    <span>Create Return</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Section */}
        {stats?.pending_returns > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800">
                    {stats.pending_returns} pending return{stats.pending_returns > 1 ? 's' : ''} require attention
                  </p>
                  <p className="text-sm text-amber-600">Review and process these returns</p>
                </div>
                <Link to="/oll/returns">
                  <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                    View Returns
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OLLDashboard;
