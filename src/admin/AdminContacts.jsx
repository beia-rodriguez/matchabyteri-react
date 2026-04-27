import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

export default function AdminContacts() {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(100);
  const [contacts, setContacts] = useState([]);

  const loadData = async (search = q, lim = limit) => {
    const { data } = await adminApi.get("/admin/admin-contacts.php", { params: { q: search, limit: lim } });
    setContacts(data.contacts || []);
  };

  useEffect(() => { loadData("", 100); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    loadData(q, limit);
  };

  return (
    <AdminLayout title="Customer Contacts">
      <div className="admin-panel-react">
        <h3>Customers with Bookings</h3>

        <form onSubmit={handleSubmit} className="admin-form-row-react" style={{ marginBottom: 10 }}>
          <div>
            <label className="admin-muted-react" style={{ display: "block", marginBottom: 6 }}>Search</label>
            <input className="admin-input-react" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name / Email / Phone" />
          </div>

          <div style={{ maxWidth: 160 }}>
            <label className="admin-muted-react" style={{ display: "block", marginBottom: 6 }}>Limit</label>
            <input className="admin-input-react" type="number" min="1" max="300" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>

          <button className="admin-pill-react" type="submit">Apply</button>
        </form>

        {contacts.length === 0 ? (
          <div className="admin-muted-react">No customers yet.</div>
        ) : (
          <table className="admin-table-react">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th>Total Bookings</th><th>Last Booking</th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name || ""}</td>
                  <td>{c.email || ""}</td>
                  <td>{c.phone_number || ""}</td>
                  <td>{Number(c.total_bookings || 0)}</td>
                  <td>{c.last_booking_date ? String(c.last_booking_date).slice(0, 10) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}