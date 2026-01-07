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
  Package
} from "lucide-react";
import { toast } from "sonner";

const VendorDashboard = () => {
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
      sent: "bg-blue-100 text-blue-700",
      confirmed: "bg-indigo-100 text-indigo-700",
      dispatched: "bg-amber-100 text-amber-700",
      delivered: "bg-emerald-100 text-emerald-700",
      closed: "bg-slate-100 text-slate-500"
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

        {/* Stats Grid */}
        <div className="stats-grid">
          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="stat-icon bg-blue-100">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="stat-value">{stats?.total_pos || 0}</div>
              <div className="stat-label">Total POs</div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="stat-icon bg-amber-100">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="stat-value">{stats?.pending_pos || 0}</div>
              <div className="stat-label">Awaiting Confirmation</div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="stat-icon bg-indigo-100">
                <Truck className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="stat-value">{stats?.po_by_status?.dispatched || 0}</div>
              <div className="stat-label">In Transit</div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="stat-icon bg-emerald-100">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="stat-value">{stats?.po_by_status?.delivered || 0}</div>
              <div className="stat-label">Delivered</div>
            </CardContent>
          </Card>
        </div>

        {/* PO Status Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Order Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {stats?.po_by_status && Object.entries(stats.po_by_status).map(([status, count]) => (
                <div 
                  key={status} 
                  className="text-center p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="text-2xl font-bold text-slate-900">{count}</div>
                  <div className={`mt-1 text-xs font-medium px-2 py-0.5 rounded-full inline-block ${getStatusColor(status)}`}>
                    {status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent POs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                Recent Purchase Orders
              </CardTitle>
              <Link to="/vendor/purchase-orders" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
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
                    to={`/vendor/purchase-orders/${po.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{po.po_number}</p>
                      <p className="text-sm text-slate-500">{formatCurrency(po.grand_total)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(po.status)}`}>
                        {po.status}
                      </span>
                      {po.status === "sent" && (
                        <span className="text-xs text-blue-600 font-medium">Action Required</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
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
