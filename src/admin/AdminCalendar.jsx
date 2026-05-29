import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "@/assets/css/admin-calendar.css";

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusBadgeClass(status) {
  const s = String(status || "pending").toLowerCase();

  if (s === "approved" || s === "completed") return "paid";
  if (s === "cancelled" || s === "rejected") return "rejected";

  return "pending";
}

function paymentBadgeClass(status) {
  const s = String(status || "unpaid").toLowerCase();

  if (s === "paid" || s === "partial") return "paid";
  if (s === "rejected") return "rejected";

  return "pending";
}

function isCancelRequested(booking) {
  return Number(booking.cancel_requested) === 1 || booking.cancel_requested === true;
}

function formatTime(time) {
  if (!time) return "";
  return String(time).slice(0, 5);
}

function getBookingGroup(booking) {
  const type = String(booking.booking_type || "").toLowerCase();

  if (type === "event") return "event";
  if (type === "workshop") return "workshop";

  return "private";
}

const TABS = [
  { key: "all", label: "All Bookings" },
  { key: "upcoming", label: "Upcoming" },
  { key: "approved", label: "Approved" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled / Rejected" },
  { key: "cancel_requests", label: "Cancel Requests" },
  { key: "event", label: "Events" },
  { key: "workshop", label: "Workshops" },
  { key: "private", label: "Private / Custom" },
];

export default function AdminCalendar() {
  const [csrf, setCsrf] = useState("");
  const [blockedDates, setBlockedDates] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [activeTab, setActiveTab] = useState("all");
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
      setLoading(true);
      setErr("");

      const { data } = await adminApi.get("/admin/admin-calendar.php");

      setBlockedDates(data.blockedDates || []);
      setBookings(data.bookings || []);
      setCsrf(data.csrf || "");
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load calendar data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const filteredBookings = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => {
      const dateA = `${a.booking_date || ""} ${a.start_time || ""}`;
      const dateB = `${b.booking_date || ""} ${b.start_time || ""}`;

      return dateB.localeCompare(dateA);
    });

    if (activeTab === "all") return sorted;

    if (activeTab === "upcoming") {
      return sorted.filter(
        (b) =>
          String(b.booking_date || "") >= today &&
          ["pending", "approved"].includes(String(b.status || "").toLowerCase())
      );
    }

    if (activeTab === "approved") {
      return sorted.filter((b) => String(b.status || "").toLowerCase() === "approved");
    }

    if (activeTab === "completed") {
      return sorted.filter((b) => String(b.status || "").toLowerCase() === "completed");
    }

    if (activeTab === "cancelled") {
      return sorted.filter((b) =>
        ["cancelled", "rejected"].includes(String(b.status || "").toLowerCase())
      );
    }

    if (activeTab === "cancel_requests") {
      return sorted.filter((b) => isCancelRequested(b));
    }

    return sorted.filter((b) => getBookingGroup(b) === activeTab);
  }, [bookings, activeTab, today]);

  const getTabCount = (tabKey) => {
    if (tabKey === "all") return bookings.length;

    if (tabKey === "upcoming") {
      return bookings.filter(
        (b) =>
          String(b.booking_date || "") >= today &&
          ["pending", "approved"].includes(String(b.status || "").toLowerCase())
      ).length;
    }

    if (tabKey === "approved") {
      return bookings.filter((b) => String(b.status || "").toLowerCase() === "approved")
        .length;
    }

    if (tabKey === "completed") {
      return bookings.filter((b) => String(b.status || "").toLowerCase() === "completed")
        .length;
    }

    if (tabKey === "cancelled") {
      return bookings.filter((b) =>
        ["cancelled", "rejected"].includes(String(b.status || "").toLowerCase())
      ).length;
    }

    if (tabKey === "cancel_requests") {
      return bookings.filter((b) => isCancelRequested(b)).length;
    }

    return bookings.filter((b) => getBookingGroup(b) === tabKey).length;
  };

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

        <p className="admin-muted-react" style={{ marginTop: -6 }}>
          Use this to block dates that should not be available for new bookings.
        </p>

        <form onSubmit={handleSave} className="calendar-block-form-react">
          <div className="calendar-block-grid-react">
            <div className="calendar-block-field-react">
              <label className="calendar-block-label-react" htmlFor="block-date">
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

            <div className="calendar-block-field-react">
              <label className="calendar-block-label-react" htmlFor="block-reason">
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

            <div className="calendar-block-action-react">
              <button
                className="admin-btn-react admin-btn-approve-react"
                type="submit"
                disabled={saving}
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

      <div className="admin-panel-react" style={{ marginTop: 18, padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--line)",
            background: "#fff",
          }}
        >
          <h3 style={{ margin: 0 }}>Booking Calendar History</h3>

          <p
            style={{
              margin: "6px 0 0",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Approved bookings remain visible here together with pending, completed,
            cancelled, and customer cancellation requests.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
            background: "#fcfdfc",
          }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="admin-btn-react"
                style={{
                  padding: "8px 14px",
                  fontSize: "0.78rem",
                  borderRadius: "999px",
                  background: active ? "var(--green-2)" : "#fff",
                  color: active ? "#fff" : "var(--green-2)",
                  border: "1px solid var(--green-2)",
                }}
              >
                {tab.label} ({getTabCount(tab.key)})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="admin-muted-react" style={{ padding: 24 }}>
            Loading booking history...
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="admin-muted-react" style={{ padding: 24 }}>
            No bookings found for this tab.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              className="admin-table-react rich-table"
              style={{ border: "none", borderRadius: 0 }}
            >
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Cancel Request</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((b) => {
                  const status = String(b.status || "pending").toLowerCase();
                  const payment = String(b.payment_status || "unpaid").toLowerCase();
                  const cancelRequested = isCancelRequested(b);

                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 900, color: "var(--green-2)" }}>
                        #{b.id}
                      </td>

                      <td style={{ fontWeight: 800 }}>{b.booking_date}</td>

                      <td>
                        {formatTime(b.start_time)} - {formatTime(b.end_time)}
                      </td>

                      <td style={{ textTransform: "uppercase", fontWeight: 800 }}>
                        {b.booking_type}
                      </td>

                      <td>
                        <div style={{ fontWeight: 800, color: "var(--green-2)" }}>
                          {b.user_name || "Guest"}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                          {b.user_email || "No email"}
                        </div>
                      </td>

                      <td>
                        <span className={`p-badge-react ${statusBadgeClass(status)}`}>
                          {status.toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <span className={`p-badge-react ${paymentBadgeClass(payment)}`}>
                          {payment.toUpperCase()}
                        </span>
                      </td>

                      <td style={{ fontWeight: 800 }}>
                        ₱{money(b.total_amount)}
                      </td>

                      <td>
                        {cancelRequested ? (
                          <div
                            style={{
                              background: "#fff7ed",
                              border: "1px solid #fed7aa",
                              borderRadius: 10,
                              padding: "8px 10px",
                              maxWidth: 320,
                            }}
                          >
                            <div
                              style={{
                                color: "#9a3412",
                                fontWeight: 900,
                                fontSize: "0.75rem",
                                textTransform: "uppercase",
                              }}
                            >
                              Requested
                            </div>

                            <div
                              style={{
                                color: "#7c2d12",
                                fontSize: "0.82rem",
                                marginTop: 4,
                                lineHeight: 1.4,
                              }}
                            >
                              {b.cancel_reason || "No reason provided."}
                            </div>

                            {b.cancel_requested_at && (
                              <div
                                style={{
                                  color: "#9a3412",
                                  fontSize: "0.72rem",
                                  marginTop: 4,
                                  fontWeight: 700,
                                }}
                              >
                                {b.cancel_requested_at}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="admin-muted-react">—</span>
                        )}
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