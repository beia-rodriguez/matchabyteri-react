import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

// --- HELPER FUNCTIONS ---
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getAvatarTheme = (name) => {
  const themes = [
    { bg: '#e8f0eb', text: '#1a4f35' }, // Green
    { bg: '#e3f2fd', text: '#0d47a1' }, // Blue
    { bg: '#fff3cd', text: '#856404' }, // Yellow
    { bg: '#fce4e4', text: '#cc0000' }, // Red
    { bg: '#f3e5f5', text: '#4a148c' }, // Purple
  ];
  if (!name) return themes[0];
  const charCode = name.charCodeAt(0) || 0;
  return themes[charCode % themes.length];
};

export default function AdminContacts() {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(100);
  const [contacts, setContacts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const loadData = async (search = q, lim = limit) => {
    try {
      setErr("");
      setLoading(true);

      const safeLimit = Math.min(Math.max(Number(lim) || 100, 1), 300);

      const { data } = await adminApi.get("/admin/admin-contacts.php", {
        params: {
          q: search.trim(),
          limit: safeLimit,
        },
      });

      setContacts(data.contacts || []);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load contacts.");
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData("", 100);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await loadData(q, limit);
  };

  return (
    <AdminLayout title="Customer Contacts">
      {err && (
        <div className="admin-notice-react bad" role="alert" aria-live="assertive">
          {err}
        </div>
      )}

      {/* --- FILTERS PANEL --- */}
      <div className="admin-panel-react" style={{ paddingBottom: '20px', marginBottom: '20px' }}>
        <h3>Customers with Bookings</h3>

        <form onSubmit={handleSubmit} className="admin-form-row-react" style={{ margin: 0, gridTemplateColumns: '1fr minmax(100px, 150px) auto' }}>
          <div>
            <label className="admin-muted-react" htmlFor="contact-search" style={{ display: "block", marginBottom: 6 }}>
              Search Directory
            </label>
            <input
              id="contact-search"
              className="admin-input-react"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by Name, Email, or Phone..."
              autoComplete="off"
            />
          </div>

          <div>
            <label className="admin-muted-react" htmlFor="contact-limit" style={{ display: "block", marginBottom: 6 }}>
              Result Limit
            </label>
            <input
              id="contact-limit"
              className="admin-input-react"
              type="number"
              min="1"
              max="300"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>

          <button className="admin-pill-react" type="submit" disabled={loading} style={{ height: '42px', padding: '0 24px' }}>
            {loading ? "Searching..." : "Apply Filter"}
          </button>
        </form>
      </div>

      {/* --- CONTACTS DATA TABLE --- */}
      <div className="admin-panel-react" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="admin-muted-react" role="status" aria-live="polite" style={{ padding: '24px' }}>
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <div className="admin-muted-react" style={{ padding: '24px' }}>
            {q.trim() ? "No contacts match your search criteria." : "No customers found in the database."}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table-react rich-table">
              <thead>
                <tr>
                  <th>Customer Information</th>
                  <th>Phone Number</th>
                  <th style={{ textAlign: 'center' }}>Total Bookings</th>
                  <th>Last Booking</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const theme = getAvatarTheme(c.name);
                  const totalBookings = Number(c.total_bookings || 0);

                  return (
                    <tr key={c.id}>
                      {/* Rich Customer Column (Avatar + Name + Email) */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div 
                            className="c-avatar" 
                            style={{ backgroundColor: theme.bg, color: theme.text }}
                          >
                            {getInitials(c.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 900, color: 'var(--green-2)', fontSize: '0.95rem' }}>
                              {c.name || "Unknown Customer"}
                            </div>
                            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                              {c.email || "No email provided"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone Column */}
                      <td style={{ verticalAlign: 'middle', fontWeight: 600, color: 'var(--ink)' }}>
                        {c.phone_number || <span style={{ color: '#ccc' }}>—</span>}
                      </td>

                      {/* Bookings Badge Column */}
                      <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <span className={`c-booking-badge ${totalBookings > 0 ? 'active' : ''}`}>
                          {totalBookings}
                        </span>
                      </td>

                      {/* Date Column */}
                      <td style={{ verticalAlign: 'middle', color: 'var(--muted)', fontWeight: 600 }}>
                        {c.last_booking_date
                          ? new Date(c.last_booking_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                          : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}