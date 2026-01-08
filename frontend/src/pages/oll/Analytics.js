import { useState, useEffect } from "react";
import { apiClient } from "../../App";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  Truck, 
  AlertTriangle, 
  Building2,
  DollarSign,
  CheckCircle,
  PieChart,
  Clock,
  XCircle
} from "lucide-react";
import { toast } from "sonner";

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  
  const [data, setData] = useState({
    vendors: [],
    products: [],
    purchaseOrders: [],
    issues: [],
    invoices: [],
    payments: []
  });

  const [analytics, setAnalytics] = useState({
    totalSpend: 0,
    totalOrders: 0,
    deliveredOrders: 0,
    onTimeDeliveries: 0,
    lateDeliveries: 0,
    issueFreePOs: 0,
    posWithIssues: 0,
    popularProducts: [],
    issueTypes: [],
    vendorSpend: [],
    monthlySpend: [],
    vendorPerformance: []
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (data.purchaseOrders.length > 0) {
      calculateAnalytics();
    }
  }, [data, monthFilter, vendorFilter]);

  const fetchAllData = async () => {
    try {
      const [vendorsRes, productsRes, posRes, issuesRes, invoicesRes, paymentsRes] = await Promise.all([
        apiClient.get("/vendors"),
        apiClient.get("/products"),
        apiClient.get("/purchase-orders"),
        apiClient.get("/issues"),
        apiClient.get("/invoices"),
        apiClient.get("/payments")
      ]);
      
      setData({
        vendors: vendorsRes.data,
        products: productsRes.data,
        purchaseOrders: posRes.data,
        issues: issuesRes.data,
        invoices: invoicesRes.data,
        payments: paymentsRes.data
      });
    } catch (error) {
      toast.error("Failed to fetch analytics data");
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = () => {
    let filteredPOs = [...data.purchaseOrders];
    let filteredIssues = [...data.issues];
    
    // Apply month filter
    if (monthFilter !== "all") {
      const [year, month] = monthFilter.split("-").map(Number);
      filteredPOs = filteredPOs.filter(po => {
        const poDate = new Date(po.created_at);
        return poDate.getFullYear() === year && poDate.getMonth() + 1 === month;
      });
      filteredIssues = filteredIssues.filter(issue => {
        const issueDate = new Date(issue.created_at);
        return issueDate.getFullYear() === year && issueDate.getMonth() + 1 === month;
      });
    }
    
    // Apply vendor filter
    if (vendorFilter !== "all") {
      filteredPOs = filteredPOs.filter(po => po.vendor_id === vendorFilter);
      filteredIssues = filteredIssues.filter(issue => {
        const po = data.purchaseOrders.find(p => p.id === issue.po_id);
        return po && po.vendor_id === vendorFilter;
      });
    }

    // Total spend (excluding drafts)
    const nonDraftPOs = filteredPOs.filter(po => po.status !== "draft");
    const totalSpend = nonDraftPOs.reduce((sum, po) => sum + (po.grand_total || 0), 0);
    const totalOrders = nonDraftPOs.length;

    // Delivery metrics
    const deliveredPOs = filteredPOs.filter(po => po.status === "delivered" || po.status === "closed");
    const deliveredOrders = deliveredPOs.length;

    // On-time deliveries (compare delivery_date with actual delivery - simplified: assume delivered on time if delivered)
    // In a real system, you'd compare actual delivery date with expected delivery date
    let onTimeDeliveries = 0;
    let lateDeliveries = 0;
    
    deliveredPOs.forEach(po => {
      // Check if there's a delivery delay issue for this PO
      const hasDelayIssue = filteredIssues.some(issue => 
        issue.po_id === po.id && 
        (issue.issue_type === "delay" || issue.issue_type === "delivery_delay")
      );
      if (hasDelayIssue) {
        lateDeliveries++;
      } else {
        onTimeDeliveries++;
      }
    });

    // Issue-free POs
    const posWithIssueIds = new Set(filteredIssues.map(i => i.po_id));
    const issueFreePOs = deliveredPOs.filter(po => !posWithIssueIds.has(po.id)).length;
    const posWithIssues = deliveredPOs.filter(po => posWithIssueIds.has(po.id)).length;

    // Popular products
    const productCount = {};
    filteredPOs.forEach(po => {
      if (po.status === "draft") return; // Exclude draft POs
      (po.line_items || []).forEach(item => {
        const productName = item.product_name || "Unknown";
        productCount[productName] = (productCount[productName] || 0) + (item.quantity || 1);
      });
    });
    const popularProducts = Object.entries(productCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Issue types
    const issueTypeCount = {};
    filteredIssues.forEach(issue => {
      const type = issue.issue_type || "other";
      issueTypeCount[type] = (issueTypeCount[type] || 0) + 1;
    });
    const issueTypes = Object.entries(issueTypeCount)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Vendor spend
    const vendorSpendMap = {};
    const vendorOrderCount = {};
    const vendorIssueCount = {};
    
    nonDraftPOs.forEach(po => {
      const vendorId = po.vendor_id;
      const vendor = data.vendors.find(v => v.id === vendorId);
      const vendorName = vendor?.name || "Unknown";
      vendorSpendMap[vendorName] = (vendorSpendMap[vendorName] || 0) + (po.grand_total || 0);
      vendorOrderCount[vendorName] = (vendorOrderCount[vendorName] || 0) + 1;
    });
    
    filteredIssues.forEach(issue => {
      const po = data.purchaseOrders.find(p => p.id === issue.po_id);
      if (po) {
        const vendor = data.vendors.find(v => v.id === po.vendor_id);
        const vendorName = vendor?.name || "Unknown";
        vendorIssueCount[vendorName] = (vendorIssueCount[vendorName] || 0) + 1;
      }
    });
    
    const vendorSpend = Object.entries(vendorSpendMap)
      .map(([name, amount]) => ({ 
        name, 
        amount,
        orders: vendorOrderCount[name] || 0,
        issues: vendorIssueCount[name] || 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Monthly spend
    const monthlySpendMap = {};
    nonDraftPOs.forEach(po => {
      const date = new Date(po.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlySpendMap[monthKey] = (monthlySpendMap[monthKey] || 0) + (po.grand_total || 0);
    });
    const monthlySpend = Object.entries(monthlySpendMap)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    setAnalytics({
      totalSpend,
      totalOrders,
      deliveredOrders,
      onTimeDeliveries,
      lateDeliveries,
      issueFreePOs,
      posWithIssues,
      popularProducts,
      issueTypes,
      vendorSpend,
      monthlySpend
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Generate month options
  const getMonthOptions = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      months.push({ value, label });
    }
    return months;
  };

  // Get unique vendors (filter out duplicates)
  const getUniqueVendors = () => {
    const seen = new Set();
    return data.vendors.filter(vendor => {
      if (seen.has(vendor.name)) return false;
      seen.add(vendor.name);
      return true;
    });
  };

  const onTimeRate = analytics.deliveredOrders > 0 
    ? ((analytics.onTimeDeliveries / analytics.deliveredOrders) * 100).toFixed(1) 
    : 0;

  const issuesFreeRate = analytics.deliveredOrders > 0 
    ? ((analytics.issueFreePOs / analytics.deliveredOrders) * 100).toFixed(1) 
    : 0;

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
    <div data-testid="analytics-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Comprehensive analytics and reports</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                {getMonthOptions().map(month => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {getUniqueVendors().map(vendor => (
                  <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="page-container space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(analytics.totalSpend)}</p>
                  <p className="text-xs text-slate-500">Total Spend</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Package className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{analytics.totalOrders}</p>
                  <p className="text-xs text-slate-500">Total Orders (excl. drafts)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{onTimeRate}%</p>
                  <p className="text-xs text-slate-500">On-Time Delivery Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{issuesFreeRate}%</p>
                  <p className="text-xs text-slate-500">Issue-Free Delivery Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Spend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Monthly Spend Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.monthlySpend.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.monthlySpend.slice(-6).map((item, idx) => {
                        const maxAmount = Math.max(...analytics.monthlySpend.map(s => s.amount));
                        const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                        const monthLabel = new Date(item.month + "-01").toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                        return (
                          <div key={idx}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-slate-600">{monthLabel}</span>
                              <span className="font-mono font-medium">{formatCurrency(item.amount)}</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-8">No data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Delivery Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Delivery Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                          <span className="text-emerald-800">On-Time Deliveries</span>
                        </div>
                        <span className="text-2xl font-bold text-emerald-700">
                          {analytics.onTimeDeliveries}/{analytics.deliveredOrders}
                        </span>
                      </div>
                      <div className="mt-2 h-2 bg-emerald-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${onTimeRate}%` }} />
                      </div>
                    </div>
                    
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-blue-600" />
                          <span className="text-blue-800">Issue-Free Deliveries</span>
                        </div>
                        <span className="text-2xl font-bold text-blue-700">
                          {analytics.issueFreePOs}/{analytics.deliveredOrders}
                        </span>
                      </div>
                      <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${issuesFreeRate}%` }} />
                      </div>
                    </div>

                    {analytics.lateDeliveries > 0 && (
                      <div className="p-4 bg-red-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-red-600" />
                            <span className="text-red-800">Late Deliveries</span>
                          </div>
                          <span className="text-2xl font-bold text-red-700">{analytics.lateDeliveries}</span>
                        </div>
                      </div>
                    )}

                    {analytics.posWithIssues > 0 && (
                      <div className="p-4 bg-amber-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-amber-600" />
                            <span className="text-amber-800">Deliveries with Issues</span>
                          </div>
                          <span className="text-2xl font-bold text-amber-700">{analytics.posWithIssues}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Most Popular Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.popularProducts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Units Ordered</TableHead>
                        <TableHead className="w-[200px]">Popularity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.popularProducts.map((product, idx) => {
                        const maxCount = analytics.popularProducts[0]?.count || 1;
                        const percentage = (product.count / maxCount) * 100;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell>{product.name}</TableCell>
                            <TableCell className="text-right font-mono">{product.count}</TableCell>
                            <TableCell>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 rounded-full" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-slate-500 py-8">No product data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Issues Tab */}
          <TabsContent value="issues">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Issues by Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.issueTypes.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.issueTypes.map((item, idx) => {
                        const total = analytics.issueTypes.reduce((sum, i) => sum + i.count, 0);
                        const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
                        const colors = [
                          "bg-red-500", "bg-amber-500", "bg-blue-500", 
                          "bg-purple-500", "bg-emerald-500", "bg-pink-500"
                        ];
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded ${colors[idx % colors.length]}`} />
                            <span className="flex-1 text-sm capitalize">{item.type.replace(/_/g, ' ')}</span>
                            <span className="text-sm font-mono">{item.count}</span>
                            <span className="text-sm text-slate-500">({percentage}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-8">No issues recorded</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Issue Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-red-50 rounded-lg text-center">
                        <p className="text-3xl font-bold text-red-700">{data.issues.filter(i => i.status === "open").length}</p>
                        <p className="text-sm text-red-600">Open Issues</p>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-lg text-center">
                        <p className="text-3xl font-bold text-emerald-700">{data.issues.filter(i => i.status === "resolved").length}</p>
                        <p className="text-sm text-emerald-600">Resolved</p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600 mb-2">Most Common Issue</p>
                      <p className="text-lg font-medium capitalize">
                        {analytics.issueTypes[0]?.type.replace(/_/g, ' ') || "None"}
                      </p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <p className="text-sm text-amber-600 mb-2">Total Issues</p>
                      <p className="text-lg font-medium">{data.issues.length} issues reported</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Vendors Tab */}
          <TabsContent value="vendors">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Vendor Performance & Spend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.vendorSpend.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Issues</TableHead>
                        <TableHead className="text-right">Total Spend</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                        <TableHead className="w-[150px]">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.vendorSpend.map((vendor, idx) => {
                        const percentage = analytics.totalSpend > 0 
                          ? ((vendor.amount / analytics.totalSpend) * 100).toFixed(1) 
                          : 0;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell>{vendor.name}</TableCell>
                            <TableCell className="text-right">{vendor.orders}</TableCell>
                            <TableCell className="text-right">
                              {vendor.issues > 0 ? (
                                <span className="text-red-600 font-medium">{vendor.issues}</span>
                              ) : (
                                <span className="text-emerald-600">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(vendor.amount)}</TableCell>
                            <TableCell className="text-right">{percentage}%</TableCell>
                            <TableCell>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-slate-500 py-8">No vendor data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analytics;
