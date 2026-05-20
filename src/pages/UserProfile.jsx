import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Navbar from "../components/Navbar";
import "../assets/css/user-profile.css";
 
// ─── Helpers ────────────────────────────────────────────────────────────────
 
function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
 
/**
 * Returns display config for a payment_status value.
 */
function paymentBadge(status) {
  switch ((status || "unpaid").toLowerCase()) {
    case "paid":
      return { label: "PAID", color: "var(--green-2, #3a7d44)" };
    case "partial":
      return { label: "PARTIAL", color: "#e07b00" };
    case "pending":
      return { label: "PENDING", color: "#2563eb" };
    case "rejected":
      return { label: "REJECTED", color: "#dc2626" };
    default:
      return { label: "UNPAID", color: "var(--muted, #888)" };
  }
}
 
/**
 * Returns display config for a booking status value.
 */
function bookingStatusBadge(status) {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return { label: "APPROVED", color: "var(--green-2, #3a7d44)" };
    case "cancelled":
      return { label: "CANCELLED", color: "#dc2626" };
    case "rejected":
      return { label: "REJECTED", color: "#dc2626" };
    default:
      return { label: status?.toUpperCase() || "PENDING", color: "var(--muted, #888)" };
  }
}
 
/**
 * Whether a booking can have a payment action (pay downpayment / pay remaining).
 * - status must be approved or pending (not cancelled/rejected)
 * - payment_status must NOT be paid or pending (pending means waiting admin verify)
 */
function getPaymentAction(booking) {
  const bStatus = (booking.status || "").toLowerCase();
  const pStatus = (booking.payment_status || "unpaid").toLowerCase();
 
  // Terminal booking states — no payment
  if (["cancelled", "rejected"].includes(bStatus)) return null;
  // Already fully paid
  if (pStatus === "paid") return null;
  // Waiting for admin to verify an already-submitted payment
  if (pStatus === "pending") return null;
 
  if (pStatus === "partial") {
    return { label: "Pay Remaining", choice: "remaining" };
  }
 
  // unpaid or rejected payment → allow paying downpayment
  return { label: "Pay Now", choice: "downpayment" };
}
 
/**
 * Whether the user can request cancellation.
 */
function canCancel(booking) {
  const bStatus = (booking.status || "").toLowerCase();
  return (
    ["pending", "approved"].includes(bStatus) &&
    !booking.cancel_requested
  );
}
 
// ─── Cancel Modal ────────────────────────────────────────────────────────────
 
