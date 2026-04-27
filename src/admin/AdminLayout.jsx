import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  BarChart3,
  GraduationCap,
  Users,
  CreditCard,
  LogOut,
} from "lucide-react";
import "@/assets/css/admin-panel.css";
import { FilePenLine } from "lucide-react";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/reservations", label: "Reservations", icon: ClipboardList },
  { to: "/admin/forms", label: "Forms", icon: FilePenLine },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/workshops", label: "Workshops", icon: GraduationCap },
  { to: "/admin/contacts", label: "Contacts", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
];

export default function AdminLayout({ title, children }) {
  return (
    <div className="admin-shell-react">
      <div className="admin-layout-react">
        <aside className="admin-sidebar-react">
          <div className="admin-brand-react">Admin Panel</div>

          <nav className="admin-nav-react">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `admin-link-react ${isActive ? "active" : ""}`
                }
              >
                <Icon size={18} strokeWidth={2.2} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div style={{ height: 10 }} />

          <a className="admin-pill-react admin-logout-react" href="/logout.php">
            <LogOut size={16} strokeWidth={2.2} />
            <span>Logout</span>
          </a>
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