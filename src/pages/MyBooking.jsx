import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/my-booking.css";
import "../assets/css/universal.css";

const BOOKING_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "awaiting_payment", label: "Awaiting Payment" },
  { key: "approved", label: "Approved" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

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
    .replace(/\bCOMPLETE\b/g, "Complete")
    .replace(/\bCOMPLETED\b/g, "Completed")
    .replace(/\bCANCELLED\b/g, "Cancelled")
    .replace(/\bEVENT_BOOKING\b/g, "Event Booking")
    .replace(/\bPRIVATE_WORKSHOP\b/g, "Private Workshop")
    .replace(/\bWORKSHOP_REGISTRATION\b/g, "Workshop Registration")
    .replace(/\bCUSTOM\b/g, "Custom")
    .replace(/\bNEW\b/g, "New")
    .replace(/_/g, " ")
    .trim();
}

function formatDate(value) {
  if (!value) return "N/A";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function getCustomerStatus(status) {
  switch (String(status || "").toLowerCase()) {
    case "approved":
      return {
        label: "Confirmed",
        className: "my-booking-badge--paid",
      };

    case "complete":
    case "completed":
      return {
        label: "Completed",
        className: "my-booking-badge--paid",
      };

    case "cancelled":
      return {
        label: "Cancelled",
        className: "my-booking-badge--rejected",
      };

    case "rejected":
      return {
        label: "Rejected",
        className: "my-booking-badge--rejected",
      };

    case "pending_payment":
    case "awaiting_payment":
      return {
        label: "Awaiting Payment",
        className: "my-booking-badge--awaiting",
      };

    case "pending":
      return {
        label: "Waiting for Approval",
        className: "my-booking-badge--pending",
      };

    default:
      return {
        label: readableText(status || "Pending"),
        className: "my-booking-badge--pending",
      };
  }
}

function getCustomerPaymentStatus(status) {
  switch (String(status || "unpaid").toLowerCase()) {
    case "paid":
      return {
        label: "Paid",
        className: "my-booking-badge--paid",
      };

    case "partial":
      return {
        label: "Partially Paid",
        className: "my-booking-badge--partial",
      };

    case "pending":
      return {
        label: "Payment Under Review",
        className: "my-booking-badge--pending",
      };

    case "rejected":
      return {
        label: "Payment Rejected",
        className: "my-booking-badge--rejected",
      };

    default:
      return {
        label: "Unpaid",
        className: "my-booking-badge--unpaid",
      };
  }
}

function getRemainingBalance(booking) {
  const totalAmount = Number(booking.total_amount || 0);
  const amountPaid = Number(booking.amount_paid || 0);

  return Math.max(totalAmount - amountPaid, 0);
}

function hasPaidHalfOrPartial(booking) {
  const totalAmount = Number(booking.total_amount || 0);
  const amountPaid = Number(booking.amount_paid || 0);
  const remainingBalance = getRemainingBalance(booking);

  return totalAmount > 0 && amountPaid > 0 && remainingBalance > 0;
}

function getPaymentAction(booking) {
  const recordType = String(booking.record_type || "booking").toLowerCase();
  const bStatus = String(booking.status || "").toLowerCase();
  const pStatus = String(booking.payment_status || "unpaid").toLowerCase();
  const refundStatus = String(booking.refund_status || "").toLowerCase();

  if (["pending", "approved"].includes(refundStatus)) return null;
  if (["cancelled", "rejected"].includes(bStatus)) return null;
  if (pStatus === "paid") return null;

  if (hasPaidHalfOrPartial(booking)) {
    return { label: "Pay Remaining", choice: "remaining" };
  }

  if (pStatus === "pending") return null;

  if (pStatus === "partial") {
    return { label: "Pay Remaining", choice: "remaining" };
  }

  if (recordType === "workshop_registration") {
    return { label: "Pay Now", choice: "full_payment" };
  }

  return { label: "Pay Now", choice: "downpayment" };
}

function canDeleteUnpaidBooking(booking) {
  const recordType = String(booking.record_type || "booking").toLowerCase();
  const bStatus = String(booking.status || "").toLowerCase();
  const pStatus = String(booking.payment_status || "unpaid").toLowerCase();
  const refundStatus = String(booking.refund_status || "").toLowerCase();

  const cancelRequested =
    Number(booking.cancel_requested) === 1 || booking.cancel_requested === true;

  if (cancelRequested) return false;
  if (["pending", "approved"].includes(refundStatus)) return false;

  if (recordType === "workshop_registration") {
    return pStatus === "unpaid" && bStatus === "pending";
  }

  return pStatus === "unpaid" && ["pending_payment", "pending"].includes(bStatus);
}

function canCancel(booking) {
  const recordType = String(booking.record_type || "booking").toLowerCase();
  const refundStatus = String(booking.refund_status || "").toLowerCase();

  if (recordType === "workshop_registration") return false;
  if (["pending", "approved"].includes(refundStatus)) return false;

  const bStatus = String(booking.status || "").toLowerCase();
  const pStatus = String(booking.payment_status || "unpaid").toLowerCase();

  const cancelRequested =
    Number(booking.cancel_requested) === 1 || booking.cancel_requested === true;

  if (pStatus === "unpaid") return false;

  return ["pending", "approved"].includes(bStatus) && !cancelRequested;
}

function canRequestRefund(booking) {
  const bStatus = String(booking.status || "").toLowerCase();
  const pStatus = String(booking.payment_status || "unpaid").toLowerCase();
  const amountPaid = Number(booking.amount_paid || 0);
  const refundStatus = String(booking.refund_status || "").toLowerCase();

  if (["pending", "approved", "rejected"].includes(refundStatus)) return false;
  if (["cancelled", "rejected"].includes(bStatus)) return false;
  if (!["paid", "partial", "pending"].includes(pStatus)) return false;
  if (amountPaid <= 0) return false;

  return true;
}

function formatTimeRange(booking) {
  if (booking.start_time && booking.end_time) {
    return `${booking.start_time?.slice(0, 5)} to ${booking.end_time?.slice(
      0,
      5
    )}`;
  }

  return "N/A";
}

function getFilterKey(booking) {
  const status = String(booking.status || "").toLowerCase();
  const paymentStatus = String(booking.payment_status || "").toLowerCase();
  const displayStatus = String(booking.display_status || "").toLowerCase();

  if (["cancelled", "rejected"].includes(status)) return "cancelled";
  if (["complete", "completed"].includes(status)) return "completed";
  if (status === "approved") return "approved";

  if (
    status === "pending_payment" ||
    displayStatus === "awaiting_payment" ||
    paymentStatus === "pending"
  ) {
    return "awaiting_payment";
  }

  if (status === "pending") return "pending";

  return "all";
}

function getActionNote(booking) {
  const paymentStatus = String(booking.payment_status || "").toLowerCase();
  const refundStatus = String(booking.refund_status || "").toLowerCase();

  const cancelRequested =
    Number(booking.cancel_requested) === 1 || booking.cancel_requested === true;

  if (paymentStatus === "pending") {
    return "Payment proof submitted. Please wait for admin verification.";
  }

  if (refundStatus === "pending") {
    return "Refund request submitted. Please wait for admin review.";
  }

  if (refundStatus === "approved") {
    return "Refund approved by admin.";
  }

  if (refundStatus === "rejected") {
    return "Refund request was rejected.";
  }

  if (cancelRequested) {
    return "Cancellation request submitted. Please wait for admin review.";
  }

  if (canRequestRefund(booking)) {
    return "Refund is subject to admin review and policy.";
  }

  if (canCancel(booking)) {
    return "Cancellation request will be reviewed by admin.";
  }

  return "";
}

function RefundStatusBadge({ status }) {
  const refundStatus = String(status || "").toLowerCase();

  if (!["pending", "approved", "rejected"].includes(refundStatus)) return null;

  const label =
    refundStatus === "pending"
      ? "Refund Requested"
      : refundStatus === "approved"
      ? "Refund Approved"
      : "Refund Rejected";

  return (
    <span
      className={`my-booking-small-badge my-booking-small-badge--${refundStatus}`}
      aria-label={label}
    >
      {label}
    </span>
  );
}

function BookingActions({
  booking,
  onPay,
  onDelete,
  onCancel,
  onRefund,
  compact = false,
}) {
  const payAction = getPaymentAction(booking);
  const showDelete = canDeleteUnpaidBooking(booking);
  const showCancel = canCancel(booking);
  const showRefund = canRequestRefund(booking);

  const refundStatus = String(booking.refund_status || "").toLowerCase();

  const hasRefundRequest = ["pending", "approved", "rejected"].includes(
    refundStatus
  );

  const cancelPending =
    Number(booking.cancel_requested) === 1 || booking.cancel_requested === true;

  const note = getActionNote(booking);

  const hasAction =
    payAction ||
    showDelete ||
    showCancel ||
    showRefund ||
    hasRefundRequest ||
    cancelPending;

  return (
    <div
      className={
        compact
          ? "my-booking-actions my-booking-actions--compact"
          : "my-booking-actions"
      }
    >
      <div className="my-booking-action-buttons">
        {payAction && (
          <button
            type="button"
            className="my-booking-action my-booking-action--pay"
            aria-label={payAction.label}
            onClick={() => onPay(booking)}
          >
            {payAction.label}
          </button>
        )}

        {showDelete && (
          <button
            type="button"
            className="my-booking-action my-booking-action--delete"
            aria-label="Delete unpaid reservation"
            onClick={() => onDelete(booking)}
          >
            Delete
          </button>
        )}

        {showCancel && (
          <button
            type="button"
            className="my-booking-action my-booking-action--secondary"
            aria-label="Cancel booking"
            onClick={() => onCancel(booking)}
          >
            Cancel
          </button>
        )}

        {showRefund && (
          <button
            type="button"
            className="my-booking-action my-booking-action--secondary"
            aria-label="Request refund"
            onClick={() => onRefund(booking)}
          >
            Refund
          </button>
        )}

        {hasRefundRequest && <RefundStatusBadge status={refundStatus} />}

        {cancelPending && (
          <span className="my-booking-small-badge my-booking-small-badge--pending">
            Cancel Requested
          </span>
        )}

        {!hasAction && (
          <span className="my-booking-no-action" aria-label="No actions available">
            No action needed
          </span>
        )}
      </div>

      {note && <p className="my-booking-action-note">{note}</p>}
    </div>
  );
}

function BookingSkeleton() {
  return (
    <div className="my-booking-skeleton-wrap" aria-label="Loading bookings">
      {[0, 1, 2].map((item) => (
        <div className="my-booking-skeleton-card" key={item}>
          <div className="my-booking-skeleton-line wide"></div>
          <div className="my-booking-skeleton-line"></div>
          <div className="my-booking-skeleton-row">
            <div className="my-booking-skeleton-pill"></div>
            <div className="my-booking-skeleton-pill"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RefundModal({ booking, onClose, onSuccess }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const refundType =
    String(booking.record_type || "booking").toLowerCase() ===
    "workshop_registration"
      ? "workshop_registration"
      : "booking";

  const amountPaid = Number(booking.amount_paid || 0);
  const estimatedRefund = amountPaid * 0.5;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanReason = reason.trim();

    if (cleanReason.length < 10) {
      setError("Please provide a refund reason of at least 10 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();

      formData.append("refund_type", refundType);
      formData.append("reason", cleanReason);

      if (refundType === "workshop_registration") {
        formData.append("registration_id", String(booking.id));
      } else {
        formData.append("booking_id", String(booking.id));
      }

      const res = await API.post("/user/create-refund-request.php", formData);

      if (res.data?.success) {
        onSuccess(booking, res.data.message);
      } else {
        setError(res.data?.error || "Failed to submit refund request.");
      }
    } catch (err) {
      console.error("Refund request error:", err);

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to submit refund request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && !submitting) onClose();
  };

  return (
    <div className="my-booking-modal-backdrop" onClick={handleBackdrop}>
      <section
        className="my-booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-request-modal-title"
      >
        <header className="my-booking-modal-header">
          <h2 id="refund-request-modal-title">Request Refund</h2>

          <button
            type="button"
            className="my-booking-modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close refund request modal"
          >
            ×
          </button>
        </header>

        <div className="my-booking-modal-body">
          <p className="my-booking-modal-description">
            Refund requests must be submitted at least 1 week before the actual
            event. Approved refund requests will receive 50% of the paid amount.
          </p>

          <div className="my-booking-modal-summary">
            <div>
              <span>Type</span>
              <strong>{displayBookingType(booking)}</strong>
            </div>

            <div>
              <span>Event Date</span>
              <strong>{booking.booking_date || "N/A"}</strong>
            </div>

            <div>
              <span>Amount Paid</span>
              <strong>₱{money(amountPaid)}</strong>
            </div>

            <div>
              <span>Estimated Refund</span>
              <strong>₱{money(estimatedRefund)}</strong>
            </div>
          </div>

          <form className="my-booking-modal-form" onSubmit={handleSubmit}>
            <label htmlFor="refund-request-reason">Refund Reason</label>

            <textarea
              id="refund-request-reason"
              rows={5}
              maxLength={800}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you are requesting a refund..."
              required
              disabled={submitting}
            />

            <div className="my-booking-modal-count">
              {reason.length} / 800 characters
            </div>

            {error && (
              <div className="my-booking-modal-error" role="alert">
                {error}
              </div>
            )}

            <div className="my-booking-modal-warning">
              <strong>Refund policy</strong>
              <span>
                If approved, only 50% of the paid amount will be refunded. If
                rejected, no refund money will be issued.
              </span>
            </div>

            <div className="my-booking-modal-actions">
              <button
                type="button"
                className="my-booking-modal-button my-booking-modal-button--back"
                onClick={onClose}
                disabled={submitting}
              >
                Go Back
              </button>

              <button
                type="submit"
                className="my-booking-modal-button my-booking-modal-button--submit"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Refund Request"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
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
        onSuccess(booking);
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
    <div className="my-booking-modal-backdrop" onClick={handleBackdrop}>
      <section
        className="my-booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-request-modal-title"
      >
        <header className="my-booking-modal-header">
          <h2 id="cancel-request-modal-title">Request Cancellation</h2>

          <button
            type="button"
            className="my-booking-modal-close"
            onClick={onClose}
            aria-label="Close cancellation request modal"
            disabled={submitting}
          >
            ×
          </button>
        </header>

        <div className="my-booking-modal-body">
          <p className="my-booking-modal-description">
            Review your booking details, enter your cancellation reason, then
            submit your request. Cancellation requests are subject to admin
            review.
          </p>

          <div className="my-booking-modal-summary">
            <div>
              <span>Booking Date</span>
              <strong>{booking.booking_date || "N/A"}</strong>
            </div>

            <div>
              <span>Time</span>
              <strong>{formatTimeRange(booking)}</strong>
            </div>

            <div>
              <span>Type</span>
              <strong>{displayBookingType(booking)}</strong>
            </div>
          </div>

          <form className="my-booking-modal-form" onSubmit={handleSubmit}>
            <label htmlFor="cancel-request-reason">
              Reason for Cancellation <span aria-hidden="true">*</span>
            </label>

            <textarea
              id="cancel-request-reason"
              rows={5}
              maxLength={500}
              placeholder="Please explain why you want to cancel this booking..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              disabled={submitting}
            />

            <p className="my-booking-modal-help">
              Please enter at least 10 characters.
            </p>

            <div className="my-booking-modal-count">
              {reason.length} / 500 characters
            </div>

            {error && (
              <div className="my-booking-modal-error" role="alert">
                {error}
              </div>
            )}

            <div className="my-booking-modal-warning">
              <strong>Important</strong>
              <span>
                This request will be reviewed by the admin. The booking may be
                hidden from your active booking list after submission.
              </span>
            </div>

            <div className="my-booking-modal-actions">
              <button
                type="button"
                className="my-booking-modal-button my-booking-modal-button--back"
                onClick={onClose}
                disabled={submitting}
              >
                Go Back
              </button>

              <button
                type="submit"
                className="my-booking-modal-button my-booking-modal-button--submit"
                disabled={submitting}
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

export default function MyBooking() {
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const { data } = await API.get("/user/get-bookings.php");

      const nextBookings = Array.isArray(data?.privateBookings)
        ? data.privateBookings
        : Array.isArray(data?.bookings)
        ? data.bookings
        : Array.isArray(data)
        ? data
        : [];

      setBookings(nextBookings);
    } catch (err) {
      console.error("My booking fetch error:", err);

      if (err.response?.status === 401) {
        navigate("/login?redirect=/my-booking");
        return;
      }

      setErrorMsg(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to load your bookings right now. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const bookingStats = useMemo(() => {
    return bookings.reduce(
      (stats, booking) => {
        const filterKey = getFilterKey(booking);

        stats.total += 1;

        if (filterKey === "pending") {
          stats.pending += 1;
        }

        if (filterKey === "awaiting_payment") {
          stats.awaitingPayment += 1;
        }

        if (filterKey === "approved") {
          stats.confirmed += 1;
        }

        if (filterKey === "completed") {
          stats.completed += 1;
        }

        if (filterKey === "cancelled") {
          stats.cancelled += 1;
        }

        return stats;
      },
      {
        total: 0,
        pending: 0,
        awaitingPayment: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
      }
    );
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (activeFilter === "all") return bookings;

    return bookings.filter((booking) => getFilterKey(booking) === activeFilter);
  }, [bookings, activeFilter]);

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
      "h1, h2, h3, h4, h5, h6, p, button, a, li, th, td, .my-booking-title, .my-booking-label, .my-booking-hint, .my-booking-badge, .my-booking-small-badge"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (tagName !== "button" && tagName !== "a") {
        element.removeAttribute("tabindex");
      }

      if (!isVisible(element)) return;

      const textToRead =
        element.getAttribute("aria-label") ||
        element.innerText ||
        element.textContent ||
        "";

      if (!textToRead.trim()) return;

      if (tagName !== "button" && tagName !== "a") {
        element.setAttribute("tabindex", "0");
      }

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", readableText(textToRead));
      }
    });
  }, [filteredBookings, loading, errorMsg, cancelTarget, refundTarget]);

  const handleCancelSuccess = async () => {
    setCancelTarget(null);
    await loadBookings();
    alert("Cancellation request submitted. The admin will review your request.");
  };

  const handleRefundSuccess = async (_booking, message) => {
    setRefundTarget(null);
    await loadBookings();
    alert(message || "Refund request submitted. The admin will review your request.");
  };

  const handleDeleteUnpaidBooking = async (booking) => {
    const recordType = String(booking.record_type || "booking").toLowerCase();

    const confirmDelete = window.confirm(
      "Delete this unpaid reservation? This will remove it from your booking list."
    );

    if (!confirmDelete) return;

    try {
      const formData = new FormData();

      if (recordType === "workshop_registration") {
        formData.append("registration_id", String(booking.id));

        const res = await API.post(
          "/user/delete-unpaid-workshop-registration.php",
          formData
        );

        if (res.data?.success) {
          await loadBookings();
          alert(res.data.message || "Unpaid workshop registration deleted.");
        } else {
          alert(res.data?.error || "Failed to delete registration.");
        }

        return;
      }

      formData.append("booking_id", String(booking.id));

      const res = await API.post("/user/delete-unpaid-booking.php", formData);

      if (res.data?.success) {
        await loadBookings();
        alert(res.data.message || "Unpaid booking deleted successfully.");
      } else {
        alert(res.data?.error || "Failed to delete booking.");
      }
    } catch (err) {
      console.error("Delete unpaid booking error:", err);

      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to delete. Please try again."
      );
    }
  };

  const handlePayAction = (booking) => {
    const action = getPaymentAction(booking);

    if (!action) return;

    const recordType = String(booking.record_type || "booking").toLowerCase();

    if (recordType === "workshop_registration") {
      navigate(
        `/gcash-payment?purpose=workshop_registration&registration_id=${booking.id}&payment_choice=${action.choice}`
      );
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

    navigate(
      `/gcash-payment?purpose=${purpose}&booking_id=${booking.id}&payment_choice=${action.choice}`
    );
  };

  const filterCounts = {
    all: bookingStats.total,
    pending: bookingStats.pending,
    awaiting_payment: bookingStats.awaitingPayment,
    approved: bookingStats.confirmed,
    completed: bookingStats.completed,
    cancelled: bookingStats.cancelled,
  };

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

      {refundTarget && (
        <RefundModal
          booking={refundTarget}
          onClose={() => setRefundTarget(null)}
          onSuccess={handleRefundSuccess}
        />
      )}

      <main className="my-booking-page" id="readable-content">
        <div className="my-booking-title">My Booking</div>

        <section className="my-booking-card-shell">
          <div className="my-booking-head">
            <div>
              <div className="my-booking-label">Booking Records</div>
              <p className="my-booking-hint">
                Track your workshop and event reservations, payment status, and
                available actions.
              </p>
            </div>

            <button
              type="button"
              className="my-booking-soft-button"
              onClick={loadBookings}
              disabled={loading}
              aria-label="Refresh booking records"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="my-booking-filter-tabs" aria-label="Booking filters">
            {BOOKING_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.key}
                className={`my-booking-filter-tab ${
                  activeFilter === filter.key ? "active" : ""
                }`}
                onClick={() => setActiveFilter(filter.key)}
                aria-label={`${filter.label} bookings, ${
                  filterCounts[filter.key]
                } records`}
              >
                <span>{filter.label}</span>
                <strong>{filterCounts[filter.key]}</strong>
              </button>
            ))}
          </div>

          <hr className="my-booking-divider" />

          {loading ? (
            <BookingSkeleton />
          ) : errorMsg ? (
            <div className="my-booking-state error">{errorMsg}</div>
          ) : filteredBookings.length === 0 ? (
            <div className="my-booking-empty">
              <h3>No bookings found</h3>
              <p>
                There are no records for this filter yet. You can book a
                workshop or event to get started.
              </p>

              <button
                type="button"
                className="my-booking-empty-button"
                onClick={() => navigate("/calendar")}
              >
                Book a Workshop or Event
              </button>
            </div>
          ) : (
            <>
              <div className="my-booking-table-wrap">
                <table className="my-booking-table">
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
                    {filteredBookings.map((booking) => {
                      const bookingStatus = getCustomerStatus(booking.status);
                      const paymentStatus = getCustomerPaymentStatus(
                        booking.payment_status
                      );

                      return (
                        <tr
                          key={
                            booking.row_key ||
                            `${booking.record_type || "booking"}-${booking.id}`
                          }
                        >
                          <td>{booking.booking_date || "N/A"}</td>

                          <td>{formatTimeRange(booking)}</td>

                          <td>
                            <div className="my-booking-type-text">
                              {displayBookingType(booking)}
                            </div>

                            {booking.record_type === "workshop_registration" && (
                              <div className="my-booking-package-note">
                                {booking.package} Package
                              </div>
                            )}
                          </td>

                          <td>
                            <span
                              className={`my-booking-badge ${bookingStatus.className}`}
                            >
                              {bookingStatus.label}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`my-booking-badge ${paymentStatus.className}`}
                            >
                              {paymentStatus.label}
                            </span>
                          </td>

                          <td>
                            {Number(booking.total_amount || 0) > 0 ? (
                              <div className="my-booking-amount">
                                <strong>₱{money(booking.total_amount)}</strong>

                                {Number(booking.amount_paid || 0) > 0 && (
                                  <span>
                                    Paid: ₱{money(booking.amount_paid)} <br />
                                    Balance: ₱
                                    {money(getRemainingBalance(booking))}
                                  </span>
                                )}
                              </div>
                            ) : (
                              "N/A"
                            )}
                          </td>

                          <td>
                            <BookingActions
                              booking={booking}
                              onPay={handlePayAction}
                              onDelete={handleDeleteUnpaidBooking}
                              onCancel={setCancelTarget}
                              onRefund={setRefundTarget}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="my-booking-mobile-list">
                {filteredBookings.map((booking) => {
                  const bookingStatus = getCustomerStatus(booking.status);
                  const paymentStatus = getCustomerPaymentStatus(
                    booking.payment_status
                  );

                  return (
                    <article
                      className="my-booking-mobile-card"
                      key={
                        booking.row_key ||
                        `mobile-${booking.record_type || "booking"}-${booking.id}`
                      }
                    >
                      <div className="my-booking-mobile-top">
                        <div>
                          <p>{displayBookingType(booking)}</p>
                          <h3>
                            {formatDate(booking.booking_date)} •{" "}
                            {formatTimeRange(booking)}
                          </h3>

                          {booking.record_type === "workshop_registration" && (
                            <span className="my-booking-package-note">
                              {booking.package} Package
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="my-booking-mobile-badges">
                        <span
                          className={`my-booking-badge ${bookingStatus.className}`}
                        >
                          Status: {bookingStatus.label}
                        </span>

                        <span
                          className={`my-booking-badge ${paymentStatus.className}`}
                        >
                          Payment: {paymentStatus.label}
                        </span>
                      </div>

                      <div className="my-booking-mobile-amount">
                        <span>Total</span>
                        <strong>₱{money(booking.total_amount)}</strong>

                        {Number(booking.amount_paid || 0) > 0 && (
                          <p>
                            Paid: ₱{money(booking.amount_paid)} • Balance: ₱
                            {money(getRemainingBalance(booking))}
                          </p>
                        )}
                      </div>

                      <BookingActions
                        booking={booking}
                        onPay={handlePayAction}
                        onDelete={handleDeleteUnpaidBooking}
                        onCancel={setCancelTarget}
                        onRefund={setRefundTarget}
                        compact
                      />
                    </article>
                  );
                })}
              </div>
            </>
          )}

          <div className="my-booking-bottom-actions">
            <button
              type="button"
              className="my-booking-back-button"
              aria-label="Back"
              onClick={() => navigate(-1)}
            >
              Back
            </button>

            <button
              type="button"
              className="my-booking-main-button"
              aria-label="Book Now"
              onClick={() => navigate("/calendar")}
            >
              Book Now
            </button>
          </div>
        </section>
      </main>
    </>
  );
}