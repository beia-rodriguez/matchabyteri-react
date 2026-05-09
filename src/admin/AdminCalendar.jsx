import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

export default function AdminCalendar() {
  const [csrf, setCsrf] = useState("");
  const [blockedDates, setBlockedDates] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingDate, setDeletingDate] = useState("");

  const [form, setForm] = useState({
    block_date: "",
    reason: "",
  });

  const loadData = async () => {
    try {
      setErr("");

      const { data } = await adminApi.get("/admin/admin-calendar.php");

      setBlockedDates(data.blockedDates || []);
      setCsrf(data.csrf || "");
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load blocked dates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();

    setMsg("");
    setErr("");

    if (!form.block_date) {
      setErr("Please choose a date to block.");
      return;
    }

    try {
      setSaving(true);

      const { data } = await adminApi.post("/admin/admin-calendar.php", {
        action: "add_block",
        csrf_token: csrf,
        block_date: form.block_date,
        reason: form.reason.trim(),
      });

      if (data.error) {
        setErr(data.error);
        return;
      }

      setMsg(data.message || "Blocked date saved.");
      setForm({ block_date: "", reason: "" });

      await loadData();
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to save blocked date.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (blockDate) => {
    if (!window.confirm("Remove this blocked date?")) return;

    setMsg("");
    setErr("");

    try {
      setDeletingDate(blockDate);

      const { data } = await adminApi.post("/admin/admin-calendar.php", {
        action: "delete_block",
        csrf_token: csrf,
        block_date: blockDate,
      });

      if (data.error) {
        setErr(data.error);
        return;
      }

      setMsg(data.message || "Blocked date removed.");

      await loadData();
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to remove blocked date.");
    } finally {
      setDeletingDate("");
    }
  };

  return (
    <AdminLayout title="Calendar Management">
      {msg && (
        <div className="admin-notice-react ok" role="status" aria-live="polite">
          {msg}
        </div>
      )}

      {err && (
        <div className="admin-notice-react bad" role="alert" aria-live="assertive">
          {err}
        </div>
      )}

      <div className="admin-panel-react">
        <h3>Block Dates</h3>

        <form onSubmit={handleSave}>
          <div className="admin-form-row-react">
            <div>
              <label
                className="admin-muted-react"
                htmlFor="block-date"
                style={{ display: "block", marginBottom: 6 }}
              >
                Block Date
              </label>

              <input
                id="block-date"
                className="admin-input-react"
                type="date"
                required
                value={form.block_date}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    block_date: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label
                className="admin-muted-react"
                htmlFor="block-reason"
                style={{ display: "block", marginBottom: 6 }}
              >
                Reason
              </label>

              <input
                id="block-reason"
                className="admin-input-react"
                type="text"
                placeholder="e.g., Holiday / Fully booked"
                value={form.reason}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <button
                className="admin-btn-react admin-btn-approve-react"
                type="submit"
                disabled={saving}
                style={{ padding: "10px 14px" }}
              >
                {saving ? "SAVING..." : "SAVE"}
              </button>
            </div>
          </div>
        </form>

        {loading ? (
          <div className="admin-muted-react">Loading blocked dates...</div>
        ) : blockedDates.length === 0 ? (
          <div className="admin-muted-react">No blocked dates yet.</div>
        ) : (
          <table className="admin-table-react">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reason</th>
                <th>Remove</th>
              </tr>
            </thead>

            <tbody>
              {blockedDates.map((b) => (
                <tr key={b.block_date}>
                  <td>{b.block_date}</td>
                  <td>{b.reason || ""}</td>
                  <td>
                    <button
                      className="admin-btn-react admin-btn-cancel-react"
                      type="button"
                      disabled={deletingDate === b.block_date}
                      onClick={() => handleDelete(b.block_date)}
                    >
                      {deletingDate === b.block_date ? "REMOVING..." : "REMOVE"}
                    </button>
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