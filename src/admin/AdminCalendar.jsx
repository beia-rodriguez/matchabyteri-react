import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

export default function AdminCalendar() {
  const [csrf, setCsrf] = useState("");
  const [blockedDates, setBlockedDates] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ block_date: "", reason: "" });

  const loadData = async () => {
    try {
      const { data } = await adminApi.get("/admin/admin-calendar.php");
      setBlockedDates(data.blockedDates || []);
      setCsrf(data.csrf || "");
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load blocked dates.");
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    try {
      const { data } = await adminApi.post("/admin/admin-calendar.php", {
        action: "add_block",
        csrf_token: csrf,
        block_date: form.block_date,
        reason: form.reason,
      });
      if (data.error) setErr(data.error);
      else {
        setMsg(data.message || "Blocked date saved.");
        setForm({ block_date: "", reason: "" });
        loadData();
      }
    } catch (e2) {
      setErr(e2.response?.data?.error || "Failed to save blocked date.");
    }
  };

  const handleDelete = async (block_date) => {
    if (!window.confirm("Remove this blocked date?")) return;
    setMsg("");
    setErr("");
    try {
      const { data } = await adminApi.post("/admin/admin-calendar.php", {
        action: "delete_block",
        csrf_token: csrf,
        block_date,
      });
      if (data.error) setErr(data.error);
      else {
        setMsg(data.message || "Blocked date removed.");
        loadData();
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to remove blocked date.");
    }
  };

  return (
    <AdminLayout title="Calendar Management">
      {msg ? <div className="admin-notice-react ok">{msg}</div> : null}
      {err ? <div className="admin-notice-react bad">{err}</div> : null}

      <div className="admin-panel-react">
        <h3>Block Dates</h3>

        <form onSubmit={handleSave}>
          <div className="admin-form-row-react">
            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>Block Date</div>
              <input className="admin-input-react" type="date" required value={form.block_date} onChange={(e) => setForm({ ...form, block_date: e.target.value })} />
            </div>
            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>Reason</div>
              <input className="admin-input-react" type="text" placeholder="e.g., Holiday / Fully booked" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div>
              <button className="admin-btn-react admin-btn-approve-react" type="submit" style={{ padding: "10px 14px" }}>SAVE</button>
            </div>
          </div>
        </form>

        {blockedDates.length === 0 ? (
          <div className="admin-muted-react">No blocked dates yet.</div>
        ) : (
          <table className="admin-table-react">
            <thead>
              <tr><th>Date</th><th>Reason</th><th>Remove</th></tr>
            </thead>
            <tbody>
              {blockedDates.map((b) => (
                <tr key={b.block_date}>
                  <td>{b.block_date}</td>
                  <td>{b.reason || ""}</td>
                  <td>
                    <button className="admin-btn-react admin-btn-cancel-react" type="button" onClick={() => handleDelete(b.block_date)}>REMOVE</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="admin-muted-react" style={{ marginTop: 12 }}>
          Note: For "ON DUPLICATE KEY" to work, ensure <b>blocked_dates.block_date</b> has a UNIQUE index.
        </div>
      </div>
    </AdminLayout>
  );
}