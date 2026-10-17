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
  XCircle,
  Timer,
  CalendarCheck,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [productViewMode, setProductViewMode] = useState("ordered"); // "ordered" | "all"
  
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
    allProductAnalytics: [],
    productSummary: {
      totalCatalogProducts: 0,
      activeCatalogProducts: 0,
      shopListedProducts: 0,
      orderedProductsCount: 0,
      totalUnitsOrdered: 0,
      totalProductSpend: 0
    },
    issueTypes: [],
    vendorSpend: [],
    monthlySpend: [],
    vendorPerformance: []
  });

  const [timeline, setTimeline] = useState({
    po_timelines: [],
    averages: {
      avg_time_to_confirm_days: null,
      avg_time_to_dispatch_days: null,
      avg_time_to_deliver_days: null,
      avg_time_to_approve_days: null,
      avg_delivery_delay_days: null,
    }
  });

  const [inventory, setInventory] = useState({
    items: [],
    stats: { total_items: 0, total_quantity: 0, total_value: 0, by_category: {} }
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (!loading) {
      calculateAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, monthFilter, vendorFilter, timeline, loading]);

  const fetchAllData = async () => {
    try {
      const [
        vendorsRes,
        productsRes,
        posRes,
        issuesRes,
        timelineRes,
        inventoryRes,
        invStatsRes
      ] = await Promise.allSettled([
        apiClient.get("/vendors"),
        apiClient.get("/products"),
        apiClient.get("/purchase-orders?limit=1000"),
        apiClient.get("/issues"),
        apiClient.get("/analytics/delivery-timeline"),
        apiClient.get("/inventory"),
        apiClient.get("/inventory/summary/stats")
      ]);

      const vendorsData =
        vendorsRes.status === "fulfilled" && Array.isArray(vendorsRes.value?.data)
          ? vendorsRes.value.data
          : [];

      const productsData =
        productsRes.status === "fulfilled" && Array.isArray(productsRes.value?.data)
          ? productsRes.value.data
          : [];

      let posData =
        posRes.status === "fulfilled" && Array.isArray(posRes.value?.data)
          ? posRes.value.data
          : [];

      // Fallback to list-with-invoices if /purchase-orders failed
      if (posRes.status === "rejected") {
        try {
          const fallbackPos = await apiClient.get("/purchase-orders/list-with-invoices?page=1&limit=500");
          if (Array.isArray(fallbackPos.data)) {
            posData = fallbackPos.data;
          }
        } catch (fallbackErr) {
          console.error("Fallback PO fetch failed:", fallbackErr);
        }
      }

      const issuesData =
        issuesRes.status === "fulfilled" && Array.isArray(issuesRes.value?.data)
          ? issuesRes.value.data
          : [];

      setData({
        vendors: vendorsData,
        products: productsData,
        purchaseOrders: posData,
        issues: issuesData,
        invoices: [],
        payments: []
      });

      if (timelineRes.status === "fulfilled" && timelineRes.value?.data) {
        setTimeline(timelineRes.value.data);
      }

      setInventory({
        items:
          inventoryRes.status === "fulfilled" && Array.isArray(inventoryRes.value?.data)
            ? inventoryRes.value.data
            : [],
        stats:
          invStatsRes.status === "fulfilled" && invStatsRes.value?.data
            ? invStatsRes.value.data
            : { total_items: 0, total_quantity: 0, total_value: 0, by_category: {} }
      });

      if (
        vendorsRes.status === "rejected" &&
        productsRes.status === "rejected" &&
        posRes.status === "rejected"
      ) {
        toast.error("Failed to fetch analytics data");
      }
    } catch (error) {
      toast.error("Failed to fetch analytics data");
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = () => {
    let filteredPOs = [...(data.purchaseOrders || [])];
    let filteredIssues = [...(data.issues || [])];
    const allVendors = data.vendors || [];
    const allProducts = data.products || [];

    const vendorMap = {};
    allVendors.forEach(v => {
      if (v && v.id) vendorMap[v.id] = v.name;
    });
    
    // Apply month filter
    if (monthFilter !== "all") {
      const [year, month] = monthFilter.split("-").map(Number);
      filteredPOs = filteredPOs.filter(po => {
        if (!po.created_at) return false;
        const poDate = new Date(po.created_at);
        return poDate.getFullYear() === year && poDate.getMonth() + 1 === month;
      });
      filteredIssues = filteredIssues.filter(issue => {
        if (!issue.created_at) return false;
        const issueDate = new Date(issue.created_at);
        return issueDate.getFullYear() === year && issueDate.getMonth() + 1 === month;
      });
    }
    
    // Apply vendor filter
    if (vendorFilter !== "all") {
      filteredPOs = filteredPOs.filter(po => po.vendor_id === vendorFilter);
      filteredIssues = filteredIssues.filter(issue => {
        if (issue.vendor_id) return issue.vendor_id === vendorFilter;
        const po = data.purchaseOrders.find(p => p.id === issue.po_id);
        return po && po.vendor_id === vendorFilter;
      });
    }

    // Active / confirmed / non-draft POs (exclude draft, unapproved request, rejected, cancelled)
    const excludedStatuses = new Set(["draft", "request", "rejected", "cancelled"]);
    const nonDraftPOs = filteredPOs.filter(po => !excludedStatuses.has(po.status));
    const totalSpend = nonDraftPOs.reduce((sum, po) => sum + (Number(po.grand_total) || 0), 0);
    const totalOrders = nonDraftPOs.length;

    // Delivery metrics
    const deliveredPOs = filteredPOs.filter(po => po.status === "delivered" || po.status === "closed");
    const deliveredOrders = deliveredPOs.length;

    // On-time deliveries — use timeline delivery_delay_days if available, fallback to issue check
    const timelineDelayMap = {};
    (timeline.po_timelines || []).forEach(t => {
      if (t.po_id && t.delivery_delay_days != null) {
        timelineDelayMap[t.po_id] = t.delivery_delay_days;
      }
    });

    let onTimeDeliveries = 0;
    let lateDeliveries = 0;

    deliveredPOs.forEach(po => {
      const delayDays = timelineDelayMap[po.id];
      if (delayDays != null) {
        if (delayDays > 0) {
          lateDeliveries++;
        } else {
          onTimeDeliveries++;
        }
      } else if (po.delivery_date) {
        const expected = new Date(po.delivery_date);
        const delivered = po.delivered_at ? new Date(po.delivered_at) : null;
        if (delivered) {
          if (delivered > expected) lateDeliveries++; else onTimeDeliveries++;
        } else {
          const hasDelayIssue = filteredIssues.some(issue =>
            issue.po_id === po.id &&
            (issue.issue_type === "delay" || issue.issue_type === "delivery_delay")
          );
          if (hasDelayIssue) lateDeliveries++; else onTimeDeliveries++;
        }
      } else {
        const hasDelayIssue = filteredIssues.some(issue =>
          issue.po_id === po.id &&
          (issue.issue_type === "delay" || issue.issue_type === "delivery_delay")
        );
        if (hasDelayIssue) lateDeliveries++; else onTimeDeliveries++;
      }
    });

    // Issue-free POs — check both: issues collection AND has_delivery_issues flag on PO
    const posWithIssueIds = new Set(filteredIssues.filter(i => i.po_id).map(i => i.po_id));
    const issueFreePOs = deliveredPOs.filter(po =>
      !posWithIssueIds.has(po.id) && !po.has_delivery_issues
    ).length;
    const posWithIssues = deliveredPOs.filter(po =>
      posWithIssueIds.has(po.id) || po.has_delivery_issues
    ).length;

    // ==========================
    // PRODUCT ANALYTICS SECTION
    // ==========================
    const filteredCatalogProducts = vendorFilter !== "all"
      ? allProducts.filter(p => p.vendor_id === vendorFilter)
      : allProducts;

    const productById = {};
    const productBySku = {};
    const productByName = {};

    allProducts.forEach(p => {
      if (!p) return;
      if (p.id) productById[p.id] = p;
      if (p.sku) productBySku[String(p.sku).trim().toLowerCase()] = p;
      if (p.name) productByName[String(p.name).trim().toLowerCase()] = p;
    });

    const productStatsMap = {};

    // Seed map with catalog products so we can also view catalog-wide analytics
    filteredCatalogProducts.forEach(p => {
      const key = p.id || `name:${String(p.name || "").trim().toLowerCase()}`;
      productStatsMap[key] = {
        key,
        id: p.id || null,
        name: p.name || "Unknown Product",
        sku: p.sku || "—",
        vendor_id: p.vendor_id || "",
        vendor_name: p.vendor_name || vendorMap[p.vendor_id] || "Unknown",
        unit: p.unit || "pcs",
        unit_price: Number(p.unit_price) || 0,
        mrp: p.mrp != null ? Number(p.mrp) : null,
        image_url: p.image_url || "",
        show_on_shop: Boolean(p.show_on_shop),
        is_active: p.is_active !== false,
        count: 0,
        ordersCount: 0,
        totalSpend: 0,
        poIds: new Set(),
        lastOrderedAt: null
      };
    });

    nonDraftPOs.forEach(po => {
      const lineItems = Array.isArray(po.line_items) ? po.line_items : [];
      lineItems.forEach(item => {
        if (!item) return;
        const rawName = String(item.product_name || item.name || "").trim();
        const rawSku = String(item.sku || "").trim().toLowerCase();
        const matchedProduct =
          (item.product_id && productById[item.product_id]) ||
          (rawSku && productBySku[rawSku]) ||
          (rawName && productByName[rawName.toLowerCase()]) ||
          null;

        const key = matchedProduct?.id
          ? matchedProduct.id
          : `name:${(rawName || "unknown").toLowerCase()}`;

        const qty = Number(item.quantity) || 0;
        const unitPrice =
          item.unit_price != null && item.unit_price !== ""
            ? Number(item.unit_price) || 0
            : Number(matchedProduct?.unit_price) || 0;

        let lineSpend = 0;
        if (item.line_total != null && item.line_total !== "") {
          lineSpend = Number(item.line_total) || 0;
        } else {
          const baseAmount = qty * unitPrice;
          const discountAmt = Number(item.discount_amount) || (baseAmount * (Number(item.discount_percent) || 0)) / 100;
          const taxable = Math.max(0, baseAmount - discountAmt);
          const taxRate = item.tax_rate != null ? Number(item.tax_rate) : (Number(matchedProduct?.tax_rate) || 0);
          const taxAmt = (taxable * taxRate) / 100;
          lineSpend = taxable + taxAmt;
        }

        if (!productStatsMap[key]) {
          const vId = matchedProduct?.vendor_id || po.vendor_id || "";
          productStatsMap[key] = {
            key,
            id: matchedProduct?.id || item.product_id || null,
            name: matchedProduct?.name || rawName || "Unknown Product",
            sku: matchedProduct?.sku || item.sku || "—",
            vendor_id: vId,
            vendor_name: matchedProduct?.vendor_name || vendorMap[vId] || po.vendor_name || "Unknown",
            unit: matchedProduct?.unit || item.unit || "pcs",
            unit_price: unitPrice,
            mrp: matchedProduct?.mrp != null ? Number(matchedProduct.mrp) : null,
            image_url: matchedProduct?.image_url || "",
            show_on_shop: Boolean(matchedProduct?.show_on_shop),
            is_active: matchedProduct ? matchedProduct.is_active !== false : true,
            count: 0,
            ordersCount: 0,
            totalSpend: 0,
            poIds: new Set(),
            lastOrderedAt: null
          };
        }

        const entry = productStatsMap[key];
        entry.count += qty;
        entry.totalSpend += lineSpend;
        if (po.id && !entry.poIds.has(po.id)) {
          entry.poIds.add(po.id);
          entry.ordersCount = entry.poIds.size;
        }
        if (po.created_at && (!entry.lastOrderedAt || po.created_at > entry.lastOrderedAt)) {
          entry.lastOrderedAt = po.created_at;
        }
      });
    });

    const allProductAnalytics = Object.values(productStatsMap)
      .map(({ poIds, ...rest }) => rest)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (b.totalSpend !== a.totalSpend) return b.totalSpend - a.totalSpend;
        return a.name.localeCompare(b.name);
      });

    const popularProducts = allProductAnalytics.filter(p => p.count > 0);

    const totalUnitsOrdered = popularProducts.reduce((sum, p) => sum + p.count, 0);
    const totalProductSpend = popularProducts.reduce((sum, p) => sum + p.totalSpend, 0);

    const productSummary = {
      totalCatalogProducts: filteredCatalogProducts.length,
      activeCatalogProducts: filteredCatalogProducts.filter(p => p.is_active !== false).length,
      shopListedProducts: filteredCatalogProducts.filter(p => Boolean(p.show_on_shop)).length,
      orderedProductsCount: popularProducts.length,
      totalUnitsOrdered,
      totalProductSpend
    };

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
      const vendorName = vendorMap[vendorId] || po.vendor_name || "Unknown";
      vendorSpendMap[vendorName] = (vendorSpendMap[vendorName] || 0) + (Number(po.grand_total) || 0);
      vendorOrderCount[vendorName] = (vendorOrderCount[vendorName] || 0) + 1;
    });
    
    filteredIssues.forEach(issue => {
      const po = data.purchaseOrders.find(p => p.id === issue.po_id);
      const vendorId = issue.vendor_id || po?.vendor_id;
      if (vendorId || po) {
        const vendorName = vendorMap[vendorId] || issue.vendor_name || po?.vendor_name || "Unknown";
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
      if (!po.created_at) return;
      const date = new Date(po.created_at);
      if (isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlySpendMap[monthKey] = (monthlySpendMap[monthKey] || 0) + (Number(po.grand_total) || 0);
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
      allProductAnalytics,
      productSummary,
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
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

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-6">
            {/* Pipeline KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Timer className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {timeline.averages.avg_time_to_confirm_days != null
                          ? `${timeline.averages.avg_time_to_confirm_days}d`
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-500 leading-tight">Avg. Time to Confirm PO</p>
                      <p className="text-xs text-slate-400 mt-0.5">from PO raised</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {timeline.averages.avg_time_to_dispatch_days != null
                          ? `${timeline.averages.avg_time_to_dispatch_days}d`
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-500 leading-tight">Avg. Time to Dispatch</p>
                      <p className="text-xs text-slate-400 mt-0.5">from confirmation</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {timeline.averages.avg_time_to_deliver_days != null
                          ? `${timeline.averages.avg_time_to_deliver_days}d`
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-500 leading-tight">Avg. Time to Deliver</p>
                      <p className="text-xs text-slate-400 mt-0.5">from dispatch</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                      <CalendarCheck className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {timeline.averages.avg_time_to_approve_days != null
                          ? `${timeline.averages.avg_time_to_approve_days}d`
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-500 leading-tight">Avg. Approval Time</p>
                      <p className="text-xs text-slate-400 mt-0.5">vendor submit → OLL approve</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-l-4 ${
                timeline.averages.avg_delivery_delay_days == null ? "border-l-slate-300" :
                timeline.averages.avg_delivery_delay_days > 0 ? "border-l-red-500" :
                "border-l-emerald-500"
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      timeline.averages.avg_delivery_delay_days == null ? "bg-slate-100" :
                      timeline.averages.avg_delivery_delay_days > 0 ? "bg-red-100" : "bg-emerald-100"
                    }`}>
                      <CalendarCheck className={`w-5 h-5 ${
                        timeline.averages.avg_delivery_delay_days == null ? "text-slate-400" :
                        timeline.averages.avg_delivery_delay_days > 0 ? "text-red-600" : "text-emerald-600"
                      }`} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${
                        timeline.averages.avg_delivery_delay_days == null ? "text-slate-400" :
                        timeline.averages.avg_delivery_delay_days > 0 ? "text-red-700" : "text-emerald-700"
                      }`}>
                        {timeline.averages.avg_delivery_delay_days != null
                          ? `${timeline.averages.avg_delivery_delay_days > 0 ? "+" : ""}${timeline.averages.avg_delivery_delay_days}d`
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-500 leading-tight">Avg. Delivery Delay</p>
                      <p className="text-xs text-slate-400 mt-0.5">vs expected date on PO</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pipeline Flow Visual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Fulfillment Pipeline — Average Duration per Stage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 py-4">
                  {[
                    { label: "PO Raised",  sub: "Start",     color: "bg-slate-200 text-slate-600",   dot: "bg-slate-400" },
                    { label: "Confirmed",  sub: timeline.averages.avg_time_to_confirm_days  != null ? `${timeline.averages.avg_time_to_confirm_days}d`  : "—", color: "bg-blue-100 text-blue-700",    dot: "bg-blue-500",    arrow: true },
                    { label: "Dispatched", sub: timeline.averages.avg_time_to_dispatch_days != null ? `${timeline.averages.avg_time_to_dispatch_days}d` : "—", color: "bg-amber-100 text-amber-700",   dot: "bg-amber-500",   arrow: true },
                    { label: "Approval",   sub: timeline.averages.avg_time_to_approve_days  != null ? `${timeline.averages.avg_time_to_approve_days}d`  : "—", color: "bg-purple-100 text-purple-700", dot: "bg-purple-500",  arrow: true },
                    { label: "Delivered",  sub: timeline.averages.avg_time_to_deliver_days  != null ? `${timeline.averages.avg_time_to_deliver_days}d`  : "—", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", arrow: true },
                  ].map((stage, idx) => (
                    <div key={idx} className="flex items-center gap-1 flex-1">
                      {stage.arrow && <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />}
                      <div className={`flex-1 rounded-lg p-3 text-center ${stage.color}`}>
                        <div className={`w-2 h-2 rounded-full ${stage.dot} mx-auto mb-2`} />
                        <p className="font-semibold text-sm">{stage.label}</p>
                        <p className="text-xs mt-0.5 opacity-80">{stage.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Per-PO Delivery Date Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5" />
                  Delivery Date: Expected vs Actual (per PO)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.po_timelines.filter(p => p.status === "delivered" || p.status === "closed").length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>PO Number</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Expected Date</TableHead>
                        <TableHead>Submitted Date</TableHead>
                        <TableHead>Approved Date</TableHead>
                        <TableHead className="text-center">Approval Time</TableHead>
                        <TableHead className="text-right">Delay (days)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeline.po_timelines
                        .filter(p => p.status === "delivered" || p.status === "closed")
                        .map((po, idx) => {
                          const delay = po.delivery_delay_days;
                          const isLate = delay > 0;
                          const isEarly = delay < 0;
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-mono font-medium">{po.po_number}</TableCell>
                              <TableCell className="text-slate-600">{po.vendor_name}</TableCell>
                              <TableCell>{po.expected_delivery_date || "—"}</TableCell>
                              <TableCell className="text-slate-600">{po.delivery_submitted_at || "—"}</TableCell>
                              <TableCell className="text-slate-600">{po.actual_delivered_at || "—"}</TableCell>
                              <TableCell className="text-center">
                                {po.time_to_approve_days != null ? (
                                  <span className="text-xs font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">{po.time_to_approve_days}d</span>
                                ) : <span className="text-slate-400">—</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                {delay == null ? (
                                  <span className="text-slate-400">—</span>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    isLate ? "bg-red-100 text-red-700" :
                                    isEarly ? "bg-emerald-100 text-emerald-700" :
                                    "bg-slate-100 text-slate-600"
                                  }`}>
                                    {isLate ? `+${delay}d late` : isEarly ? `${Math.abs(delay)}d early` : "On time"}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-slate-500 py-8">No delivered POs to show yet</p>
                )}
              </CardContent>
            </Card>

            {/* Full Pipeline Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  PO Pipeline Timing (All Active POs)
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {timeline.po_timelines.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>PO Number</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Sent</TableHead>
                        <TableHead className="text-center">Confirmed</TableHead>
                        <TableHead className="text-center">Dispatched</TableHead>
                        <TableHead className="text-center">Submitted</TableHead>
                        <TableHead className="text-center">Approved</TableHead>
                        <TableHead className="text-right">Confirm</TableHead>
                        <TableHead className="text-right">Dispatch</TableHead>
                        <TableHead className="text-right">Deliver</TableHead>
                        <TableHead className="text-right">Approval</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeline.po_timelines.map((po, idx) => (
                        <TableRow key={idx} className="text-sm">
                          <TableCell className="font-mono font-medium">{po.po_number}</TableCell>
                          <TableCell className="text-slate-600 max-w-[120px] truncate">{po.vendor_name}</TableCell>
                          <TableCell>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              po.status === "delivered" || po.status === "closed" ? "bg-emerald-100 text-emerald-700" :
                              po.status === "pending_approval" ? "bg-purple-100 text-purple-700" :
                              po.status === "dispatched" ? "bg-amber-100 text-amber-700" :
                              po.status === "confirmed" ? "bg-blue-100 text-blue-700" :
                              "bg-slate-100 text-slate-600"
                            }`}>{po.status}</span>
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-500">{po.sent_at || "—"}</TableCell>
                          <TableCell className="text-center text-xs text-slate-500">{po.confirmed_at || "—"}</TableCell>
                          <TableCell className="text-center text-xs text-slate-500">{po.dispatched_at || "—"}</TableCell>
                          <TableCell className="text-center text-xs text-slate-500">{po.delivery_submitted_at || "—"}</TableCell>
                          <TableCell className="text-center text-xs text-slate-500">{po.delivered_at || "—"}</TableCell>
                          <TableCell className="text-right">
                            {po.time_to_confirm_days != null ? (
                              <span className="text-xs font-mono text-blue-700">{po.time_to_confirm_days}d</span>
                            ) : <span className="text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {po.time_to_dispatch_days != null ? (
                              <span className="text-xs font-mono text-amber-700">{po.time_to_dispatch_days}d</span>
                            ) : <span className="text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {po.time_to_deliver_days != null ? (
                              <span className="text-xs font-mono text-emerald-700">{po.time_to_deliver_days}d</span>
                            ) : <span className="text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {po.time_to_approve_days != null ? (
                              <span className="text-xs font-mono text-purple-700">{po.time_to_approve_days}d</span>
                            ) : <span className="text-slate-300">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-slate-500 py-8">No PO data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-6">
            {/* Inventory KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-indigo-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{inventory.stats.total_items}</p>
                      <p className="text-xs text-slate-500">Unique Items</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{inventory.stats.total_quantity.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Total Units in Stock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(inventory.stats.total_value)}</p>
                      <p className="text-xs text-slate-500">Total Inventory Value</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Category Breakdown + Item Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* By Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <PieChart className="w-4 h-4" />
                    By Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(inventory.stats.by_category || {}).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(inventory.stats.by_category).map(([cat, data], idx) => {
                        const pct = inventory.stats.total_value > 0
                          ? ((data.value / inventory.stats.total_value) * 100).toFixed(1)
                          : 0;
                        const colors = ["bg-indigo-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-rose-500"];
                        return (
                          <div key={idx}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-700 font-medium">{cat}</span>
                              <span className="text-slate-500">{data.item_count} items · {data.quantity} units</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${colors[idx % colors.length]} rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-mono text-slate-600 w-16 text-right">{formatCurrency(data.value)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-6 text-sm">No inventory data</p>
                  )}
                </CardContent>
              </Card>

              {/* All Items Table */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4" />
                      All Inventory Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {inventory.items.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Item</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inventory.items
                            .slice()
                            .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
                            .map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-slate-900">{item.product_name}</p>
                                  {item.sku && <p className="text-xs text-slate-400">{item.sku}</p>}
                                  {item.location && <p className="text-xs text-slate-400">{item.location}</p>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                  {item.category || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                {item.quantity?.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-600">
                                  </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-emerald-700">
                                {formatCurrency(item.total_value || 0)} {formatCurrency(item.unit_price || 0)}
                           
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-slate-500 py-8 text-sm">No inventory items found</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            {/* Product Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-indigo-500">
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-slate-900">
                    {analytics.productSummary?.totalCatalogProducts || 0}
                  </p>
                  <p className="text-xs text-slate-500">Catalog Products</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {analytics.productSummary?.activeCatalogProducts || 0} active ·{" "}
                    {analytics.productSummary?.shopListedProducts || 0} on shop
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-slate-900">
                    {analytics.productSummary?.orderedProductsCount || 0}
                  </p>
                  <p className="text-xs text-slate-500">Products Ordered</p>
                  <p className="text-xs text-slate-400 mt-0.5">Distinct products in POs</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-slate-900">
                    {(analytics.productSummary?.totalUnitsOrdered || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">Total Units Ordered</p>
                  <p className="text-xs text-slate-400 mt-0.5">Across {analytics.totalOrders} orders</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500">
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(analytics.productSummary?.totalProductSpend || 0)}
                  </p>
                  <p className="text-xs text-slate-500">Total Product Spend</p>
                  <p className="text-xs text-slate-400 mt-0.5">Line-item value incl. tax</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  {productViewMode === "ordered"
                    ? "Most Popular & Ordered Products"
                    : "All Catalog Products Performance"}
                </CardTitle>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setProductViewMode("ordered")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      productViewMode === "ordered"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Ordered ({analytics.popularProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductViewMode("all")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      productViewMode === "all"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All Products ({analytics.allProductAnalytics.length})
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const displayedProducts =
                    productViewMode === "ordered"
                      ? analytics.popularProducts
                      : analytics.allProductAnalytics;

                  if (displayedProducts.length === 0) {
                    return (
                      <div className="text-center py-8 space-y-2">
                        <p className="text-slate-500">
                          {productViewMode === "ordered"
                            ? "No ordered products found for the selected filter."
                            : "No products available in catalog."}
                        </p>
                        {productViewMode === "ordered" && analytics.allProductAnalytics.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setProductViewMode("all")}
                            className="text-xs text-blue-600 hover:underline font-medium"
                          >
                            View all {analytics.allProductAnalytics.length} catalog products →
                          </button>
                        )}
                      </div>
                    );
                  }

                  const maxCount = Math.max(...displayedProducts.map(p => p.count || 0), 1);
                  const totalUnits = analytics.productSummary?.totalUnitsOrdered || 0;

                  return (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="text-right">POs</TableHead>
                          <TableHead className="text-right">Units Ordered</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total Spend</TableHead>
                          <TableHead className="w-[180px]">Popularity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedProducts.map((product, idx) => {
                          const barPct = product.count > 0 ? (product.count / maxCount) * 100 : 0;
                          const unitSharePct =
                            totalUnits > 0 && product.count > 0
                              ? ((product.count / totalUnits) * 100).toFixed(1)
                              : "0.0";
                          return (
                            <TableRow key={product.key || idx}>
                              <TableCell className="font-medium text-slate-500">{idx + 1}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {product.image_url ? (
                                    <img
                                      src={product.image_url}
                                      alt={product.name}
                                      className="w-9 h-9 rounded object-cover border border-slate-200 shrink-0"
                                      onError={(e) => {
                                        e.target.style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                      <Package className="w-4 h-4 text-slate-400" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-slate-900">{product.name}</span>
                                      {product.show_on_shop && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                          Shop
                                        </span>
                                      )}
                                      {!product.is_active && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                          Inactive
                                        </span>
                                      )}
                                    </div>
                                    {product.sku && product.sku !== "—" && (
                                      <p className="text-xs text-slate-400 font-mono">SKU: {product.sku}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {product.vendor_name || "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-700">
                                {product.ordersCount || 0}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-slate-900">
                                {(product.count || 0).toLocaleString()}{" "}
                                <span className="text-xs font-normal text-slate-400">
                                  {product.unit || "pcs"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-600">
                                {formatCurrency(product.unit_price || 0)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-emerald-700">
                                {formatCurrency(product.totalSpend || 0)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full transition-all"
                                      style={{ width: `${barPct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono text-slate-500 w-11 text-right">
                                    {unitSharePct}%
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  );
                })()}
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
