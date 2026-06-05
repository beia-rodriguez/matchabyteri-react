import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Navbar from "../components/Navbar";
import "../assets/css/user-profile.css";
import "../assets/css/universal.css";

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
    .replace(/\bPENDING_PAYMENT\b/g, "Awaiting Payment")
    .replace(/\bAWAITING_PAYMENT\b/g, "Awaiting Payment")
    .replace(/\bPENDING\b/g, "Pending")
    .replace(/\bREJECTED\b/g, "Rejected")
    .replace(/\bUNPAID\b/g, "Unpaid")
    .replace(/\bAPPROVED\b/g, "Approved")
    .replace(/\bCANCELLED\b/g, "Cancelled")
    .replace(/\bEVENT_BOOKING\b/g, "Event Booking")
    .replace(/\bPRIVATE_WORKSHOP\b/g, "Private Workshop")
    .replace(/\bWORKSHOP_REGISTRATION\b/g, "Workshop Registration")
    .replace(/\bCUSTOM\b/g, "Custom")
    .replace(/\bNEW\b/g, "New")
    .replace(/_/g, " ")
    .trim();
}

function DefaultProfileIcon() {
  return (
    <svg
      className="profile-pic"
      viewBox="0 0 24 24"
      role="img"
      aria-label="User avatar"
      focusable="false"
      style={{
        padding: "18px",
        background: "#1f5b38",
        fill: "#ffffff",
        objectFit: "contain",
      }}
    >
      <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-3.31 0-8 1.67-8 5v1.5c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5V19c0-3.33-4.69-5-8-5Z" />
    </svg>
  );
}

