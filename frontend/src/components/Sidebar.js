import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import {
  LayoutDashboard,
  Package,
  FileText,
  Truck,
  Receipt,
  CreditCard,
  RotateCcw,
  History,
  LogOut,
  X,
  ChevronRight,
  Building2,
  UserCog,
  AlertTriangle,
  CalendarClock,
  Upload,
  BarChart3
} from "lucide-react";

const OLL_LOGO = "https://customer-assets.emergentagent.com/job_1abb6756-ee51-414a-aff6-9c61f26a1a75/artifacts/23infxd1_Logo.png";

const Sidebar = ({ role, isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const ollNavItems = [
    { 
      section: "Overview",
      items: [
        { path: "/oll", icon: LayoutDashboard, label: "Dashboard" }
      ]
    },
    {
      section: "Orders",
      items: [
        { path: "/oll/purchase-orders", icon: FileText, label: "Purchase Orders" },
        { path: "/oll/deliveries", icon: CalendarClock, label: "Deliveries" },
        { path: "/oll/issues", icon: AlertTriangle, label: "Issues" },
        { path: "/oll/returns", icon: RotateCcw, label: "Returns" }
      ]
    },
    {
      section: "Finance",
      items: [
        { path: "/oll/invoices", icon: Receipt, label: "Invoices" },
        { path: "/oll/payments", icon: CreditCard, label: "Payments" }
      ]
    },
    {
      section: "Management",
      items: [
        { path: "/oll/vendors", icon: Building2, label: "Vendors" },
        { path: "/oll/products", icon: Package, label: "Products" },
        { path: "/oll/users", icon: UserCog, label: "Users" }
      ]
    },
    {
      section: "System",
      items: [
        { path: "/oll/analytics", icon: BarChart3, label: "Analytics" },
        { path: "/oll/bulk-import", icon: Upload, label: "Bulk Import" },
        { path: "/oll/audit-logs", icon: History, label: "Audit Logs" }
      ]
    }
  ];

  const vendorNavItems = [
    {
      section: "Overview",
      items: [
        { path: "/vendor", icon: LayoutDashboard, label: "Dashboard" }
      ]
    },
    {
      section: "Orders",
      items: [
        { path: "/vendor/purchase-orders", icon: FileText, label: "Purchase Orders" },
        { path: "/vendor/deliveries", icon: CalendarClock, label: "Deliveries" },
        { path: "/vendor/issues", icon: AlertTriangle, label: "Issues" },
        { path: "/vendor/returns", icon: RotateCcw, label: "Returns" }
      ]
    },
    {
      section: "Finance",
      items: [
        { path: "/vendor/invoices", icon: Receipt, label: "Invoices" },
        { path: "/vendor/payments", icon: CreditCard, label: "Payments" }
      ]
    }
  ];

  const distributorNavItems = [
    {
      section: "Overview",
      items: [
        { path: "/distributor", icon: LayoutDashboard, label: "Dashboard" }
      ]
    },
    {
      section: "Orders",
      items: [
        { path: "/distributor/purchase-orders", icon: FileText, label: "My Orders" },
        { path: "/distributor/deliveries", icon: CalendarClock, label: "Deliveries" },
        { path: "/distributor/issues", icon: AlertTriangle, label: "Issues" }
      ]
    },
    {
      section: "Catalog",
      items: [
        { path: "/distributor/products", icon: Package, label: "Products" }
      ]
    }
  ];

  const navItems = role === "oll" ? ollNavItems : role === "distributor" ? distributorNavItems : vendorNavItems;

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} data-testid="sidebar">
        <div className="sidebar-header">
          <div className="flex items-center justify-between">
            <img src={OLL_LOGO} alt="OLL" className="sidebar-logo" />
            <button 
              className="lg:hidden p-1 hover:bg-slate-100 rounded"
              onClick={onClose}
              data-testid="close-sidebar-btn"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="mt-3 px-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {role === "oll" ? "Admin Portal" : role === "distributor" ? "Distributor Portal" : "Vendor Portal"}
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section, idx) => (
            <div key={idx} className="sidebar-section">
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/oll" || item.path === "/vendor"}
                  className={({ isActive }) => 
                    `sidebar-item ${isActive ? 'active' : ''}`
                  }
                  onClick={onClose}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-blue-700">
                {user?.name?.charAt(0) || user?.username?.charAt(0) || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.name || user?.username}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {role === "oll" ? "Administrator" : role === "distributor" ? "Distributor" : "Vendor"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5" />
            <span>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
