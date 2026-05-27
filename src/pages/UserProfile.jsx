import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Navbar from "../components/Navbar";
import "../assets/css/user-profile.css";
import "../assets/css/universal.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function readableText(text = "") {
  return String(text)
    .replace(/\bPAID\b/g, "Paid")
    .replace(/\bPARTIAL\b/g, "Partial")
    .replace(/\bPENDING\b/g, "Pending")
    .replace(/\bREJECTED\b/g, "Rejected")
    .replace(/\bUNPAID\b/g, "Unpaid")
    .replace(/\bAPPROVED\b/g, "Approved")
    .replace(/\bCANCELLED\b/g, "Cancelled")
    .replace(/\bNEW\b/g, "New")
    .trim();
}


function profilePictureSrc(path, fallback = "/pics/default-avatar.png") {
  if (!path || !String(path).trim()) return fallback;

  const clean = String(path).trim();

  if (/^blob:/i.test(clean) || /^https?:\/\//i.test(clean)) return clean;
  if (clean.startsWith("/api/")) return clean;

  return `/api/${clean.replace(/^\/+/, "")}`;
}

function buildProfileForm(userData = {}) {
  return {
    name: userData.name || "",
    phone_number: formatPhoneForInput(userData.phone_number || ""),
    birthdate: userData.birthdate || "",
    profile_picture: null,
  };
}

function normalizePhoneNumber(value = "") {
  const clean = String(value).replace(/\s+/g, "").trim();

  if (!clean) return "";

  if (/^09\d{9}$/.test(clean)) {
    return `+63${clean.slice(1)}`;
  }

  if (/^\+639\d{9}$/.test(clean)) {
    return clean;
  }

  if (/^9\d{9}$/.test(clean)) {
    return `+63${clean}`;
  }

  return clean;
}

function formatPhoneForInput(value = "") {
  const clean = String(value).replace(/\s+/g, "").trim();

  if (/^\+639\d{9}$/.test(clean)) {
    return clean.slice(3);
  }

  if (/^09\d{9}$/.test(clean)) {
    return clean.slice(1);
  }

  if (/^9\d{9}$/.test(clean)) {
    return clean;
  }

  return clean.replace(/^\+?63/, "");
}

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

function bookingStatusBadge(status) {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return { label: "APPROVED", color: "var(--green-2, #3a7d44)" };
    case "cancelled":
      return { label: "CANCELLED", color: "#dc2626" };
    case "rejected":
      return { label: "REJECTED", color: "#dc2626" };
    default:
      return {
        label: status?.toUpperCase() || "PENDING",
        color: "var(--muted, #888)",
      };
  }
}

function getPaymentAction(booking) {
  const recordType = (booking.record_type || "booking").toLowerCase();
  const bStatus = (booking.status || "").toLowerCase();
  const pStatus = (booking.payment_status || "unpaid").toLowerCase();

  if (recordType === "workshop_registration") return null;

  if (["cancelled", "rejected"].includes(bStatus)) return null;
  if (pStatus === "paid") return null;
  if (pStatus === "pending") return null;

  if (pStatus === "partial") {
    return { label: "Pay Remaining", choice: "remaining" };
  }

  return { label: "Pay Now", choice: "downpayment" };
}

function canCancel(booking) {
  const recordType = (booking.record_type || "booking").toLowerCase();

  if (recordType === "workshop_registration") return false;

  const bStatus = (booking.status || "").toLowerCase();
  const cancelRequested =
    Number(booking.cancel_requested) === 1 || booking.cancel_requested === true;

  return ["pending", "approved"].includes(bStatus) && !cancelRequested;
}

// ─── Cancel Modal ────────────────────────────────────────────────────────────

