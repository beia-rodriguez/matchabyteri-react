import { Fragment, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

// --- HELPER FUNCTIONS ---

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getAnswerLabel(field, value) {
  if (value === undefined || value === null || value === "") return "—";

  const options = field.options || [];

  if (Array.isArray(value)) {
    return value
      .map((v) => {
        const opt = options.find((o) => String(o.id) === String(v));
        return opt?.label || v;
      })
      .join(", ");
  }

  const opt = options.find((o) => String(o.id) === String(value));
  return opt?.label || value;
}

function paymentBadgeClass(status) {
  const s = String(status || "unpaid").toLowerCase();

  if (s === "paid" || s === "partial") return "paid";
  if (s === "pending") return "pending";
  if (s === "rejected") return "rejected";

  return "pending";
}

function bookingStatusClass(status) {
  const s = String(status || "pending").toLowerCase();

  if (s === "approved") return "paid";
  if (s === "cancelled" || s === "rejected") return "rejected";
  if (s === "completed") return "paid";

  return "pending";
}

function canApproveBooking(paymentStatus) {
  const s = String(paymentStatus || "unpaid").toLowerCase();
  return s === "partial" || s === "paid";
}

function isCancellationRequested(booking) {
  return Number(booking.cancel_requested) === 1 || booking.cancel_requested === true;
}

function canCancelBooking(booking) {
  const s = String(booking.status || "").toLowerCase();
  return ["pending_payment", "pending", "approved"].includes(s);
}

function canCompleteBooking(booking) {
  const s = String(booking.status || "").toLowerCase();
  return s === "approved";
}

function canRejectBooking(booking) {
  const s = String(booking.status || "").toLowerCase();
  return s === "pending";
}

const getInitials = (name) => {
  if (!name) return "?";

  const parts = name.trim().split(" ");

  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return name.substring(0, 2).toUpperCase();
};

const getAvatarTheme = (name) => {
  const themes = [
    { bg: "#e8f0eb", text: "#1a4f35" },
    { bg: "#e3f2fd", text: "#0d47a1" },
    { bg: "#fff3cd", text: "#856404" },
    { bg: "#fce4e4", text: "#cc0000" },
    { bg: "#f3e5f5", text: "#4a148c" },
  ];

  if (!name) return themes[0];

  const charCode = name.charCodeAt(0) || 0;
  return themes[charCode % themes.length];
};

function getBookingGroup(booking) {
  const type = String(booking.booking_type || "").toLowerCase();

  if (type === "event") return "events";
  if (type === "workshop") return "workshops";

  return "private";
}

function getTabCount(bookings, tab) {
  if (tab === "all") return bookings.length;

  if (tab === "cancel_requests") {
    return bookings.filter(
      (b) =>
        isCancellationRequested(b) &&
        ["pending_payment", "pending", "approved"].includes(String(b.status || "").toLowerCase())
    ).length;
  }

  return bookings.filter((b) => getBookingGroup(b) === tab).length;
}

const TABS = [
  { key: "all", label: "All Bookings" },
  { key: "cancel_requests", label: "Cancellation Requests" },
  { key: "events", label: "Events" },
  { key: "workshops", label: "Workshops" },
  { key: "private", label: "Private / Custom" },
];

export default function AdminReservations() {
  const [csrf, setCsrf] = useState("");
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setErr("");

    try {
      const { data } = await adminApi.get("/admin/admin-reservations.php");

      setCsrf(data.csrf || "");
      setBookings(data.bookings || data.pending || []);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load reservations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBookings = useMemo(() => {
    if (activeTab === "all") return bookings;

    if (activeTab === "cancel_requests") {
      return bookings.filter(
        (b) =>
          isCancellationRequested(b) &&
          ["pending_payment", "pending", "approved"].includes(String(b.status || "").toLowerCase())
      );
    }

    return bookings.filter((b) => getBookingGroup(b) === activeTab);
  }, [bookings, activeTab]);

  const handleStatus = async (booking, newStatus) => {
    setMsg("");
    setErr("");

    const currentStatus = String(booking.status || "").toLowerCase();

    if (newStatus === "approved" && !canApproveBooking(booking.payment_status)) {
      setErr("This booking cannot be approved until payment is partial or paid.");
      return;
    }

    if (newStatus === "approved" && currentStatus !== "pending") {
      setErr("Only pending bookings can be approved.");
      return;
    }

    if (newStatus === "cancelled" && !canCancelBooking(booking)) {
      setErr("Only pending or approved bookings can be cancelled.");
      return;
    }

    if (newStatus === "completed" && !canCompleteBooking(booking)) {
      setErr("Only approved bookings can be marked as completed.");
      return;
    }

    if (newStatus === "rejected" && !canRejectBooking(booking)) {
      setErr("Only pending bookings can be rejected.");
      return;
    }

    const confirmText =
      newStatus === "approved"
        ? "Approve this booking?"
        : newStatus === "cancelled"
        ? "Cancel this booking?"
        : newStatus === "completed"
        ? "Mark this booking as completed?"
        : "Reject this booking?";

    if (!window.confirm(confirmText)) return;

    setSavingId(booking.id);

    try {
      const { data } = await adminApi.post("/admin/admin-reservations.php", {
        action: "set_status",
        csrf_token: csrf,
        booking_id: booking.id,
        new_status: newStatus,
      });

      if (data.error) {
        setErr(data.error);
      } else {
        setMsg(data.message || "Booking updated.");
        setExpandedId(null);
        loadData();
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update booking.");
    } finally {
      setSavingId(null);
    }
  };

  const renderPaymentSummaryCompact = (booking) => {
    const bookingStatus = String(booking.status || "pending").toUpperCase();
    const paymentStatus = String(booking.payment_status || "unpaid").toUpperCase();

    const total = Number(booking.total_amount || 0);
    const amountPaid = Number(booking.amount_paid || 0);
    const balance = Math.max(total - amountPaid, 0);

    const snapshot = booking.form_snapshot_decoded || {};
    const downpaymentPercentage = Number(snapshot.downpayment_percentage || 50);
    const downpaymentAmount = total * (downpaymentPercentage / 100);

    return (
      <div className="compact-stat-list">
        <div className="compact-stat">
          <span>Booking Status</span>
          <strong
            className={`p-badge-react ${bookingStatusClass(booking.status)}`}
            style={{ padding: "2px 8px", fontSize: "0.7rem" }}
          >
            {bookingStatus}
          </strong>
        </div>

        <div className="compact-stat">
          <span>Payment Status</span>
          <strong
            className={`p-badge-react ${paymentBadgeClass(booking.payment_status)}`}
            style={{ padding: "2px 8px", fontSize: "0.7rem" }}
          >
            {paymentStatus}
          </strong>
        </div>

        <div className="compact-stat">
          <span>Total Amount</span>
          <strong style={{ fontSize: "1.05rem", color: "var(--ink)" }}>
            ₱{money(total)}
          </strong>
        </div>

        <div className="compact-stat">
          <span>Amount Paid</span>
          <strong>₱{money(amountPaid)}</strong>
        </div>

        <div className="compact-stat">
          <span>Balance</span>
          <strong>₱{money(balance)}</strong>
        </div>

        <div className="compact-stat">
          <span>Required Downpayment ({downpaymentPercentage}%)</span>
          <strong>₱{money(downpaymentAmount)}</strong>
        </div>
      </div>
    );
  };

  const renderCancellationBox = (booking) => {
    if (!isCancellationRequested(booking)) {
      return (
        <div className="admin-muted-react" style={{ fontSize: "0.85rem" }}>
          No cancellation request from customer.
        </div>
      );
    }

    return (
      <div
        style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: "12px",
          padding: "12px",
        }}
      >
        <div
          style={{
            fontWeight: 900,
            color: "#9a3412",
            marginBottom: "6px",
            textTransform: "uppercase",
            fontSize: "0.78rem",
          }}
        >
          Customer Requested Cancellation
        </div>

        <div style={{ color: "#7c2d12", fontSize: "0.86rem", lineHeight: 1.5 }}>
          {booking.cancel_reason || "No reason provided."}
        </div>

        {booking.cancel_requested_at && (
          <div
            style={{
              color: "#9a3412",
              fontSize: "0.75rem",
              marginTop: "8px",
              fontWeight: 700,
            }}
          >
            Requested at: {booking.cancel_requested_at}
          </div>
        )}
      </div>
    );
  };

  const renderSelectedItemsCompact = (booking) => {
    const items = booking.selected_items || [];

    if (!items.length) {
      return (
        <div className="admin-muted-react" style={{ fontSize: "0.85rem" }}>
          No priced items selected.
        </div>
      );
    }

    return (
      <div className="compact-stat-list">
        {items.map((item, index) => (
          <div
            className="compact-stat"
            key={index}
            style={{
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "4px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <strong style={{ color: "var(--ink)" }}>{item.option_label}</strong>
              <strong style={{ color: "var(--green-2)" }}>
                ₱{money(item.line_total)}
              </strong>
            </div>

            <span style={{ fontSize: "0.75rem" }}>
              {item.field_label}
              {item.price_type === "per_quantity" ? ` (Qty: ${item.quantity})` : ""}
              {item.price_type === "per_cup" ? ` (${item.cups || 0} cups)` : ""}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderDynamicAnswersCompact = (booking) => {
    const snapshot = booking.form_snapshot_decoded || {};
    const answers = booking.dynamic_answers || {};
    const sections = snapshot.sections || [];

    if (!sections.length) {
      return (
        <div className="admin-muted-react" style={{ fontSize: "0.85rem" }}>
          No form snapshot available.
        </div>
      );
    }

    return sections.map((section) => (
      <div key={section.id || section.title} style={{ marginBottom: "12px" }}>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 800,
            color: "var(--green-2)",
            textTransform: "uppercase",
            marginBottom: "6px",
            display: "block",
          }}
        >
          {section.title}
        </span>

        <div className="compact-stat-list">
          {(section.fields || []).map((field) => (
            <div className="compact-stat" key={field.id || field.label}>
              <span>{field.label}</span>
              <strong style={{ textAlign: "right", maxWidth: "60%" }}>
                {getAnswerLabel(field, answers[field.field_name])}
              </strong>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <AdminLayout title="Reservations">
      {msg && <div className="admin-notice-react ok">{msg}</div>}
      {err && <div className="admin-notice-react bad">{err}</div>}

      <div className="admin-panel-react" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--line)",
            background: "#fff",
          }}
        >
          <h3 style={{ margin: 0 }}>Reservations Management</h3>

          <p
            style={{
              margin: "6px 0 0",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Review pending, approved, completed, cancelled, and customer cancellation
            requests in one place.
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
            const count = getTabCount(bookings, tab.key);
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setExpandedId(null);
                }}
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
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="admin-muted-react" style={{ padding: "24px" }}>
            Loading reservations...
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="admin-muted-react" style={{ padding: "24px" }}>
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
                  <th style={{ width: "105px" }}>ID & Type</th>
                  <th>Schedule</th>
                  <th>Customer Info</th>
                  <th>Total</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "center" }}>Payment</th>
                  <th style={{ textAlign: "center" }}>Cancel Request</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((p) => {
                  const time =
                    p.start_time && p.end_time
                      ? `${String(p.start_time).slice(0, 5)} - ${String(p.end_time).slice(0, 5)}`
                      : "";

                  const isExpanded = expandedId === p.id;
                  const paymentStatus = String(p.payment_status || "unpaid").toLowerCase();
                  const status = String(p.status || "pending").toLowerCase();

                  const canApprove = canApproveBooking(paymentStatus) && status === "pending";
                  const canCancel = canCancelBooking(p);
                  const canComplete = canCompleteBooking(p);
                  const canReject = canRejectBooking(p);

                  const isSaving = savingId === p.id;
                  const theme = getAvatarTheme(p.user_name || "Guest");
                  const cancellationRequested = isCancellationRequested(p);

                  return (
                    <Fragment key={p.id}>
                      <tr style={{ background: isExpanded ? "#fcfdfc" : "#fff" }}>
                        <td>
                          <div
                            style={{
                              fontWeight: 900,
                              color: "var(--green-2)",
                              fontSize: "0.95rem",
                            }}
                          >
                            #{Number(p.id)}
                          </div>

                          <div
                            style={{
                              color: "var(--muted)",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              marginTop: "2px",
                            }}
                          >
                            {String(p.booking_type || "").toUpperCase()}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 800, color: "var(--ink)" }}>
                            {p.booking_date}
                          </div>

                          <div
                            style={{
                              color: "var(--muted)",
                              fontSize: "0.85rem",
                              marginTop: "2px",
                            }}
                          >
                            {time || "No time set"}
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              className="c-avatar"
                              style={{
                                backgroundColor: theme.bg,
                                color: theme.text,
                                width: "34px",
                                height: "34px",
                                fontSize: "0.8rem",
                              }}
                            >
                              {getInitials(p.user_name || "Guest")}
                            </div>

                            <div>
                              <div
                                style={{
                                  fontWeight: 900,
                                  color: "var(--green-2)",
                                  fontSize: "0.9rem",
                                }}
                              >
                                {p.user_name || "Guest"}
                              </div>

                              <div
                                style={{
                                  color: "var(--muted)",
                                  fontSize: "0.8rem",
                                  marginTop: "2px",
                                }}
                              >
                                {p.user_email || "No email"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ fontWeight: 800, color: "var(--ink)" }}>
                          ₱{money(p.total_amount)}
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <span className={`p-badge-react ${bookingStatusClass(status)}`}>
                            {status.toUpperCase()}
                          </span>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <span className={`p-badge-react ${paymentBadgeClass(paymentStatus)}`}>
                            {paymentStatus.toUpperCase()}
                          </span>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          {cancellationRequested ? (
                            <span
                              className="p-badge-react rejected"
                              style={{
                                background: "#fff7ed",
                                color: "#9a3412",
                                border: "1px solid #fed7aa",
                              }}
                            >
                              REQUESTED
                            </span>
                          ) : (
                            <span className="admin-muted-react">—</span>
                          )}
                        </td>

                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              flexWrap: "wrap",
                            }}
                          >
                            {status === "pending" && (
                              <button
                                className="admin-btn-react admin-btn-approve-react"
                                style={{
                                  padding: "6px 12px",
                                  opacity: canApprove ? 1 : 0.5,
                                  cursor: canApprove ? "pointer" : "not-allowed",
                                  fontSize: "0.72rem",
                                }}
                                type="button"
                                onClick={() => handleStatus(p, "approved")}
                                disabled={!canApprove || isSaving}
                                title={canApprove ? "Approve booking" : "Payment required"}
                              >
                                {isSaving ? "..." : "APPROVE"}
                              </button>
                            )}

                            {canCancel && (
  <button
    className="admin-btn-react admin-btn-cancel-react"
    style={{ padding: "6px 12px", fontSize: "0.72rem" }}
    type="button"
    onClick={() => handleStatus(p, "cancelled")}
    disabled={isSaving}
  >
    CANCEL
  </button>
)}

                            {canReject && (
                              <button
                                className="admin-btn-react admin-btn-cancel-react"
                                style={{ padding: "6px 12px", fontSize: "0.72rem" }}
                                type="button"
                                onClick={() => handleStatus(p, "rejected")}
                                disabled={isSaving}
                              >
                                REJECT
                              </button>
                            )}

                            {canComplete && (
                              <button
                                className="admin-btn-react admin-btn-approve-react"
                                style={{ padding: "6px 12px", fontSize: "0.72rem" }}
                                type="button"
                                onClick={() => handleStatus(p, "completed")}
                                disabled={isSaving}
                              >
                                COMPLETE
                              </button>
                            )}

                            <div
                              style={{
                                height: "20px",
                                width: "1px",
                                background: "var(--line)",
                                margin: "0 4px",
                              }}
                            />

                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : p.id)}
                              className="btn-expand-chevron"
                              style={{
                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              }}
                              title="View Booking Details"
                            >
                              ▼
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td
                            colSpan="8"
                            style={{
                              padding: 0,
                              borderBottom: "2px solid var(--green-2)",
                            }}
                          >
                            <div className="expanded-detail-panel">
                              <div className="expanded-grid-3">
                                <div className="detail-section">
                                  <h4 className="detail-heading">Overview & Payment</h4>
                                  {renderPaymentSummaryCompact(p)}
                                </div>

                                <div className="detail-section">
                                  <h4 className="detail-heading">Cancellation Request</h4>
                                  {renderCancellationBox(p)}
                                </div>

                                <div className="detail-section">
                                  <h4 className="detail-heading">Purchased Items</h4>
                                  {renderSelectedItemsCompact(p)}
                                </div>
                              </div>

                              <div style={{ marginTop: "18px" }}>
                                <div className="detail-section">
                                  <h4 className="detail-heading">Customer Form</h4>
                                  {renderDynamicAnswersCompact(p)}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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