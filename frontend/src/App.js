import { useEffect, useState, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";

// Pages
import Login from "./pages/Login";
import OLLDashboard from "./pages/oll/Dashboard";
import VendorDashboard from "./pages/vendor/Dashboard";
import VendorsList from "./pages/oll/VendorsList";
import VendorForm from "./pages/oll/VendorForm";
import ProductsList from "./pages/oll/ProductsList";
import ProductForm from "./pages/oll/ProductForm";
import PurchaseOrdersList from "./pages/oll/PurchaseOrdersList";
import PurchaseOrderForm from "./pages/oll/PurchaseOrderForm";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import ReturnsList from "./pages/oll/ReturnsList";
import ReturnForm from "./pages/oll/ReturnForm";
import CreditNotesList from "./pages/CreditNotesList";
import InvoicesList from "./pages/InvoicesList";
import PaymentsList from "./pages/PaymentsList";
import AuditLogs from "./pages/oll/AuditLogs";
import PublicTracking from "./pages/PublicTracking";
import UsersList from "./pages/oll/UsersList";
import DeliveriesPage from "./pages/oll/DeliveriesPage";
import IssuesPage from "./pages/oll/IssuesPage";
import BulkImport from "./pages/oll/BulkImport";
import Analytics from "./pages/oll/Analytics";

// Vendor Pages
import VendorPurchaseOrders from "./pages/vendor/PurchaseOrders";
import VendorDispatch from "./pages/vendor/Dispatch";
import VendorReturns from "./pages/vendor/Returns";
import VendorInvoices from "./pages/vendor/Invoices";
import VendorIssuesPage from "./pages/vendor/IssuesPage";

// Distributor Pages
import DistributorDashboard from "./pages/distributor/Dashboard";
import DistributorPurchaseOrders from "./pages/distributor/PurchaseOrders";
import DistributorPurchaseOrderForm from "./pages/distributor/PurchaseOrderForm";
import DistributorProducts from "./pages/distributor/Products";

// Layout
import Sidebar from "./components/Sidebar";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// API instance with auth
export const apiClient = axios.create({
  baseURL: API,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const redirectPath = user.role === "oll" ? "/oll" : user.role === "distributor" ? "/distributor" : "/vendor";
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

// Layout with Sidebar
const DashboardLayout = ({ children }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar 
        role={user?.role} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      <div className="content-with-sidebar main-content">
        <button
          className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
          onClick={() => setSidebarOpen(true)}
          data-testid="mobile-menu-btn"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
};

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { username, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      
      toast.success(`Welcome back, ${userData.name || userData.username}!`);
      return userData;
    } catch (error) {
      const message = error.response?.data?.detail || "Login failed";
      toast.error(message);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    toast.success("Logged out successfully");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

function AppRoutes() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        user ? <Navigate to={user.role === "oll" ? "/oll" : user.role === "distributor" ? "/distributor" : "/vendor"} replace /> : <Login />
      } />
      <Route path="/track/:trackingToken" element={<PublicTracking />} />
      
      {/* OLL Routes */}
      <Route path="/oll" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><OLLDashboard /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/vendors" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><VendorsList /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/vendors/new" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><VendorForm /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/vendors/:id/edit" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><VendorForm /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/products" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><ProductsList /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/products/new" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><ProductForm /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/products/:id/edit" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><ProductForm /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/purchase-orders" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><PurchaseOrdersList /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/purchase-orders/new" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><PurchaseOrderForm /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/purchase-orders/:id" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><PurchaseOrderDetail /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/purchase-orders/:id/edit" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><PurchaseOrderForm /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/returns" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><ReturnsList /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/returns/new" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><ReturnForm /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/credit-notes" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><CreditNotesList /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/invoices" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><InvoicesList /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/payments" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><PaymentsList /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/audit-logs" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><AuditLogs /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/bulk-import" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><BulkImport /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/analytics" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><Analytics /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/users" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><UsersList /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/deliveries" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><DeliveriesPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/oll/issues" element={
        <ProtectedRoute allowedRoles={["oll"]}>
          <DashboardLayout><IssuesPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      
      {/* Vendor Routes */}
      <Route path="/vendor" element={
        <ProtectedRoute allowedRoles={["vendor"]}>
          <DashboardLayout><VendorDashboard /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/vendor/purchase-orders" element={
        <ProtectedRoute allowedRoles={["vendor"]}>
          <DashboardLayout><VendorPurchaseOrders /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/vendor/purchase-orders/:id" element={
        <ProtectedRoute allowedRoles={["vendor"]}>
          <DashboardLayout><PurchaseOrderDetail /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/vendor/dispatch/:poId" element={
        <ProtectedRoute allowedRoles={["vendor"]}>
          <DashboardLayout><VendorDispatch /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/vendor/returns" element={
        <ProtectedRoute allowedRoles={["vendor"]}>
          <DashboardLayout><VendorReturns /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/vendor/invoices" element={
        <ProtectedRoute allowedRoles={["vendor"]}>
          <DashboardLayout><VendorInvoices /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/vendor/credit-notes" element={
        <ProtectedRoute allowedRoles={["vendor"]}>
          <DashboardLayout><CreditNotesList /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/vendor/payments" element={
        <ProtectedRoute allowedRoles={["vendor"]}>
          <DashboardLayout><PaymentsList /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/vendor/deliveries" element={
        <ProtectedRoute allowedRoles={["vendor"]}>
          <DashboardLayout><DeliveriesPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/vendor/issues" element={
        <ProtectedRoute allowedRoles={["vendor"]}>
          <DashboardLayout><IssuesPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      
      {/* Distributor Routes */}
      <Route path="/distributor" element={
        <ProtectedRoute allowedRoles={["distributor"]}>
          <DashboardLayout><DistributorDashboard /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/distributor/purchase-orders" element={
        <ProtectedRoute allowedRoles={["distributor"]}>
          <DashboardLayout><DistributorPurchaseOrders /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/distributor/purchase-orders/new" element={
        <ProtectedRoute allowedRoles={["distributor"]}>
          <DashboardLayout><DistributorPurchaseOrderForm /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/distributor/purchase-orders/:id" element={
        <ProtectedRoute allowedRoles={["distributor"]}>
          <DashboardLayout><PurchaseOrderDetail /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/distributor/products" element={
        <ProtectedRoute allowedRoles={["distributor"]}>
          <DashboardLayout><DistributorProducts /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/distributor/deliveries" element={
        <ProtectedRoute allowedRoles={["distributor"]}>
          <DashboardLayout><DeliveriesPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/distributor/issues" element={
        <ProtectedRoute allowedRoles={["distributor"]}>
          <DashboardLayout><IssuesPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      
      {/* Default redirect */}
      <Route path="/" element={
        user ? (
          <Navigate to={user.role === "oll" ? "/oll" : user.role === "distributor" ? "/distributor" : "/vendor"} replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
      
      {/* 404 */}
      <Route path="*" element={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
            <p className="text-slate-600">Page not found</p>
          </div>
        </div>
      } />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    // Seed data on first load
    const seedData = async () => {
      try {
        await axios.post(`${API}/seed`);
      } catch (error) {
        // Data already seeded or error
      }
    };
    seedData();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors closeButton />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