function CancelModal({ booking, onClose, onSuccess }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanReason = reason.trim();

    if (cleanReason.length < 10) {
      setError("Please provide a reason of at least 10 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("booking_id", String(booking.id));
      formData.append("reason", cleanReason);

      const res = await API.post("/user/cancel-booking.php", formData);

      if (res.data && res.data.success === true) {
        onSuccess(booking.id);
      } else {
        setError(
          typeof res.data === "string"
            ? res.data
            : res.data?.error || "Failed to submit request."
        );
      }
    } catch (err) {
      console.error("Cancel booking error:", err);

      setError(
        err.response?.data?.error ||
          err.response?.data ||
          "Failed to submit request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && !submitting) onClose();
  };

  return (
    <div
      className="cancel-request-modal__backdrop"
      onClick={handleBackdrop}
      role="presentation"
    >
      <section
        className="cancel-request-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-request-modal-title"
        aria-describedby="cancel-request-modal-description"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cancel-request-modal__header">
          <h2
            className="cancel-request-modal__title"
            id="cancel-request-modal-title"
            tabIndex={0}
          >
            Request Cancellation
          </h2>

          <button
            type="button"
            className="cancel-request-modal__close"
            onClick={onClose}
            aria-label="Close cancellation request modal"
            disabled={submitting}
          >
            ×
          </button>
        </header>

        <div className="cancel-request-modal__body">
          <p
            className="cancel-request-modal__description"
            id="cancel-request-modal-description"
            tabIndex={0}
          >
            Review your booking details, enter your cancellation reason, then submit your request for admin review.
          </p>

          <div className="cancel-request-modal__summary" aria-label="Booking summary">
            <div className="cancel-request-modal__summary-row" tabIndex={0}>
              <span className="cancel-request-modal__summary-label">Booking Date</span>
              <strong className="cancel-request-modal__summary-value">
                {booking.booking_date}
              </strong>
            </div>

            <div className="cancel-request-modal__summary-row" tabIndex={0}>
              <span className="cancel-request-modal__summary-label">Time</span>
              <strong className="cancel-request-modal__summary-value">
                {booking.start_time?.slice(0, 5)} – {booking.end_time?.slice(0, 5)}
              </strong>
            </div>

            <div className="cancel-request-modal__summary-row" tabIndex={0}>
              <span className="cancel-request-modal__summary-label">Type</span>
              <strong className="cancel-request-modal__summary-value cancel-request-modal__summary-value--capitalize">
                {booking.booking_type}
              </strong>
            </div>
          </div>

          <form className="cancel-request-modal__form" onSubmit={handleSubmit}>
            <div className="cancel-request-modal__field">
              <label
                className="cancel-request-modal__label"
                htmlFor="cancel-request-reason"
                tabIndex={0}
              >
                Reason for Cancellation <span aria-hidden="true">*</span>
              </label>

              <textarea
                id="cancel-request-reason"
                className="cancel-request-modal__textarea"
                rows={5}
                maxLength={500}
                placeholder="Please explain why you want to cancel this booking..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                disabled={submitting}
                aria-required="true"
                aria-invalid={error ? "true" : "false"}
                aria-describedby={
                  error
                    ? "cancel-request-reason-help cancel-request-char-count cancel-request-error"
                    : "cancel-request-reason-help cancel-request-char-count"
                }
              />

              <p
                className="cancel-request-modal__help"
                id="cancel-request-reason-help"
                tabIndex={0}
              >
                Please enter at least 10 characters. The submit button stays available so screen readers can detect it.
              </p>

              <div
                className="cancel-request-modal__char-count"
                id="cancel-request-char-count"
                tabIndex={0}
                aria-live="polite"
              >
                {reason.length} / 500 characters
              </div>
            </div>

            {error && (
              <div
                className="cancel-request-modal__error"
                id="cancel-request-error"
                role="alert"
                tabIndex={0}
              >
                {error}
              </div>
            )}

            <div className="cancel-request-modal__warning" tabIndex={0}>
              <strong>⚠ Cancellation requests are subject to admin review.</strong>
              <span>
                Refunds, if applicable, depend on your booking terms.
              </span>
            </div>

            <div className="cancel-request-modal__actions">
              <button
                type="button"
                className="cancel-request-modal__button cancel-request-modal__button--back"
                onClick={onClose}
                disabled={submitting}
              >
                Go Back
              </button>

              <button
                type="submit"
                className="cancel-request-modal__button cancel-request-modal__button--submit"
                disabled={submitting}
                aria-describedby="cancel-request-reason-help"
                aria-label={
                  reason.trim().length < 10
                    ? "Submit Request. Enter at least 10 characters before submitting."
                    : "Submit Request"
                }
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      </section>
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

  const [cancelTarget, setCancelTarget] = useState(null);

  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    birthdate: "",
    profile_picture: null,
  });

  const [originalForm, setOriginalForm] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });

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

        const nextForm = buildProfileForm(userData);
        setForm(nextForm);
        setOriginalForm(nextForm);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login?redirect=/profile");
        }
      });
  }, [navigate]);

  useEffect(() => {
    const readableContent = document.getElementById("readable-content");

    if (!readableContent) return;

    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const readableElements = readableContent.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, input, textarea, select, button, img, a, li, th, td, .profile-title, .name, .email, .admin-badge, .badge-new, .bookings-label, .hint, .status-badge, .cancel-pending-badge"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (
        tagName !== "button" &&
        tagName !== "a" &&
        tagName !== "input" &&
        tagName !== "textarea" &&
        tagName !== "select"
      ) {
        element.removeAttribute("tabindex");
      }

      if (!isVisible(element)) return;

      let textToRead = "";

      if (tagName === "img") {
        textToRead = element.getAttribute("alt") || "";
      } else if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        const parentDiv = element.closest(".field") || element.closest("div");
        const label = parentDiv?.querySelector("label");

        textToRead =
          element.getAttribute("aria-label") ||
          label?.innerText ||
          element.placeholder ||
          element.value ||
          element.name ||
          element.id ||
          "Input field";
      } else {
        textToRead =
          element.getAttribute("aria-label") ||
          element.innerText ||
          element.textContent ||
          "";
      }

      if (!textToRead.trim()) return;

      if (
        tagName !== "button" &&
        tagName !== "a" &&
        tagName !== "input" &&
        tagName !== "textarea" &&
        tagName !== "select"
      ) {
        element.setAttribute("tabindex", "0");
      }

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", readableText(textToRead));
      }
    });
  }, [user, bookings, form, unreadReplies, cancelTarget]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    setNotice({ type: "", message: "" });

    if (name === "profile_picture") {
      const file = files?.[0] || null;

      if (!file) {
        setForm((prev) => ({ ...prev, profile_picture: null }));
        setPreview(null);
        return;
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

      if (!allowedTypes.includes(file.type)) {
        setNotice({
          type: "bad",
          message: "Please choose a JPG, PNG, GIF, or WEBP image.",
        });
        e.target.value = "";
        return;
      }

      if (file.size > 3 * 1024 * 1024) {
        setNotice({
          type: "bad",
          message: "Profile photo must be less than 3MB.",
        });
        e.target.value = "";
        return;
      }

      setForm((prev) => ({ ...prev, profile_picture: file }));

      setPreview((oldPreview) => {
        if (oldPreview) URL.revokeObjectURL(oldPreview);
        return URL.createObjectURL(file);
      });

      return;
    }

    if (name === "phone_number") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);

      setForm((prev) => ({ ...prev, phone_number: digitsOnly }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  if (savingProfile) return;

  const cleanName = form.name.trim();
  const phoneDigits = String(form.phone_number || "").replace(/\D/g, "");
  const cleanPhone = phoneDigits ? normalizePhoneNumber(phoneDigits) : "";
  const cleanBirthdate = form.birthdate || "";

  if (!cleanName) {
    window.alert("Name is required.");
    return;
  }

  if (phoneDigits && !/^9\d{9}$/.test(phoneDigits)) {
    window.alert("Contact number must be a Philippine mobile number. Example: +63 912 345 6789.");
    return;
  }

  if (cleanBirthdate) {
    const selectedDate = new Date(`${cleanBirthdate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(selectedDate.getTime()) || selectedDate > today) {
      window.alert("Birthdate must be a valid date and cannot be in the future.");
      return;
    }
  }

  const changed =
    !originalForm ||
    cleanName !== String(originalForm.name || "").trim() ||
    phoneDigits !== String(originalForm.phone_number || "").replace(/\D/g, "") ||
    cleanBirthdate !== String(originalForm.birthdate || "") ||
    Boolean(form.profile_picture);

  if (!changed) {
    window.alert("No profile changes detected.");
    return;
  }

  const formData = new FormData();

  // Send all current values so the backend can preserve unchanged fields safely.
  formData.append("name", cleanName);
  formData.append("phone_number", cleanPhone);
  formData.append("birthdate", cleanBirthdate);

  if (form.profile_picture) {
    formData.append("profile_picture", form.profile_picture);
  }

  setSavingProfile(true);

  try {
    const res = await API.post("/user/update-profile.php", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (res.data?.success) {
      const updatedProfile = {
        ...user,
        name: res.data.name ?? cleanName,
        phone_number: res.data.phone_number ?? cleanPhone,
        birthdate: res.data.birthdate ?? cleanBirthdate,
        profile_picture: res.data.profile_picture ?? user.profile_picture,
      };

      const nextForm = buildProfileForm(updatedProfile);

      setUser(updatedProfile);
      setForm(nextForm);
      setOriginalForm(nextForm);
      setPreview(null);

      window.alert(res.data.message || "Profile updated successfully.");
    } else {
      window.alert(res.data?.error || "Update failed.");
    }
  } catch (err) {
    console.error("Profile update error:", err);

    window.alert(
      err.response?.data?.error ||
        err.response?.data?.message ||
        "Error updating profile. Please try again."
    );
  } finally {
    setSavingProfile(false);
  }
};

  const handleLogout = async (e) => {
    e.preventDefault();

    if (!window.confirm("Are you sure you want to log out?")) return;

    await API.get("/auth/logout.php");
    localStorage.removeItem("user");
    navigate("/login");
  };

const handleCancelSuccess = (bookingId) => {
  setBookings((prev) =>
    prev.map((b) =>
      Number(b.id) === Number(bookingId)
        ? { ...b, cancel_requested: 1 }
        : b
    )
  );

  setCancelTarget(null);
  alert("Cancellation request submitted. The admin will review your request shortly.");
};

const handlePayAction = (booking) => {
  const action = getPaymentAction(booking);

  if (!action) return;

  const recordType = (booking.record_type || "booking").toLowerCase();

  if (recordType === "workshop_registration") {
    return;
  }

  const purposeMap = {
    event: "event_booking",
    workshop: "workshop_booking",
  };

  const purpose = purposeMap[booking.booking_type];

  if (!purpose) {
    alert("Invalid booking type for payment.");
    return;
  }

  navigate(`/gcash-payment?purpose=${purpose}&booking_id=${booking.id}`);
};

  if (!user) return null;

  const isAdmin = user.role?.toLowerCase() === "admin";

  return (
    <>
      <Navbar />

      {cancelTarget && (
        <CancelModal
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSuccess={handleCancelSuccess}
        />
      )}

      <div className="profile-wrap" id="readable-content">
        <div className="profile-title">Profile</div>

        <div className="profile-card">
          {/* PROFILE HEADER */}
          <div className="top-row">
            <div className="who">
              {/* Profile Image & Upload Button Combined */}
              <div className="profile-pic-container">
                <img
                  className="profile-pic"
                  src={profilePictureSrc(preview || user.profile_picture)}
                  alt="Profile picture"
                />

                <label className="btn-upload-photo" htmlFor="profile-picture-input">
                  Change Photo
                  <input
                    id="profile-picture-input"
                    type="file"
                    name="profile_picture"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    aria-label="Change Profile Photo"
                    onChange={handleChange}
                    hidden
                  />
                </label>
              </div>

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
                  aria-label="Admin Dashboard"
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
                aria-label="Report Concerns"
                onClick={() => navigate("/report-concerns")}
              >
                Report Concerns
              </button>

              <button
                className="btn-soft"
                aria-label={
                  unreadReplies > 0
                    ? `My Concerns. ${unreadReplies} new replies`
                    : "My Concerns"
                }
                onClick={() => navigate("/my-concerns")}
              >
                My Concerns
                {unreadReplies > 0 && (
                  <span className="badge-new">{unreadReplies} NEW</span>
                )}
              </button>
            </div>
          )}

          <hr
            style={{
              border: "none",
              borderTop: "1px solid #eee",
              margin: "25px 0",
            }}
          />

          {/* PROFILE FORM */}
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="field full">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                maxLength={120}
                autoComplete="name"
                aria-label={
                  form.name.trim()
                    ? `Name: ${form.name}`
                    : "Enter Name"
                }
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label>Birthdate</label>
              <input
                type="date"
                name="birthdate"
                value={form.birthdate || ""}
                max={new Date().toISOString().slice(0, 10)}
                autoComplete="bday"
                aria-label={
                  form.birthdate
                    ? `Birthdate: ${form.birthdate}`
                    : "Enter Birthdate"
                }
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label htmlFor="profile-phone-number">Contact Number</label>

              <div className="ph-phone-input">
                <span
                  className="ph-phone-prefix"
                  aria-hidden="true"
                  title="Philippines"
                >
                  🇵🇭 +63
                </span>

                <input
                  id="profile-phone-number"
                  type="tel"
                  name="phone_number"
                  value={form.phone_number}
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel-national"
                  aria-label={
                    form.phone_number.trim()
                      ? `Philippine contact number: plus 63 ${form.phone_number}`
                      : "Enter Philippine mobile number after plus 63"
                  }
                  onChange={handleChange}
                  placeholder="9123456789"
                />
              </div>

              <p className="profile-field-hint">
                Philippines only. Enter 10 digits after +63, for example 9123456789.
              </p>
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
                          const cancelPending =
  Number(b.cancel_requested) === 1 || b.cancel_requested === true;

                          return (
                            <tr key={b.row_key || `${b.record_type || "booking"}-${b.id}`}>
                              <td
                                className="td-date"
                                aria-label={`Booking Date: ${b.booking_date}`}
                              >
                                {b.booking_date}
                              </td>

                              <td
  className="td-time"
  aria-label={
    b.start_time && b.end_time
      ? `Booking Time: ${b.start_time?.slice(0, 5)} to ${b.end_time?.slice(0, 5)}`
      : "Time not available"
  }
>
  {b.start_time && b.end_time
    ? `${b.start_time?.slice(0, 5)} – ${b.end_time?.slice(0, 5)}`
    : "—"}
</td>

                              <td
  className="td-type"
  aria-label={`Booking Type: ${
    b.record_type === "workshop_registration"
      ? `Workshop Registration, ${b.package} package`
      : b.booking_type
  }`}
>
  {b.record_type === "workshop_registration" ? (
    <>
      <div>Workshop Registration</div>
      <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "4px" }}>
        {b.package} Package
      </div>
    </>
  ) : (
    b.booking_type
  )}
</td>

                              <td>
                                <span
                                  className="status-badge"
                                  style={{ color: bBadge.color }}
                                  aria-label={`Booking Status: ${readableText(
                                    bBadge.label
                                  )}`}
                                >
                                  {bBadge.label}
                                </span>
                              </td>

                              <td>
                                <span
                                  className="status-badge"
                                  style={{ color: pBadge.color }}
                                  aria-label={`Payment Status: ${readableText(
                                    pBadge.label
                                  )}`}
                                >
                                  {pBadge.label}
                                </span>
                              </td>

                              <td
                                className="td-amount"
                                aria-label={
                                  b.total_amount > 0
                                    ? `Total Amount: ${money(b.total_amount)} pesos`
                                    : "No amount"
                                }
                              >
                                {b.total_amount > 0 ? (
                                  <>
                                    <div>Total: ₱{money(b.total_amount)}</div>

                                    {b.payment_status?.toLowerCase() === "partial" && (
                                      <div
                                        style={{
                                          color: "#e07b00",
                                          fontSize: "0.75rem",
                                          marginTop: "4px",
                                        }}
                                      >
                                        Paid: ₱{money(b.amount_paid)} <br />
                                        Balance: ₱{money(Math.max(Number(b.total_amount || 0) - Number(b.amount_paid || 0), 0))}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>

                              <td className="td-actions">
                                {/* Pay action */}
                                {payAction && (
                                  <button
                                    type="button"
                                    className="action-btn action-btn--pay"
                                    aria-label={payAction.label}
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
                                    aria-label="Cancel Booking"
                                    onClick={() => setCancelTarget(b)}
                                  >
                                    Cancel
                                  </button>
                                )}

                                {/* Cancel pending indicator */}
                                {cancelPending && (
                                  <span
                                    className="cancel-pending-badge"
                                    aria-label="Cancel Requested"
                                  >
                                    Cancel Requested
                                  </span>
                                )}

                                {/* No actions available */}
                                {!payAction && !showCancel && !cancelPending && (
                                  <span
                                    className="hint"
                                    style={{ fontSize: "0.75rem" }}
                                    aria-label="No actions available"
                                  >
                                    —
                                  </span>
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
              <button
                type="button"
                className="btn btn-back"
                aria-label="Back"
                onClick={() => navigate(-1)}
              >
                Back
              </button>

              <button
                type="submit"
                className="btn btn-save"
                aria-label={savingProfile ? "Saving Profile Changes" : "Save Changes"}
                disabled={savingProfile}
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>

          <div className="logout">
            <a href="#" aria-label="Logout" onClick={handleLogout}>
              Logout
            </a>
          </div>
        </div>
      </div>
    </>
  );
}