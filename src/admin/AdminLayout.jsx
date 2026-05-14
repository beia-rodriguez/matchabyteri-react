import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  BarChart3,
  GraduationCap,
  Users,
  CreditCard,
  LogOut,
  FilePenLine,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "@/assets/css/admin-panel.css";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/reservations", label: "Reservations", icon: ClipboardList },
  { to: "/admin/forms", label: "Forms", icon: FilePenLine },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/workshops", label: "Workshops", icon: GraduationCap },
  { to: "/admin/contacts", label: "Contacts", icon: Users },
  { to: "/admin/concerns", label: "Concerns", icon: MessageSquare },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
];

export default function AdminLayout({ title, children }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", {
      replace: true,
      state: { message: "You have been logged out." },
    });
  };

  return (
    <div className="admin-shell-react">
      <div className="admin-layout-react">
        <aside className="admin-sidebar-react">
          <div className="admin-brand-react">Admin Panel</div>

          <nav className="admin-nav-react" aria-label="Admin navigation">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `admin-link-react ${isActive ? "active" : ""}`
                }
              >
                <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div style={{ height: 10 }} />

          <button
            type="button"
            className="admin-pill-react admin-logout-react"
            onClick={handleLogout}
          >
            <LogOut size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </aside>

        <main className="admin-main-react">
          <div className="admin-topbar-react">
            <h1 className="admin-title-react">{title}</h1>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}