import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient, useAuth } from "../../App";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { 
  Package, 
  Truck, 
  AlertTriangle,
  Plus,
  ClipboardList,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

const DistributorDashboard = () => {
  const { user } = useAuth();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div data-testid="distributor-dashboard">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Welcome, {user?.name || 'Distributor'}</h1>
            <p className="page-subtitle">Manage your purchase orders and track deliveries</p>
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
        {/* Quick Actions */}
        <Card className="mb-6 border-blue-100 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-blue-900">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link to="/distributor/purchase-orders/new">
                <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-100">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Purchase Order
                </Button>
              </Link>
              <Link to="/distributor/purchase-orders">
                <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-100">
                  <ClipboardList className="w-4 h-4 mr-2" />
                  View All POs
                </Button>
              </Link>
              <Link to="/distributor/deliveries">
                <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-100">
                  <Truck className="w-4 h-4 mr-2" />
                  Track Deliveries
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Total Orders</p>
                  <p className="text-3xl font-bold text-slate-900">{stats?.total_pos || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">In Transit</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {(stats?.po_by_status?.dispatched || 0) + (stats?.po_by_status?.confirmed || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Open Issues</p>
                  <p className="text-3xl font-bold text-slate-900">{stats?.pending_issues || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "Pending Confirmation", key: "sent", color: "bg-yellow-100 text-yellow-800" },
                  { label: "Confirmed", key: "confirmed", color: "bg-blue-100 text-blue-800" },
                  { label: "Dispatched", key: "dispatched", color: "bg-purple-100 text-purple-800" },
                  { label: "Delivered", key: "delivered", color: "bg-green-100 text-green-800" },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-slate-600">{item.label}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${item.color}`}>
                      {stats?.po_by_status?.[item.key] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Upcoming Deliveries
              </CardTitle>
              <Link to="/distributor/deliveries">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {stats?.upcoming_deliveries?.length > 0 ? (
                <div className="space-y-3">
                  {stats.upcoming_deliveries.slice(0, 5).map((delivery, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="font-medium text-slate-900">{delivery.po_number}</p>
                        <p className="text-sm text-slate-500">{delivery.delivery_date || 'No date set'}</p>
                      </div>
                      <span className={`badge ${
                        delivery.status === 'dispatched' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {delivery.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">No upcoming deliveries</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DistributorDashboard;
