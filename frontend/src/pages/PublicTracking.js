import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Package,
  Truck,
  Check,
  Clock,
  Loader2,
  AlertCircle,
  MapPin,
  Calendar,
  CheckCircle
} from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const OLL_LOGO = "https://customer-assets.emergentagent.com/job_vendormate-20/artifacts/ze7saivu_OLL-horizontal-logo-1.png";

const PublicTracking = () => {
  const { trackingToken } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTrackingData();
  }, [trackingToken]);

  const fetchTrackingData = async () => {
    try {
      const response = await axios.get(`${API}/track/${trackingToken}`);
      setData(response.data);
    } catch (err) {
      setError("Order not found or tracking link is invalid");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status, completed) => {
    if (completed) {
      return <Check className="w-4 h-4 text-white" />;
    }
    switch (status) {
      case 'dispatched':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <Package className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: "bg-slate-100 text-slate-600",
      sent: "bg-blue-100 text-blue-700",
      confirmed: "bg-indigo-100 text-indigo-700",
      dispatched: "bg-amber-100 text-amber-700",
      pending_approval: "bg-purple-100 text-purple-700",
      delivered: "bg-emerald-100 text-emerald-700",
      closed: "bg-slate-700 text-white"
    };
    return colors[status] || "bg-slate-100 text-slate-600";
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: "Draft",
      sent: "Sent",
      confirmed: "Confirmed",
      dispatched: "In Transit",
      pending_approval: "Pending Approval",
      delivered: "Delivered",
      closed: "Closed"
    };
    return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Tracking Error</h2>
            <p className="text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="public-tracking-page">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <img src={OLL_LOGO} alt="OLL" className="h-10" />
          <span className="text-sm text-slate-500">Order Tracking</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Order Info */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{data.po_number}</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Order from {data.vendor_name}</p>
              </div>
              <div className={`badge px-4 py-2 text-sm font-medium rounded-full ${getStatusColor(data.status)}`}>
                {getStatusLabel(data.status)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Delivery Address</p>
                  <p className="font-medium">{data.delivery_address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Expected Delivery</p>
                  <p className="font-medium">{data.delivery_date || 'To be confirmed'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Timeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {data.timeline?.map((step, index) => (
                <div key={step.status} className="flex items-start mb-6 last:mb-0">
                  <div className="relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step.completed ? 'bg-[#1e3a8a]' : 'bg-slate-200'
                    }`}>
                      {getStatusIcon(step.status, step.completed)}
                    </div>
                    {index < data.timeline.length - 1 && (
                      <div className={`absolute top-8 left-4 w-0.5 h-10 ${
                        step.completed ? 'bg-[#1e3a8a]' : 'bg-slate-200'
                      }`} />
                    )}
                  </div>
                  <div className="ml-4 flex-1">
                    <p className={`font-medium ${step.completed ? 'text-slate-900' : 'text-slate-400'}`}>
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="text-sm text-slate-500">{formatDate(step.date)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dispatch Details */}
        {data.dispatch && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Shipment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-slate-500">Courier Partner</p>
                  <p className="font-medium">{data.dispatch.courier_partner || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Tracking ID</p>
                  <p className="font-mono font-medium">{data.dispatch.tracking_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Dispatch Date</p>
                  <p className="font-medium">{data.dispatch.dispatch_date || '-'}</p>
                </div>
              </div>
              {data.dispatch.tracking_url && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Track Your Shipment</p>
                  <a 
                    href={data.dispatch.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Courier Tracking Page
                  </a>
                </div>
              )}
              {data.dispatch.expected_delivery_date && (
                <div className="mb-4">
                  <p className="text-sm text-slate-500">Expected Delivery</p>
                  <p className="font-medium text-emerald-600">{data.dispatch.expected_delivery_date}</p>
                </div>
              )}
              {data.dispatch.proof_url && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-slate-500 mb-2">Dispatch Proof</p>
                  {data.dispatch.proof_url.startsWith('data:image') ? (
                    <img 
                      src={data.dispatch.proof_url} 
                      alt="Dispatch Proof" 
                      className="max-w-xs rounded-lg border"
                    />
                  ) : data.dispatch.proof_url.startsWith('data:application/pdf') ? (
                    <a 
                      href={data.dispatch.proof_url} 
                      download="dispatch_proof.pdf"
                      className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <Package className="w-4 h-4" />
                      Download Dispatch Proof (PDF)
                    </a>
                  ) : (
                    <a 
                      href={data.dispatch.proof_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Dispatch Proof
                    </a>
                  )}
                </div>
              )}
              {data.dispatch.notes && (
                <div className="pt-4 border-t mt-4">
                  <p className="text-sm text-slate-500">Notes</p>
                  <p className="text-slate-700">{data.dispatch.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delivery Details */}
        {data.delivery && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Delivery Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {data.delivery.invoice_number && (
                  <div>
                    <p className="text-sm text-slate-500">Invoice Number</p>
                    <p className="font-mono font-medium">{data.delivery.invoice_number}</p>
                  </div>
                )}
                {data.delivery.logistics_cost > 0 && (
                  <div>
                    <p className="text-sm text-slate-500">Logistics Cost</p>
                    <p className="font-medium">₹{data.delivery.logistics_cost.toLocaleString()}</p>
                  </div>
                )}
                {data.delivery.delivered_at && (
                  <div>
                    <p className="text-sm text-slate-500">Delivered On</p>
                    <p className="font-medium">{formatDate(data.delivery.delivered_at)}</p>
                  </div>
                )}
              </div>
              {data.delivery.delivery_proof_url && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-slate-500 mb-2">Delivery Proof</p>
                  {data.delivery.delivery_proof_url.startsWith('data:image') ? (
                    <img 
                      src={data.delivery.delivery_proof_url} 
                      alt="Delivery Proof" 
                      className="max-w-xs rounded-lg border"
                    />
                  ) : (
                    <a 
                      href={data.delivery.delivery_proof_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Delivery Proof
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Order Items - Without Prices */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.line_items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <p className="font-medium">{item.product_name}</p>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{item.sku}</span>
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-slate-500">
          <p>This is an automated tracking page for OLL Vendor Management System</p>
        </div>
      </div>
    </div>
  );
};

export default PublicTracking;
