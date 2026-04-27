import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

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

export default function AdminReservations() {
  const [csrf, setCsrf] = useState("");
  const [pending, setPending] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadData = async () => {
    try {
      const { data } = await adminApi.get("/admin/admin-reservations.php");
      setCsrf(data.csrf || "");
      setPending(data.pending || []);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load reservations.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatus = async (bookingId, newStatus) => {
    if (newStatus === "cancelled" && !window.confirm("Cancel this booking?")) return;
    if (newStatus === "approved" && !window.confirm("Approve this booking?")) return;

    try {
      const { data } = await adminApi.post("/admin/admin-reservations.php", {
        action: "set_status",
        csrf_token: csrf,
        booking_id: bookingId,
        new_status: newStatus,
      });

      if (data.error) {
        setErr(data.error);
      } else {
        setMsg(data.message || "Booking updated.");
        loadData();
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update booking.");
    }
  };

  const renderDynamicAnswers = (booking) => {
    const snapshot = booking.form_snapshot_decoded || {};
    const answers = booking.dynamic_answers || {};
    const sections = snapshot.sections || [];

    if (!sections.length) {
      return <div className="admin-muted-react">No form snapshot available.</div>;
    }

    return sections.map((section) => (
      <div key={section.id || section.title} style={{ marginTop: 12 }}>
        <strong>{section.title}</strong>

        <div className="admin-stat-list-react" style={{ marginTop: 8 }}>
          {(section.fields || []).map((field) => (
            <div className="admin-stat-item-react" key={field.id || field.label}>
              <span>{field.label}</span>
              <strong>{getAnswerLabel(field, answers[field.field_name])}</strong>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  const renderSelectedItems = (booking) => {
    const items = booking.selected_items || [];

    if (!items.length) {
      return <div className="admin-muted-react">No priced items selected.</div>;
    }

    return (
      <div className="admin-stat-list-react">
        {items.map((item, index) => (
          <div className="admin-stat-item-react" key={index}>
            <span>
              {item.field_label}: {item.option_label}
              {item.price_type === "per_quantity" ? ` x ${item.quantity}` : ""}
              {item.price_type === "per_cup" ? ` x ${item.cups || 0} cups` : ""}
            </span>
            <strong>₱{money(item.line_total)}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AdminLayout title="Reservations">
      {msg ? <div className="admin-notice-react ok">{msg}</div> : null}
      {err ? <div className="admin-notice-react bad">{err}</div> : null}

      <div className="admin-panel-react">
        <h3>Pending Reservations</h3>

        {pending.length === 0 ? (
          <div className="admin-muted-react">No pending bookings.</div>
        ) : (
          <table className="admin-table-react">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Time</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Details</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {pending.map((p) => {
                const time =
                  p.start_time && p.end_time ? `${p.start_time} - ${p.end_time}` : "";

                const isExpanded = expandedId === p.id;

                return (
                  <>
                    <tr key={p.id}>
                      <td>#{Number(p.id)}</td>
                      <td>{p.booking_date}</td>
                      <td>{p.booking_type}</td>
                      <td>{p.user_name || "Guest"}</td>
                      <td>{p.user_email || ""}</td>
                      <td>{time}</td>
                      <td>₱{money(p.total_amount)}</td>
                      <td>{p.payment_status || "unpaid"}</td>
                      <td>
                        <button
                          className="admin-pill-react"
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        >
                          {isExpanded ? "Hide" : "View"}
                        </button>
                      </td>
                      <td>
                        <div className="admin-row-actions-react">
                          <button
                            className="admin-btn-react admin-btn-approve-react"
                            type="button"
                            onClick={() => handleStatus(p.id, "approved")}
                          >
                            APPROVE
                          </button>

                          <button
                            className="admin-btn-react admin-btn-cancel-react"
                            type="button"
                            onClick={() => handleStatus(p.id, "cancelled")}
                          >
                            CANCEL
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan="10">
                          <div className="admin-panel-react" style={{ margin: 0 }}>
                            <h3>Booking Details</h3>

                            <div className="admin-grid-3-react">
                              <div className="admin-stat-item-react">
                                <span>Total Amount</span>
                                <strong>₱{money(p.total_amount)}</strong>
                              </div>

                              <div className="admin-stat-item-react">
                                <span>Booking Status</span>
                                <strong>{p.status}</strong>
                              </div>

                              <div className="admin-stat-item-react">
                                <span>Payment Status</span>
                                <strong>{p.payment_status || "unpaid"}</strong>
                              </div>
                            </div>

                            <h3 style={{ marginTop: 18 }}>Selected Priced Items</h3>
                            {renderSelectedItems(p)}

                            <h3 style={{ marginTop: 18 }}>Form Answers</h3>
                            {renderDynamicAnswers(p)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}