function CancelModal({ booking, onClose, onSuccess }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
 
    if (reason.trim().length < 10) {
      setError("Please provide a reason of at least 10 characters.");
      return;
    }
 
    setSubmitting(true);
    try {
      const res = await API.post("/user/cancel-booking.php", {
        booking_id: booking.id,
        reason: reason.trim(),
      });
 
      if (res.data.success) {
        onSuccess(booking.id);
      } else {
        setError(res.data.error || "Failed to submit request.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
 
  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };
 
  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Request Cancellation</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
 
        <div className="modal-body">
          <div className="modal-info-row">
            <span className="modal-info-label">Booking Date</span>
            <span className="modal-info-value">{booking.booking_date}</span>
          </div>
          <div className="modal-info-row">
            <span className="modal-info-label">Time</span>
            <span className="modal-info-value">
              {booking.start_time?.slice(0, 5)} – {booking.end_time?.slice(0, 5)}
            </span>
          </div>
          <div className="modal-info-row">
            <span className="modal-info-label">Type</span>
            <span className="modal-info-value" style={{ textTransform: "capitalize" }}>
              {booking.booking_type}
            </span>
          </div>
 
          <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
            <label className="modal-field-label">
              Reason for Cancellation <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              className="modal-textarea"
              rows={4}
              maxLength={500}
              placeholder="Please explain why you want to cancel this booking… (min. 10 characters)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <div className="modal-char-count">{reason.length} / 500</div>
 
            {error && <div className="modal-error">{error}</div>}
 
            <div className="modal-warning">
              ⚠ Cancellation requests are subject to admin review. Refunds, if applicable,
              depend on your booking terms.
            </div>
 
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-back"
                onClick={onClose}
                disabled={submitting}
              >
                Go Back
              </button>
              <button
                type="submit"
                className="btn btn-cancel-confirm"
                disabled={submitting || reason.trim().length < 10}
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
 
// ─── Main Component ──────────────────────────────────────────────────────────
 
export default function UserProfile() {
  const navigate = useNavigate();
 
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [preview, setPreview] = useState(null);
  const [unreadReplies, setUnreadReplies] = useState(0);
 
  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState(null); // booking object or null
 
  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    birthdate: "",
    profile_picture: null,
  });
 
  // ── Data loading ──────────────────────────────────────────────────────────
 
  useEffect(() => {
    Promise.all([
      API.get("/user/get-profile.php"),
      API.get("/user/get-bookings.php"),
    ])
      .then(([profileRes, bookingRes]) => {
        const userData = profileRes.data;
        setUser(userData);
        setUnreadReplies(userData.unreadReplies || 0);
        setBookings(bookingRes.data.privateBookings || []);
 
        setForm({
          name: userData.name || "",
          phone_number: userData.phone_number || "",
          birthdate: userData.birthdate || "",
          profile_picture: null,
        });
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login?redirect=/profile");
        }
      });
  }, [navigate]);
 
  // ── Form handlers ─────────────────────────────────────────────────────────
 
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "profile_picture") {
      const file = files[0];
      setForm((prev) => ({ ...prev, profile_picture: file }));
      if (file) setPreview(URL.createObjectURL(file));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };
 
  const handleSubmit = async (e) => {
    e.preventDefault();
 
    if (!form.name.trim()) {
      alert("Please enter your name.");
      return;
    }
 
    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("phone_number", form.phone_number);
    formData.append("birthdate", form.birthdate);
    if (form.profile_picture) formData.append("profile_picture", form.profile_picture);
 
    try {
      const res = await API.post("/user/update-profile.php", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
 
      if (res.data.success) {
        setUser((prev) => ({
          ...prev,
          profile_picture: res.data.profile_picture,
          name: form.name,
        }));
        setPreview(null);
        alert("Profile updated successfully");
      } else {
        alert(res.data.error || "Update failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error updating profile. Please try again.");
    }
  };
 
  const handleLogout = async (e) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to log out?")) return;
    await API.get("/auth/logout.php");
    localStorage.removeItem("user");
    navigate("/login");
  };
 
  // ── Cancel booking handlers ───────────────────────────────────────────────
 
  const handleCancelSuccess = (bookingId) => {
    // Optimistically mark as cancel_requested in local state
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, cancel_requested: true } : b
      )
    );
    setCancelTarget(null);
    alert("Cancellation request submitted. The admin will review your request shortly.");
  };
 
  // ── Pay remaining ─────────────────────────────────────────────────────────
 
  const handlePayAction = (booking) => {
    const action = getPaymentAction(booking);
    if (!action) return;
 
    const purposeMap = {
      event: "event_booking",
      workshop: "workshop_booking",
    };
    const purpose = purposeMap[booking.booking_type] || "event_booking";
 
    navigate(
      `/gcash-payment?purpose=${purpose}&booking_id=${booking.id}`
    );
  };
 
  // ── Render ────────────────────────────────────────────────────────────────
 
  if (!user) return null;
 
  const isAdmin = user.role?.toLowerCase() === "admin";
 
  return (
    <>
      <Navbar />
 
      {/* Cancel Modal */}
      {cancelTarget && (
        <CancelModal
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSuccess={handleCancelSuccess}
        />
      )}
 
      <div className="profile-wrap">
        <div className="profile-title">Profile</div>
 
        <div className="profile-card">
 
          {/* PROFILE HEADER */}
          <div className="top-row">
            <div className="who">
              <img
                className="profile-pic"
                src={
                  preview
                    ? preview
                    : user.profile_picture && user.profile_picture.trim() !== ""
                    ? `/api/${user.profile_picture}`
                    : "/pics/default-avatar.png"
                }
                alt="Profile"
              />
              <div className="meta">
                <div className="name">{user.name}</div>
                <div className="email">{user.email}</div>
              </div>
            </div>
 
            {isAdmin && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div className="admin-badge">You are an Admin</div>
                <button
                  onClick={() => navigate("/admin/dashboard")}
                  className="btn-admin"
                >
                  Admin Dashboard
                </button>
              </div>
            )}
          </div>
 
          {/* QUICK ACTIONS */}
          {!isAdmin && (
            <div className="quick-actions">
              <button
                className="btn-soft btn-report"
                onClick={() => navigate("/report-concerns")}
              >
                Report Concerns
              </button>
              <button className="btn-soft" onClick={() => navigate("/my-concerns")}>
                My Concerns
                {unreadReplies > 0 && (
                  <span className="badge-new">{unreadReplies} NEW</span>
                )}
              </button>
            </div>
          )}
 
          <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "25px 0" }} />
 
          {/* PROFILE FORM */}
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
 
            <div className="field">
              <label>Email (cannot change)</label>
              <input type="text" value={user.email} disabled />
              <div className="hint">Email cannot be changed from this page.</div>
            </div>
 
            <div className="field">
              <label>Birthdate</label>
              <input
                type="date"
                name="birthdate"
                value={form.birthdate || ""}
                onChange={handleChange}
              />
            </div>
 
            <div className="field">
              <label>Contact Number</label>
              <input
                type="text"
                name="phone_number"
                value={form.phone_number}
                onChange={handleChange}
                placeholder="09XXXXXXXXX"
              />
            </div>
 
            <div className="field full">
              <label>Profile Picture</label>
              <input
                type="file"
                name="profile_picture"
                accept="image/*"
                onChange={handleChange}
              />
              <div className="hint">JPG/PNG/GIF only. Max 2MB.</div>
            </div>
 
            {/* ── BOOKINGS SECTION ────────────────────────────────────────── */}
            {!isAdmin && (
              <div className="field full bookings-section">
                <label className="bookings-label">My Bookings</label>
 
                {bookings.length === 0 ? (
                  <p className="hint">You haven't made any bookings yet.</p>
                ) : (
                  <div className="bookings-table-wrap">
                    <table className="bookings-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Payment</th>
                          <th>Amount</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((b) => {
                          const bBadge = bookingStatusBadge(b.status);
                          const pBadge = paymentBadge(b.payment_status);
                          const payAction = getPaymentAction(b);
                          const showCancel = canCancel(b);
                          const cancelPending = b.cancel_requested;
 
                          return (
                            <tr key={b.id}>
                              <td className="td-date">{b.booking_date}</td>
                              <td className="td-time">
                                {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                              </td>
                              <td className="td-type">{b.booking_type}</td>
                              <td>
                                <span
                                  className="status-badge"
                                  style={{ color: bBadge.color }}
                                >
                                  {bBadge.label}
                                </span>
                              </td>
                              <td>
                                <span
                                  className="status-badge"
                                  style={{ color: pBadge.color }}
                                >
                                  {pBadge.label}
                                </span>
                              </td>
                              <td className="td-amount">
                                {b.total_amount > 0
                                  ? `₱${money(b.total_amount)}`
                                  : "—"}
                              </td>
                              <td className="td-actions">
                                {/* Pay action */}
                                {payAction && (
                                  <button
                                    type="button"
                                    className="action-btn action-btn--pay"
                                    onClick={() => handlePayAction(b)}
                                  >
                                    {payAction.label}
                                  </button>
                                )}
 
                                {/* Cancel action */}
                                {showCancel && (
                                  <button
                                    type="button"
                                    className="action-btn action-btn--cancel"
                                    onClick={() => setCancelTarget(b)}
                                  >
                                    Cancel
                                  </button>
                                )}
 
                                {/* Cancel pending indicator */}
                                {cancelPending && (
                                  <span className="cancel-pending-badge">
                                    Cancel Requested
                                  </span>
                                )}
 
                                {/* No actions available */}
                                {!payAction && !showCancel && !cancelPending && (
                                  <span className="hint" style={{ fontSize: "0.75rem" }}>—</span>
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
            )}
 
            <div className="actions full">
              <button type="button" className="btn btn-back" onClick={() => navigate(-1)}>
                Back
              </button>
              <button type="submit" className="btn btn-save">
                Save Changes
              </button>
            </div>
          </form>
 
          <div className="logout">
            <a href="#" onClick={handleLogout}>
              Logout
            </a>
          </div>
 
        </div>
      </div>
    </>
  );
}