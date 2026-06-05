import { Fragment, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "@/assets/css/admin-reservations.css";

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function readableType(type = "") {
  const value = String(type || "").toLowerCase();

  if (value === "event_booking" || value === "event") return "Event Booking";
  if (value === "private_workshop" || value === "workshop") {
    return "Private Workshop";
  }
  if (value === "custom") return "Custom Booking";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

  if (s === "approved" || s === "completed" || s === "complete") return "paid";
  if (s === "cancelled" || s === "rejected") return "rejected";

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

function getInitials(name) {
  if (!name) return "?";

  const parts = name.trim().split(" ");

  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return name.substring(0, 2).toUpperCase();
}

function getAvatarTheme(name) {
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
}

function getBookingGroup(booking) {
  const type = String(booking.booking_type || "").toLowerCase();

  if (type === "event_booking" || type === "event") return "events";
  if (type === "private_workshop" || type === "workshop") {
    return "private_workshops";
  }
  if (type === "custom") return "custom";

  return "custom";
}

function getTabCount(bookings, tab) {
  if (tab === "all") return bookings.length;

  if (tab === "cancel_requests") {
    return bookings.filter(
      (b) =>
        isCancellationRequested(b) &&
        ["pending_payment", "pending", "approved"].includes(
          String(b.status || "").toLowerCase()
        )
    ).length;
  }

  return bookings.filter((b) => getBookingGroup(b) === tab).length;
}

function formatTime(start, end) {
  if (!start || !end) return "No time set";
  return `${String(start).slice(0, 5)} - ${String(end).slice(0, 5)}`;
}

function formatDetailValue(value, fallback = "—") {
  if (value === undefined || value === null || value === "") return fallback;

  if (Array.isArray(value)) {
    if (value.length === 0) return fallback;

    return value
      .flatMap((item) => {
        const text =
          item && typeof item === "object"
            ? item.drink_name ||
              item.label ||
              item.name ||
              item.package_code ||
              JSON.stringify(item)
            : String(item);

        return text ? [text] : [];
      })
      .join(", ");
  }

  if (typeof value === "object") {
    return (
      value.drink_name ||
      value.label ||
      value.name ||
      value.package_code ||
      JSON.stringify(value)
    );
  }

  return String(value);
}

function getNotesValue(notes, keys, fallback = "—") {
  if (!notes || typeof notes !== "object") return fallback;

  for (const key of keys) {
    if (notes[key] !== undefined && notes[key] !== null && notes[key] !== "") {
      return formatDetailValue(notes[key], fallback);
    }
  }

  return fallback;
}

const TABS = [
  { key: "all", label: "All Bookings" },
  { key: "cancel_requests", label: "Cancellation Requests" },
  { key: "events", label: "Events" },
  { key: "private_workshops", label: "Private Workshops" },
  { key: "custom", label: "Custom" },
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
      setBookings(data.bookings || []);
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
          ["pending_payment", "pending", "approved"].includes(
            String(b.status || "").toLowerCase()
          )
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
      setErr("Only pending, pending payment, or approved bookings can be cancelled.");
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
        await loadData();
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
    const balance = Number(booking.balance ?? Math.max(total - amountPaid, 0));

    const downpaymentPercentage = Number(booking.downpayment_percentage || 50);
    const downpaymentAmount = Number(
      booking.downpayment_amount || total * (downpaymentPercentage / 100)
    );

    return (
      <div className="compact-stat-list">
        <div className="compact-stat">
          <span>Booking Status</span>
          <strong className={`p-badge-react ${bookingStatusClass(booking.status)}`}>
            {bookingStatus}
          </strong>
        </div>

        <div className="compact-stat">
          <span>Payment Status</span>
          <strong className={`p-badge-react ${paymentBadgeClass(booking.payment_status)}`}>
            {paymentStatus}
          </strong>
        </div>

        <div className="compact-stat">
          <span>Total Amount</span>
          <strong>₱{money(total)}</strong>
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
        <div className="reservation-empty-note">
          No cancellation request from customer.
        </div>
      );
    }

    return (
      <div className="reservation-cancel-card">
        <div className="reservation-cancel-title">
          Customer Requested Cancellation
        </div>

        <div className="reservation-cancel-reason">
          {booking.cancel_reason || "No reason provided."}
        </div>

        {booking.cancel_requested_at && (
          <div className="reservation-cancel-time">
            Requested at: {booking.cancel_requested_at}
          </div>
        )}
      </div>
    );
  };

  const renderBookingDetailsCompact = (booking) => {
    const notes = booking.notes_decoded || {};
    const type = String(booking.booking_type || "").toLowerCase();

    if (type === "event_booking" || type === "event") {
      return (
        <div className="compact-stat-list">
          <div className="compact-stat">
            <span>Event Type</span>
            <strong>{getNotesValue(notes, ["event_type"])}</strong>
          </div>

          <div className="compact-stat">
            <span>Event Name</span>
            <strong>{getNotesValue(notes, ["event_name"])}</strong>
          </div>

          <div className="compact-stat">
            <span>Location</span>
            <strong>{getNotesValue(notes, ["event_location", "location"])}</strong>
          </div>

          <div className="compact-stat">
            <span>Cup Package</span>
            <strong>{getNotesValue(notes, ["cup_quantity"])} cups</strong>
          </div>

          <div className="compact-stat">
            <span>Price Per Cup</span>
            <strong>₱{money(getNotesValue(notes, ["price_per_cup"], 0))}</strong>
          </div>

          <div className="compact-stat">
            <span>Menu Package</span>
            <strong>
              {getNotesValue(notes, [
                "menu_package_label",
                "menu_package",
                "menu_package_code",
              ])}
            </strong>
          </div>

          <div className="compact-stat">
            <span>Menu Add-on</span>
            <strong>₱{money(getNotesValue(notes, ["menu_addon"], 0))}</strong>
          </div>

          <div className="compact-stat">
            <span>Additional Drinks</span>
            <strong>
              {getNotesValue(notes, ["selected_drinks", "selected_drink_ids"])}
            </strong>
          </div>

          <div className="compact-stat">
            <span>Hojicha Option</span>
            <strong>{getNotesValue(notes, ["hojicha_options"])}</strong>
          </div>

          <div className="compact-stat">
            <span>Other Request</span>
            <strong>{getNotesValue(notes, ["other_request", "special_notes"])}</strong>
          </div>
        </div>
      );
    }

    if (type === "private_workshop" || type === "workshop") {
      return (
        <div className="compact-stat-list">
          <div className="compact-stat">
            <span>Workshop Location</span>
            <strong>{getNotesValue(notes, ["workshop_location", "location"])}</strong>
          </div>

          <div className="compact-stat">
            <span>Total Attendees</span>
            <strong>{getNotesValue(notes, ["total_attendees"])}</strong>
          </div>

          <div className="compact-stat">
            <span>Standard Attendees</span>
            <strong>{getNotesValue(notes, ["standard_attendees"])}</strong>
          </div>

          <div className="compact-stat">
            <span>Premium Attendees</span>
            <strong>{getNotesValue(notes, ["premium_attendees"])}</strong>
          </div>

          <div className="compact-stat">
            <span>Standard Price</span>
            <strong>₱{money(getNotesValue(notes, ["standard_price"], 0))}</strong>
          </div>

          <div className="compact-stat">
            <span>Premium Price</span>
            <strong>₱{money(getNotesValue(notes, ["premium_price"], 0))}</strong>
          </div>

          <div className="compact-stat">
            <span>Other Request</span>
            <strong>{getNotesValue(notes, ["other_request", "special_notes"])}</strong>
          </div>
        </div>
      );
    }

    return (
      <div className="compact-stat-list">
        {Object.entries(notes).length === 0 ? (
          <div className="reservation-empty-note">
            No booking details available.
          </div>
        ) : (
          Object.entries(notes).map(([key, value]) => (
            <div className="compact-stat" key={key}>
              <span>{key.replace(/_/g, " ")}</span>
              <strong>{String(value || "—")}</strong>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderCancelRequestStatus = (booking) => {
    if (!isCancellationRequested(booking)) {
      return <span className="reservation-cancel-none">None</span>;
    }

    return <span className="reservation-cancel-pill">Requested</span>;
  };

  const renderReservationActions = ({
    booking,
    status,
    canApprove,
    canCancel,
    canReject,
    canComplete,
    isSaving,
    isExpanded,
  }) => {
    return (
      <div className="reservation-actions">
        {status === "pending" && canApprove && (
          <button
            className="reservation-action-btn reservation-action-btn--approve"
            type="button"
            onClick={() => handleStatus(booking, "approved")}
            disabled={isSaving}
          >
            {isSaving ? "Saving" : "Approve"}
          </button>
        )}

        {canCancel && (
          <button
            className="reservation-action-btn reservation-action-btn--cancel"
            type="button"
            onClick={() => handleStatus(booking, "cancelled")}
            disabled={isSaving}
          >
            Cancel
          </button>
        )}

        {canReject && (
          <button
            className="reservation-action-btn reservation-action-btn--reject"
            type="button"
            onClick={() => handleStatus(booking, "rejected")}
            disabled={isSaving}
          >
            Reject
          </button>
        )}

        {canComplete && (
          <button
            className="reservation-action-btn reservation-action-btn--complete"
            type="button"
            onClick={() => handleStatus(booking, "completed")}
            disabled={isSaving}
          >
            Complete
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpandedId(isExpanded ? null : booking.id)}
          className={`btn-expand-chevron ${isExpanded ? "is-open" : ""}`}
          title="View booking details"
          aria-label={isExpanded ? "Hide booking details" : "View booking details"}
        >
          ▲
        </button>
      </div>
    );
  };

  return (
    <AdminLayout title="Reservations">
      {msg && <div className="admin-notice-react ok">{msg}</div>}
      {err && <div className="admin-notice-react bad">{err}</div>}

      <div className="admin-panel-react reservations-panel">
        <div className="reservations-panel-header">
          <h3>Reservations Management</h3>

          <p>
            Review pending, approved, completed, cancelled, and customer
            cancellation requests in one place.
          </p>
        </div>

        <div className="reservations-tabs">
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
                className={`reservations-tab ${active ? "active" : ""}`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="reservation-state-message">Loading reservations.</div>
        ) : filteredBookings.length === 0 ? (
          <div className="reservation-state-message">
            No bookings found for this tab.
          </div>
        ) : (
          <div className="reservations-table-wrap">
            <table className="admin-table-react rich-table reservations-table">
              <colgroup>
                <col className="reservation-col-id" />
                <col className="reservation-col-schedule" />
                <col className="reservation-col-customer" />
                <col className="reservation-col-total" />
                <col className="reservation-col-status" />
                <col className="reservation-col-payment" />
                <col className="reservation-col-request" />
                <col className="reservation-col-actions" />
              </colgroup>

              <thead>
                <tr>
                  <th>ID & Type</th>
                  <th>Schedule</th>
                  <th>Customer Info</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Cancel Request</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((p) => {
                  const time = formatTime(p.start_time, p.end_time);
                  const isExpanded = expandedId === p.id;
                  const paymentStatus = String(p.payment_status || "unpaid").toLowerCase();
                  const status = String(p.status || "pending").toLowerCase();

                  const canApprove = canApproveBooking(paymentStatus) && status === "pending";
                  const canCancel = canCancelBooking(p);
                  const canComplete = canCompleteBooking(p);
                  const canReject = canRejectBooking(p);

                  const isSaving = savingId === p.id;
                  const theme = getAvatarTheme(p.user_name || "Guest");

                  return (
                    <Fragment key={p.id}>
                      <tr className={isExpanded ? "reservation-row is-expanded" : "reservation-row"}>
                        <td data-label="ID & Type">
                          <div className="reservation-id">#{Number(p.id)}</div>
                          <div className="reservation-type">
                            {readableType(p.booking_type)}
                          </div>
                        </td>

                        <td data-label="Schedule">
                          <div className="reservation-date">{p.booking_date}</div>
                          <div className="reservation-time">{time}</div>
                        </td>

                        <td data-label="Customer">
                          <div className="reservation-customer">
                            <div
                              className="c-avatar"
                              style={{
                                backgroundColor: theme.bg,
                                color: theme.text,
                              }}
                            >
                              {getInitials(p.user_name || "Guest")}
                            </div>

                            <div className="reservation-customer-meta">
                              <div className="reservation-customer-name">
                                {p.user_name || "Guest"}
                              </div>

                              <div className="reservation-customer-email">
                                {p.user_email || "No email"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td data-label="Total">
                          <strong className="reservation-total">
                            ₱{money(p.total_amount)}
                          </strong>
                        </td>

                        <td data-label="Status">
                          <span className={`p-badge-react ${bookingStatusClass(status)}`}>
                            {status.toUpperCase()}
                          </span>
                        </td>

                        <td data-label="Payment">
                          <span className={`p-badge-react ${paymentBadgeClass(paymentStatus)}`}>
                            {paymentStatus.toUpperCase()}
                          </span>
                        </td>

                        <td data-label="Cancel Request">
                          {renderCancelRequestStatus(p)}
                        </td>

                        <td data-label="Actions">
                          {renderReservationActions({
                            booking: p,
                            status,
                            canApprove,
                            canCancel,
                            canReject,
                            canComplete,
                            isSaving,
                            isExpanded,
                          })}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="reservation-expanded-row">
                          <td colSpan="8">
                            <div className="expanded-detail-panel">
                              <div className="expanded-grid-3">
                                <div className="detail-section">
                                  <h4 className="detail-heading">Overview & Payment</h4>
                                  {renderPaymentSummaryCompact(p)}
                                </div>

                                <div className="detail-section detail-section-cancel">
                                  <h4 className="detail-heading">Cancellation Request</h4>
                                  {renderCancellationBox(p)}
                                </div>

                                <div className="detail-section">
                                  <h4 className="detail-heading">Booking Details</h4>
                                  {renderBookingDetailsCompact(p)}
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