import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient, useAuth } from "../../App";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { CalendarClock, Eye, Truck, MapPin, Package } from "lucide-react";
import { toast } from "sonner";

const DeliveriesPage = () => {
  const { user } = useAuth();
  const isOLL = user?.role === "oll";
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    try {
      const response = await apiClient.get("/deliveries/upcoming");
      setDeliveries(response.data);
    } catch (error) {
      toast.error("Failed to fetch deliveries");
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
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      confirmed: "bg-indigo-100 text-indigo-700",
      dispatched: "bg-amber-100 text-amber-700"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  const getDaysUntilDelivery = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    const delivery = new Date(dateString);
    const diff = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div data-testid="deliveries-page">
      <div className="page-header">
        <h1 className="page-title">Upcoming Deliveries</h1>
        <p className="page-subtitle">Track and manage upcoming deliveries</p>
      </div>

      <div className="page-container">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{deliveries.filter(d => d.status === 'confirmed').length}</p>
                  <p className="text-sm text-slate-500">Awaiting Dispatch</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{deliveries.filter(d => d.status === 'dispatched').length}</p>
                  <p className="text-sm text-slate-500">In Transit</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{deliveries.length}</p>
                  <p className="text-sm text-slate-500">Total Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deliveries Table */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : deliveries.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No upcoming deliveries</p>
                <p className="text-sm">All deliveries have been completed or there are no confirmed orders</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead>Delivery Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dispatch Info</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery) => {
                    const daysUntil = getDaysUntilDelivery(delivery.delivery_date);
                    return (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <span className="font-mono font-medium">{delivery.po_number}</span>
                          <p className="text-xs text-slate-500">{delivery.items_count} items</p>
                        </TableCell>
                        <TableCell>{delivery.vendor_name}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatDate(delivery.delivery_date)}</p>
                            {daysUntil !== null && (
                              <p className={`text-xs ${daysUntil < 0 ? 'text-red-600' : daysUntil <= 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                                {daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : 
                                 daysUntil === 0 ? 'Due today' : 
                                 daysUntil === 1 ? 'Due tomorrow' : 
                                 `In ${daysUntil} days`}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-1 max-w-[200px]">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <span className="text-sm truncate">{delivery.delivery_address}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`badge ${getStatusColor(delivery.status)}`}>
                            {delivery.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {delivery.dispatch ? (
                            <div className="text-sm">
                              <p className="font-medium">{delivery.dispatch.courier_partner}</p>
                              <p className="text-xs text-slate-500 font-mono">{delivery.dispatch.tracking_id}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">Not dispatched</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to={`${isOLL ? '/oll' : '/vendor'}/purchase-orders/${delivery.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeliveriesPage;