function profilePictureSrc(path) {
  if (!path || !String(path).trim()) return "";

  const rawPath = String(path).trim();

  if (/^blob:/i.test(rawPath) || /^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const clean = rawPath.replace(/^\/+/, "");

  if (clean.startsWith("backend/api/")) {
    return `/${clean}`;
  }

  if (clean.startsWith("api/")) {
    return `/backend/${clean}`;
  }

  if (clean.startsWith("uploads/")) {
    return `/backend/api/${clean}`;
  }

  return `/backend/api/${clean}`;
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

function displayBookingType(booking) {
  if (booking.display_type) return booking.display_type;

  const recordType = String(booking.record_type || "").toLowerCase();
  const bookingType = String(booking.booking_type || "").toLowerCase();

  if (recordType === "workshop_registration") {
    return "Public Workshop Registration";
  }

  if (bookingType === "event_booking") return "Event Booking";
  if (bookingType === "private_workshop") return "Private Workshop";
  if (bookingType === "custom") return "Custom Booking";

  return readableText(bookingType).replace(/\b\w/g, (char) =>
    char.toUpperCase()
  );
}

function paymentBadge(status) {
  switch ((status || "unpaid").toLowerCase()) {
    case "paid":
      return { label: "PAID", className: "profile-status-badge--paid" };
    case "partial":
      return { label: "PARTIAL", className: "profile-status-badge--partial" };
    case "pending":
      return { label: "PENDING", className: "profile-status-badge--pending" };
    case "rejected":
      return {
        label: "REJECTED",
        className: "profile-status-badge--rejected",
      };
    default:
      return { label: "UNPAID", className: "profile-status-badge--unpaid" };
  }
}

function bookingStatusBadge(status) {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return { label: "APPROVED", className: "profile-status-badge--paid" };
    case "cancelled":
      return {
        label: "CANCELLED",
        className: "profile-status-badge--rejected",
      };
    case "rejected":
      return {
        label: "REJECTED",
        className: "profile-status-badge--rejected",
      };
    case "pending_payment":
      return {
        label: "AWAITING PAYMENT",
        className: "profile-status-badge--awaiting",
      };
    case "pending":
      return { label: "PENDING", className: "profile-status-badge--pending" };
    default:
      return {
        label: readableText(status || "PENDING").toUpperCase(),
        className: "profile-status-badge--pending",
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

function canDeleteUnpaidBooking(booking) {
  const recordType = (booking.record_type || "booking").toLowerCase();

  if (recordType === "workshop_registration") return false;

  const bStatus = (booking.status || "").toLowerCase();
  const pStatus = (booking.payment_status || "unpaid").toLowerCase();

  const cancelRequested =
    Number(booking.cancel_requested) === 1 || booking.cancel_requested === true;

  return (
    pStatus === "unpaid" &&
    ["pending_payment", "pending"].includes(bStatus) &&
    !cancelRequested
  );
}

function canCancel(booking) {
  const recordType = (booking.record_type || "booking").toLowerCase();

  if (recordType === "workshop_registration") return false;

  const bStatus = (booking.status || "").toLowerCase();
  const pStatus = (booking.payment_status || "unpaid").toLowerCase();

  const cancelRequested =
    Number(booking.cancel_requested) === 1 || booking.cancel_requested === true;

  if (pStatus === "unpaid") return false;

  return ["pending", "approved"].includes(bStatus) && !cancelRequested;
}

function shouldShowBooking(booking) {
  const status = String(booking.status || "").toLowerCase();

  return !["cancelled", "rejected"].includes(status);
}

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
            Review your booking details, enter your cancellation reason, then
            submit your request.
          </p>

          <div
            className="cancel-request-modal__summary"
            aria-label="Booking summary"
          >
            <div className="cancel-request-modal__summary-row" tabIndex={0}>
              <span className="cancel-request-modal__summary-label">
                Booking Date
              </span>
              <strong className="cancel-request-modal__summary-value">
                {booking.booking_date}
              </strong>
            </div>

            <div className="cancel-request-modal__summary-row" tabIndex={0}>
              <span className="cancel-request-modal__summary-label">Time</span>
              <strong className="cancel-request-modal__summary-value">
                {booking.start_time?.slice(0, 5)} to{" "}
                {booking.end_time?.slice(0, 5)}
              </strong>
            </div>

            <div className="cancel-request-modal__summary-row" tabIndex={0}>
              <span className="cancel-request-modal__summary-label">Type</span>
              <strong className="cancel-request-modal__summary-value cancel-request-modal__summary-value--capitalize">
                {displayBookingType(booking)}
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
                Please enter at least 10 characters.
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
              <span>This booking will be removed from your visible booking list.</span>
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

export default function UserProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [preview, setPreview] = useState(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
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
  const [todayMaxDate, setTodayMaxDate] = useState("");

  const visibleBookings = useMemo(() => {
    return bookings.filter(shouldShowBooking);
  }, [bookings]);

  useEffect(() => {
    setTodayMaxDate(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    setAvatarFailed(false);
  }, [preview, user?.profile_picture]);

  const applyLoadedProfile = (userData, privateBookings) => {
    const nextForm = buildProfileForm(userData);

    setUser(userData);
    setUnreadReplies(userData.unreadReplies || 0);
    setBookings((privateBookings || []).filter(shouldShowBooking));
    setForm(nextForm);
    setOriginalForm(nextForm);
  };

  useEffect(() => {
    Promise.all([
      API.get("/user/get-profile.php"),
      API.get("/user/get-bookings.php"),
    ])
      .then(([profileRes, bookingRes]) => {
        applyLoadedProfile(
          profileRes.data,
          bookingRes.data.privateBookings || []
        );
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
  }, [user, visibleBookings, form, unreadReplies, cancelTarget]);

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
      window.alert(
        "Contact number must be a Philippine mobile number. Example: +63 912 345 6789."
      );
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
      prev.filter((b) => Number(b.id) !== Number(bookingId))
    );

    setCancelTarget(null);
    alert("Cancellation request submitted. This booking was removed from your list.");
  };

  const handleDeleteUnpaidBooking = async (booking) => {
    const confirmDelete = window.confirm(
      "Delete this unpaid booking? This will remove it from your booking list."
    );

    if (!confirmDelete) return;

    try {
      const formData = new FormData();
      formData.append("booking_id", String(booking.id));

      const res = await API.post("/user/delete-unpaid-booking.php", formData);

      if (res.data?.success) {
        setBookings((prev) =>
          prev.filter((b) => Number(b.id) !== Number(booking.id))
        );

        alert(res.data.message || "Unpaid booking deleted successfully.");
      } else {
        alert(res.data?.error || "Failed to delete booking.");
      }
    } catch (err) {
      console.error("Delete unpaid booking error:", err);

      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to delete booking. Please try again."
      );
    }
  };

  const handlePayAction = (booking) => {
    const action = getPaymentAction(booking);

    if (!action) return;

    const recordType = (booking.record_type || "booking").toLowerCase();

    if (recordType === "workshop_registration") {
      return;
    }

    const bookingType = String(booking.booking_type || "").toLowerCase();

    const purposeMap = {
      event_booking: "event_booking",
      private_workshop: "private_workshop",
      custom: "custom",
      event: "event_booking",
      workshop: "private_workshop",
    };

    const purpose = purposeMap[bookingType];

    if (!purpose || purpose === "custom") {
      alert("Invalid booking type for payment.");
      return;
    }

    navigate(`/gcash-payment?purpose=${purpose}&booking_id=${booking.id}`);
  };

  if (!user) return null;

  const isAdmin = user.role?.toLowerCase() === "admin";
  const currentProfilePicture = profilePictureSrc(preview || user.profile_picture);

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
          <div className="top-row">
            <div className="who">
              <div className="profile-pic-container">
                {currentProfilePicture && !avatarFailed ? (
                  <img
                    className="profile-pic"
                    src={currentProfilePicture}
                    alt="User avatar"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <DefaultProfileIcon />
                )}

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
                  type="button"
                  onClick={() => navigate("/admin/dashboard")}
                  className="btn-admin"
                  aria-label="Admin Dashboard"
                >
                  Admin Dashboard
                </button>
              </div>
            )}
          </div>

          {!isAdmin && (
            <div className="quick-actions">
              <button
                type="button"
                className="btn-soft btn-report"
                aria-label="Report Concerns"
                onClick={() => navigate("/report-concerns")}
              >
                Report Concerns
              </button>

              <button
                type="button"
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

          {notice.message && (
            <div
              className={`profile-notice ${notice.type === "bad" ? "bad" : "ok"}`}
              role="alert"
            >
              {notice.message}
            </div>
          )}

          <hr
            style={{
              border: "none",
              borderTop: "1px solid #eee",
              margin: "25px 0",
            }}
          />

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="field full">
              <label htmlFor="profile-name">Name</label>
              <input
                id="profile-name"
                type="text"
                name="name"
                value={form.name}
                maxLength={120}
                autoComplete="name"
                aria-label={
                  form.name.trim() ? `Name: ${form.name}` : "Enter Name"
                }
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="profile-birthdate">Birthdate</label>
              <input
                id="profile-birthdate"
                type="date"
                name="birthdate"
                value={form.birthdate || ""}
                max={todayMaxDate || undefined}
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
                Philippines only. Enter 10 digits after +63, for example
                9123456789.
              </p>
            </div>

            {!isAdmin && (
              <div className="field full bookings-section">
                <div className="bookings-label">My Bookings</div>

                {visibleBookings.length === 0 ? (
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
                        {visibleBookings.map((b) => {
                          const bBadge = bookingStatusBadge(b.status);
                          const pBadge = paymentBadge(b.payment_status);
                          const payAction = getPaymentAction(b);
                          const showDelete = canDeleteUnpaidBooking(b);
                          const showCancel = canCancel(b);
                          const cancelPending =
                            Number(b.cancel_requested) === 1 ||
                            b.cancel_requested === true;

                          return (
                            <tr
                              key={
                                b.row_key ||
                                `${b.record_type || "booking"}-${b.id}`
                              }
                            >
                              <td
                                className="td-date"
                                aria-label={`Booking Date: ${b.booking_date}`}
                              >
                                {b.booking_date || "N/A"}
                              </td>

                              <td
                                className="td-time"
                                aria-label={
                                  b.start_time && b.end_time
                                    ? `Booking Time: ${b.start_time?.slice(
                                        0,
                                        5
                                      )} to ${b.end_time?.slice(0, 5)}`
                                    : "Time not available"
                                }
                              >
                                {b.start_time && b.end_time
                                  ? `${b.start_time?.slice(0, 5)} to ${b.end_time?.slice(0, 5)}`
                                  : "N/A"}
                              </td>

                              <td
                                className="td-type"
                                aria-label={`Booking Type: ${displayBookingType(
                                  b
                                )}`}
                              >
                                {b.record_type === "workshop_registration" ? (
                                  <>
                                    <div>{displayBookingType(b)}</div>
                                    <div
                                      style={{
                                        fontSize: "0.75rem",
                                        color: "#666",
                                        marginTop: "4px",
                                      }}
                                    >
                                      {b.package} Package
                                    </div>
                                  </>
                                ) : (
                                  displayBookingType(b)
                                )}
                              </td>

                              <td>
                                <span
                                  className={`status-badge ${bBadge.className}`}
                                  aria-label={`Booking Status: ${readableText(
                                    bBadge.label
                                  )}`}
                                >
                                  {bBadge.label}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={`status-badge ${pBadge.className}`}
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
                                    ? `Total Amount: ${money(
                                        b.total_amount
                                      )} pesos`
                                    : "No amount"
                                }
                              >
                                {b.total_amount > 0 ? (
                                  <>
                                    <div>Total: ₱{money(b.total_amount)}</div>

                                    {Number(b.amount_paid || 0) > 0 && (
                                      <div className="booking-payment-breakdown">
                                        Paid: ₱{money(b.amount_paid)} <br />
                                        Balance: ₱
                                        {money(
                                          Math.max(
                                            Number(b.total_amount || 0) -
                                              Number(b.amount_paid || 0),
                                            0
                                          )
                                        )}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  "N/A"
                                )}
                              </td>

                              <td className="td-actions">
                                <div className="booking-actions-stack">
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

                                  {showDelete && (
                                    <button
                                      type="button"
                                      className="action-btn action-btn--delete"
                                      aria-label="Delete Unpaid Booking"
                                      onClick={() => handleDeleteUnpaidBooking(b)}
                                    >
                                      Delete
                                    </button>
                                  )}

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

                                  {cancelPending && (
                                    <span
                                      className="cancel-pending-badge"
                                      aria-label="Cancel Requested"
                                    >
                                      Cancel Requested
                                    </span>
                                  )}

                                  {!payAction &&
                                    !showDelete &&
                                    !showCancel &&
                                    !cancelPending && (
                                      <span
                                        className="hint"
                                        style={{ fontSize: "0.75rem" }}
                                        aria-label="No actions available"
                                      >
                                        N/A
                                      </span>
                                    )}
                                </div>
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
                aria-label={
                  savingProfile ? "Saving Profile Changes" : "Save Changes"
                }
                disabled={savingProfile}
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>

          <button
            type="button"
            className="logout-link"
            aria-label="Logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
}