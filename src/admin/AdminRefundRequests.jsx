import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import AdminLayout from "./AdminLayout";
import API from "../services/api";
import "../assets/css/admin-refund-requests.css";

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function readableStatus(status) {
  return String(status || "pending").replace(/_/g, " ").toUpperCase();
}

function readableType(item) {
  if (item.refund_type === "workshop_registration") {
    return "Public Workshop";
  }

  return String(item.booking_type || "Booking")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function requestReference(item) {
  if (item.refund_type === "workshop_registration") {
    return `Registration ID: ${item.registration_id || "N/A"}`;
  }

  return `Booking ID: ${item.booking_id || "N/A"}`;
}

const refundListInitialState = {
  items: [],
  loading: true,
};

function refundListReducer(state, action) {
  switch (action.type) {
    case "loading":
      return {
        ...state,
        loading: true,
      };

    case "success":
      return {
        items: action.items || [],
        loading: false,
      };

    case "failed":
      return {
        ...state,
        loading: false,
      };

    default:
      return state;
  }
}

export default function AdminRefundRequests() {
  const fileInputRef = useRef(null);

  const [refundListState, dispatchRefundList] = useReducer(
    refundListReducer,
    refundListInitialState
  );

  const { items, loading } = refundListState;

  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [adminAttachment, setAdminAttachment] = useState(null);

  const stats = useMemo(() => {
    return {
      all: items.length,
      pending: items.filter((item) => item.status === "pending").length,
      approved: items.filter((item) => item.status === "approved").length,
      rejected: items.filter((item) => item.status === "rejected").length,
    };
  }, [items]);

  const loadRefunds = useCallback(async () => {
    dispatchRefundList({ type: "loading" });

    try {
      const res = await API.get(
        `/admin/admin-refunds.php?status=${encodeURIComponent(statusFilter)}`
      );

      if (res.data?.success) {
        dispatchRefundList({
          type: "success",
          items: res.data.refund_requests || [],
        });
      } else {
        dispatchRefundList({ type: "failed" });
        alert(res.data?.error || "Failed to load refund requests.");
      }
    } catch (err) {
      console.error("Load refund requests error:", err);

      dispatchRefundList({ type: "failed" });

      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to load refund requests."
      );
    }
  }, [statusFilter]);

  useEffect(() => {
    loadRefunds();
  }, [loadRefunds]);

  const closeModal = () => {
    setSelected(null);
    setAdminNotes("");
    setAdminAttachment(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setAdminAttachment(null);
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Only JPG, PNG, WEBP, GIF, or PDF files are allowed.");
      e.target.value = "";
      setAdminAttachment(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Attachment must be 5MB or smaller.");
      e.target.value = "";
      setAdminAttachment(null);
      return;
    }

    setAdminAttachment(file);
  };

  const openRequest = (item) => {
    setSelected(item);
    setAdminNotes(item.admin_notes || "");
    setAdminAttachment(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const reviewRefund = async (item, action) => {
    const label = action === "approved" ? "approve" : "reject";

    if (!window.confirm(`Are you sure you want to ${label} this refund request?`)) {
      return;
    }

    if (action === "rejected" && adminNotes.trim().length < 5) {
      alert("Please enter admin notes before rejecting.");
      return;
    }

    setBusyId(item.id);

    try {
      const formData = new FormData();

      formData.append("refund_id", String(item.id));
      formData.append("action", action);
      formData.append("admin_notes", adminNotes.trim());

      if (adminAttachment) {
        formData.append("admin_attachment", adminAttachment);
      }

      const res = await API.post("/admin/update-refund-request.php", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data?.success) {
        if (res.data.email_sent === false) {
          alert(
            `${
              res.data.message || "Refund request updated."
            }\n\nNote: Email notification was not sent. Check SMTP settings.`
          );
        } else {
          alert(res.data.message || "Refund request updated.");
        }

        closeModal();
        await loadRefunds();
      } else {
        alert(res.data?.error || "Failed to update refund request.");
      }
    } catch (err) {
      console.error("Review refund error:", err);

      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to update refund request."
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout title="Refund Requests">
      <main className="admin-refunds-page">
        <section className="admin-refunds-hero">
          <div>
            <p className="admin-refunds-eyebrow">Admin Panel</p>
            <h1>Refund Requests</h1>
            <p>
              Review 50% refund requests, approve valid cases, reject invalid
              requests, attach a file if needed, and notify customers by email.
            </p>
          </div>
        </section>

        <section className="admin-refunds-stats">
          <button
            type="button"
            className={statusFilter === "all" ? "active" : ""}
            onClick={() => setStatusFilter("all")}
          >
            <span>All</span>
            <strong>{stats.all}</strong>
          </button>

          <button
            type="button"
            className={statusFilter === "pending" ? "active" : ""}
            onClick={() => setStatusFilter("pending")}
          >
            <span>Pending</span>
            <strong>{stats.pending}</strong>
          </button>

          <button
            type="button"
            className={statusFilter === "approved" ? "active" : ""}
            onClick={() => setStatusFilter("approved")}
          >
            <span>Approved</span>
            <strong>{stats.approved}</strong>
          </button>

          <button
            type="button"
            className={statusFilter === "rejected" ? "active" : ""}
            onClick={() => setStatusFilter("rejected")}
          >
            <span>Rejected</span>
            <strong>{stats.rejected}</strong>
          </button>
        </section>

        <section className="admin-refunds-card">
          <div className="admin-refunds-card-head">
            <h2>Requests</h2>

            <button type="button" onClick={loadRefunds}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="admin-refunds-muted">Loading refund requests...</p>
          ) : items.length === 0 ? (
            <p className="admin-refunds-muted">No refund requests found.</p>
          ) : (
            <div className="admin-refunds-table-wrap">
              <table className="admin-refunds-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Paid</th>
                    <th>Refund 50%</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.user_name || "Customer"}</strong>
                        <span>{item.user_email}</span>
                      </td>

                      <td>
                        <strong>{readableType(item)}</strong>
                        <span>
                          {item.refund_type === "workshop_registration"
                            ? item.workshop_title ||
                              item.workshop_package ||
                              "Workshop"
                            : item.booking_date || "Booking"}
                        </span>
                      </td>

                      <td>₱{money(item.amount_paid)}</td>
                      <td>₱{money(item.refundable_amount)}</td>

                      <td>
                        <span
                          className={`refund-status refund-status--${item.status}`}
                        >
                          {readableStatus(item.status)}
                        </span>
                      </td>

                      <td>{item.created_at}</td>

                      <td>
                        <button
                          type="button"
                          className="admin-refunds-view-btn"
                          onClick={() => openRequest(item)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selected && (
          <div className="admin-refunds-modal-backdrop">
            <section className="admin-refunds-modal">
              <header>
                <div>
                  <p>Refund Request</p>
                  <h2>{selected.user_name || "Customer"}</h2>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Close refund request details"
                >
                  ×
                </button>
              </header>

              <div className="admin-refunds-modal-body">
                <div className="admin-refunds-detail-grid">
                  <div>
                    <span>Customer Email</span>
                    <strong>{selected.user_email}</strong>
                  </div>

                  <div>
                    <span>Type</span>
                    <strong>{readableType(selected)}</strong>
                  </div>

                  <div>
                    <span>Booking Reference</span>
                    <strong>{requestReference(selected)}</strong>
                  </div>

                  <div>
                    <span>Customer Number</span>
                    <strong>{selected.customer_phone_number || "N/A"}</strong>
                  </div>

                  <div>
                    <span>GCash Name</span>
                    <strong>{selected.customer_gcash_name || "N/A"}</strong>
                  </div>

                  <div>
                    <span>Amount Paid</span>
                    <strong>₱{money(selected.amount_paid)}</strong>
                  </div>

                  <div>
                    <span>Refund Amount</span>
                    <strong>₱{money(selected.refundable_amount)}</strong>
                  </div>

                  <div>
                    <span>Policy</span>
                    <strong>50% of paid amount</strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong>{readableStatus(selected.status)}</strong>
                  </div>

                  <div>
                    <span>Requested At</span>
                    <strong>{selected.created_at}</strong>
                  </div>

                  <div>
                    <span>Reviewed At</span>
                    <strong>{selected.reviewed_at || "Not reviewed yet"}</strong>
                  </div>
                </div>

                <div className="admin-refunds-reason">
                  <span>Customer Reason</span>
                  <p>{selected.reason}</p>
                </div>

                <label className="admin-refunds-notes">
                  Admin Notes
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes for approval or rejection..."
                    disabled={selected.status !== "pending"}
                  />
                </label>

                <label className="admin-refunds-upload">
                  Attach File for Customer Email
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    onChange={handleAttachmentChange}
                    disabled={selected.status !== "pending"}
                  />

                  <span>
                    Accepted files: JPG, PNG, WEBP, GIF, or PDF. Maximum size:
                    5MB.
                  </span>
                </label>

                {adminAttachment && (
                  <div className="admin-refunds-file-preview">
                    <strong>Selected file:</strong>
                    <span>{adminAttachment.name}</span>
                  </div>
                )}

                {selected.admin_attachment_name && (
                  <div className="admin-refunds-file-preview">
                    <strong>Sent attachment:</strong>
                    <span>{selected.admin_attachment_name}</span>
                  </div>
                )}
              </div>

              <footer>
                <button
                  type="button"
                  className="admin-refunds-secondary"
                  onClick={closeModal}
                >
                  Close
                </button>

                {selected.status === "pending" && (
                  <>
                    <button
                      type="button"
                      className="admin-refunds-reject"
                      disabled={busyId === selected.id}
                      onClick={() => reviewRefund(selected, "rejected")}
                    >
                      Reject Refund
                    </button>

                    <button
                      type="button"
                      className="admin-refunds-approve"
                      disabled={busyId === selected.id}
                      onClick={() => reviewRefund(selected, "approved")}
                    >
                      Approve 50% Refund
                    </button>
                  </>
                )}
              </footer>
            </section>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}