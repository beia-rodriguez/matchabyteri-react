import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

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

      <div className="admin-panel-react">
        <h3>Customers with Bookings</h3>

        <form
          onSubmit={handleSubmit}
          className="admin-form-row-react"
          style={{ marginBottom: 10 }}
        >
          <div>
            <label
              className="admin-muted-react"
              htmlFor="contact-search"
              style={{ display: "block", marginBottom: 6 }}
            >
              Search
            </label>

            <input
              id="contact-search"
              className="admin-input-react"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name / Email / Phone"
              autoComplete="off"
            />
          </div>

          <div style={{ maxWidth: 160 }}>
            <label
              className="admin-muted-react"
              htmlFor="contact-limit"
              style={{ display: "block", marginBottom: 6 }}
            >
              Limit
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

          <button className="admin-pill-react" type="submit" disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
        </form>

        {loading ? (
          <div className="admin-muted-react" role="status" aria-live="polite">
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <div className="admin-muted-react">
            {q.trim() ? "No contacts match your search." : "No customers yet."}
          </div>
        ) : (
          <table className="admin-table-react">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Total Bookings</th>
                <th>Last Booking</th>
              </tr>
            </thead>

            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name || ""}</td>
                  <td>{c.email || ""}</td>
                  <td>{c.phone_number || ""}</td>
                  <td>{Number(c.total_bookings || 0)}</td>
                  <td>
                    {c.last_booking_date
                      ? String(c.last_booking_date).slice(0, 10)
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}