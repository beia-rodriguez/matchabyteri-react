import { Fragment, useEffect, useState } from "react";
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

function canApproveBooking(paymentStatus) {
  const s = String(paymentStatus || "unpaid").toLowerCase();
  return s === "partial" || s === "paid";
}

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getAvatarTheme = (name) => {
  const themes = [
    { bg: '#e8f0eb', text: '#1a4f35' }, 
    { bg: '#e3f2fd', text: '#0d47a1' }, 
    { bg: '#fff3cd', text: '#856404' }, 
    { bg: '#fce4e4', text: '#cc0000' }, 
    { bg: '#f3e5f5', text: '#4a148c' }, 
  ];
  if (!name) return themes[0];
  const charCode = name.charCodeAt(0) || 0;
  return themes[charCode % themes.length];
};

export default function AdminReservations() {
  const [csrf, setCsrf] = useState("");
  const [pending, setPending] = useState([]);
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
      setPending(data.pending || []);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load reservations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatus = async (booking, newStatus) => {
    setMsg("");
    setErr("");

    if (newStatus === "approved" && !canApproveBooking(booking.payment_status)) {
      setErr("This booking cannot be approved until payment is partial or paid.");
      return;
    }

    if (newStatus === "cancelled" && !window.confirm("Cancel this booking?")) return;
    if (newStatus === "approved" && !window.confirm("Approve this booking?")) return;

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

  // --- COMPACT 3-COLUMN RENDER HELPERS ---
  const renderPaymentSummaryCompact = (booking) => {
    const paymentStatus = String(booking.payment_status || "unpaid").toUpperCase();
    const total = Number(booking.total_amount || 0);
    const snapshot = booking.form_snapshot_decoded || {};
    const downpaymentPercentage = Number(snapshot.downpayment_percentage || 50);
    const downpaymentAmount = total * (downpaymentPercentage / 100);
    const remainingAmount = total - downpaymentAmount;

    return (
      <div className="compact-stat-list">
        <div className="compact-stat">
          <span>Booking Status</span>
          <strong style={{ color: 'var(--green-2)' }}>{String(booking.status).toUpperCase()}</strong>
        </div>
        <div className="compact-stat">
          <span>Payment Status</span>
          <strong className={`p-badge-react ${paymentBadgeClass(booking.payment_status)}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
            {paymentStatus}
          </strong>
        </div>
        <div className="compact-stat">
          <span>Total Amount</span>
          <strong style={{ fontSize: '1.05rem', color: 'var(--ink)' }}>₱{money(total)}</strong>
        </div>
        <div className="compact-stat">
          <span>Downpayment ({downpaymentPercentage}%)</span>
          <strong>₱{money(downpaymentAmount)}</strong>
        </div>
        <div className="compact-stat">
          <span>Remaining Balance</span>
          <strong>₱{money(remainingAmount)}</strong>
        </div>
      </div>
    );
  };

  const renderSelectedItemsCompact = (booking) => {
    const items = booking.selected_items || [];
    if (!items.length) return <div className="admin-muted-react" style={{ fontSize: '0.85rem' }}>No priced items selected.</div>;

    return (
      <div className="compact-stat-list">
        {items.map((item, index) => (
          <div className="compact-stat" key={index} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <strong style={{ color: 'var(--ink)' }}>{item.option_label}</strong>
              <strong style={{ color: 'var(--green-2)' }}>₱{money(item.line_total)}</strong>
            </div>
            <span style={{ fontSize: '0.75rem' }}>
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

    if (!sections.length) return <div className="admin-muted-react" style={{ fontSize: '0.85rem' }}>No form snapshot available.</div>;

    return sections.map((section) => (
      <div key={section.id || section.title} style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--green-2)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
          {section.title}
        </span>
        <div className="compact-stat-list">
          {(section.fields || []).map((field) => (
            <div className="compact-stat" key={field.id || field.label}>
              <span>{field.label}</span>
              <strong style={{ textAlign: 'right', maxWidth: '60%' }}>{getAnswerLabel(field, answers[field.field_name])}</strong>
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

      <div className="admin-panel-react" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', background: '#fff' }}>
          <h3 style={{ margin: 0 }}>Pending Reservations</h3>
        </div>

        {loading ? (
          <div className="admin-muted-react" style={{ padding: '24px' }}>Loading reservations...</div>
        ) : pending.length === 0 ? (
          <div className="admin-muted-react" style={{ padding: '24px' }}>No pending bookings.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table-react rich-table" style={{ border: 'none', borderRadius: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>ID & Type</th>
                  <th>Schedule</th>
                  <th>Customer Info</th>
                  <th>Total</th>
                  <th style={{ textAlign: 'center' }}>Payment</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {pending.map((p) => {
                  const time = p.start_time && p.end_time ? `${p.start_time} - ${p.end_time}` : "";
                  const isExpanded = expandedId === p.id;
                  const paymentStatus = String(p.payment_status || "unpaid").toLowerCase();
                  const canApprove = canApproveBooking(paymentStatus);
                  const isSaving = savingId === p.id;
                  const theme = getAvatarTheme(p.user_name || "Guest");

                  return (
                    <Fragment key={p.id}>
                      {/* --- MAIN TABLE ROW --- */}
                      <tr style={{ background: isExpanded ? '#fcfdfc' : '#fff' }}>
                        
                        <td>
                          <div style={{ fontWeight: 900, color: 'var(--green-2)', fontSize: '0.95rem' }}>#{Number(p.id)}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 800, marginTop: '2px' }}>
                            {String(p.booking_type || "").toUpperCase()}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--ink)' }}>{p.booking_date}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                            {time || "No time set"}
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="c-avatar" style={{ backgroundColor: theme.bg, color: theme.text, width: '34px', height: '34px', fontSize: '0.8rem' }}>
                              {getInitials(p.user_name || "Guest")}
                            </div>
                            <div>
                              <div style={{ fontWeight: 900, color: 'var(--green-2)', fontSize: '0.9rem' }}>{p.user_name || "Guest"}</div>
                              <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '2px' }}>{p.user_email || "No email"}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ fontWeight: 800, color: 'var(--ink)' }}>₱{money(p.total_amount)}</td>

                        <td style={{ textAlign: 'center' }}>
                          <span className={`p-badge-react ${paymentBadgeClass(paymentStatus)}`}>
                            {paymentStatus.toUpperCase()}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <button
                              className="admin-btn-react admin-btn-approve-react"
                              style={{ padding: '6px 14px', opacity: canApprove ? 1 : 0.5, cursor: canApprove ? 'pointer' : 'not-allowed', fontSize: '0.75rem' }}
                              type="button"
                              onClick={() => handleStatus(p, "approved")}
                              disabled={!canApprove || isSaving}
                              title={canApprove ? "Approve booking" : "Payment required"}
                            >
                              {isSaving ? "..." : "APPROVE"}
                            </button>
                            <button
                              className="admin-btn-react admin-btn-cancel-react"
                              style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                              type="button"
                              onClick={() => handleStatus(p, "cancelled")}
                              disabled={isSaving}
                            >
                              CANCEL
                            </button>
                            <div style={{ height: '20px', width: '1px', background: 'var(--line)', margin: '0 4px' }}></div>
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : p.id)}
                              className="btn-expand-chevron"
                              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                              title="View Booking Details"
                            >
                              ▼
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* --- COMPACT 3-COLUMN DROPDOWN --- */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" style={{ padding: 0, borderBottom: '2px solid var(--green-2)' }}>
                            <div className="expanded-detail-panel">
                              <div className="expanded-grid-3">
                                
                                {/* Column 1: Financials */}
                                <div className="detail-section">
                                  <h4 className="detail-heading">Overview & Payment</h4>
                                  {renderPaymentSummaryCompact(p)}
                                </div>

                                {/* Column 2: Items */}
                                <div className="detail-section">
                                  <h4 className="detail-heading">Purchased Items</h4>
                                  {renderSelectedItemsCompact(p)}
                                </div>

                                {/* Column 3: Form Details */}
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