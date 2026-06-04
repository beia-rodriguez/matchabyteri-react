import { useCallback, useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "@/assets/css/admin-concerns.css";

export default function AdminConcerns() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [limit, setLimit] = useState(80);

  const [concerns, setConcerns] = useState([]);
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    in_review: 0,
    resolved: 0,
  });
  const [emailReply, setEmailReply] = useState(true);

  const [expandedTicket, setExpandedTicket] = useState(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const loadData = useCallback(async (search = "", stat = "all", lim = 80) => {
    try {
      setErr("");
      setLoading(true);

      const { data } = await adminApi.get("/admin/admin-concerns.php", {
        params: {
          q: String(search || "").trim(),
          status: stat,
          limit: lim,
        },
      });

      if (data.status === "success") {
        setConcerns(data.concerns || []);
        setCounts(data.counts || {});
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load concerns.");
      setConcerns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData("", "all", 80);
  }, [loadData]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setMsg("");
    setExpandedTicket(null);
    loadData(q, statusFilter, limit);
  };

  const toggleTicket = (id) => {
    setExpandedTicket((prev) => (prev === id ? null : id));
  };

  const handleTicketKeyDown = (e, id) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleTicket(id);
    }
  };

  const handleStatusUpdate = async (e, concernId) => {
    e.preventDefault();
    const form = e.target;
    const newStatus = form.status.value;

    if (!window.confirm("Update status for this concern?")) return;

    try {
      setErr("");
      setMsg("");

      const { data } = await adminApi.post("/admin/admin-concerns.php", {
        action: "set_status",
        concern_id: concernId,
        status: newStatus,
      });

      if (data.status === "success") {
        setMsg(data.message);
        loadData(q, statusFilter, limit);
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update status.");
    }
  };

  const handleReplySubmit = async (e, concernId) => {
    e.preventDefault();
    const form = e.target;
    const newStatus = form.status.value;
    const replyText = form.admin_response.value;

    if (!window.confirm("Send this reply to the customer?")) return;

    const btn = form.querySelector("button[type='submit']");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending…";

    try {
      setErr("");
      setMsg("");

      const { data } = await adminApi.post("/admin/admin-concerns.php", {
        action: "reply_concern",
        concern_id: concernId,
        status: newStatus,
        admin_response: replyText,
        email_reply: emailReply,
      });

      if (data.status === "success") {
        setMsg(data.message);
        loadData(q, statusFilter, limit);
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to send reply.");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };

  const formatBadge = (s) => {
    if (s === "resolved") return "Resolved";
    if (s === "in_review") return "In Review";
    return "Pending";
  };

  const getBadgeClass = (s) => {
    if (s === "resolved") return "paid";
    if (s === "in_review") return "in-review";
    return "pending";
  };

  return (
    <AdminLayout title="Customer Concerns">
      {err && (
        <div className="admin-notice-react bad" role="alert">
          {err}
        </div>
      )}

      {msg && (
        <div className="admin-notice-react ok" role="alert">
          {msg}
        </div>
      )}

      <div className="admin-panel-react" style={{ marginBottom: "20px" }}>
        <h3>Filters</h3>

        <form onSubmit={handleFilterSubmit} className="admin-form-row-react">
          <div>
            <label
              className="admin-muted-react"
              htmlFor="concern-status-filter"
              style={{ display: "block", marginBottom: 6 }}
            >
              Status
            </label>

            <select
              aria-label="Concern Status Filter"
              id="concern-status-filter"
              className="admin-input-react"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All ({counts.all})</option>
              <option value="pending">Pending ({counts.pending})</option>
              <option value="in_review">In Review ({counts.in_review})</option>
              <option value="resolved">Resolved ({counts.resolved})</option>
            </select>
          </div>

          <div>
            <label
              className="admin-muted-react"
              htmlFor="concern-search"
              style={{ display: "block", marginBottom: 6 }}
            >
              Search
            </label>

            <input
              aria-label="Concern Search"
              id="concern-search"
              className="admin-input-react"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, Email, Subject…"
            />
          </div>

          <button className="admin-pill-react" type="submit" disabled={loading}>
            {loading ? "Loading…" : "Apply"}
          </button>
        </form>

        <div className="admin-muted-react" style={{ marginTop: 15 }}>
          <label
            htmlFor="email-user-on-reply"
            style={{
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              id="email-user-on-reply"
              type="checkbox"
              aria-label="Email user on reply"
              checked={emailReply}
              onChange={(e) => setEmailReply(e.target.checked)}
            />
            <strong>Email User on Reply</strong>
          </label>
        </div>
      </div>

      <div className="admin-panel-react">
        <h3>Concerns</h3>

        {loading ? (
          <div className="admin-muted-react">Loading concerns…</div>
        ) : concerns.length === 0 ? (
          <div className="admin-muted-react">No concerns found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {concerns.map((c) => {
              const isExpanded = expandedTicket === c.id;
              const contentId = `ticket-content-${c.id}`;

              return (
                <article
                  className="pay-card-react"
                  key={c.id}
                  style={{
                    marginBottom: 0,
                    padding: isExpanded ? "24px" : "16px 24px",
                    borderColor: isExpanded ? "var(--green-2)" : "var(--line)",
                  }}
                >
                  <div
                    className="p-header-react ticket-toggle"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={contentId}
                    onClick={() => toggleTicket(c.id)}
                    onKeyDown={(e) => handleTicketKeyDown(e, c.id)}
                    style={{
                      cursor: "pointer",
                      borderBottom: isExpanded
                        ? "1px dashed var(--line)"
                        : "none",
                      marginBottom: isExpanded ? "16px" : "0",
                      paddingBottom: isExpanded ? "16px" : "0",
                      alignItems: "center",
                      userSelect: "none",
                    }}
                  >
                    <div className="p-header-info">
                      <h4 className="p-title-react" style={{ margin: 0 }}>
                        Ticket #{c.id}{" "}
                        <span
                          style={{
                            color: "var(--ink)",
                            fontWeight: 700,
                            marginLeft: "6px",
                          }}
                        >
                          {c.subject}
                        </span>
                      </h4>

                      <span className="p-date-react">
                        Submitted: {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                      }}
                    >
                      <span className={`p-badge-react ${getBadgeClass(c.status)}`}>
                        {formatBadge(c.status)}
                      </span>

                      <span
                        aria-hidden="true"
                        style={{
                          fontSize: "1.2rem",
                          color: "var(--muted)",
                          transform: isExpanded
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ticket-content" id={contentId}>
                      <div className="p-grid-react">
                        <div className="p-data-group">
                          <span className="p-label-sm">Customer Details</span>
                          <span className="p-value">
                            <strong>{c.user_name || "Unknown"}</strong>
                            <br />
                            <span className="p-subtext">
                              {c.user_email || "N/A"}
                            </span>
                          </span>
                        </div>

                        <div className="p-data-group">
                          <span className="p-label-sm">Concern Scope</span>
                          <span className="p-value">
                            {c.concern_type}
                            <br />
                            <span className="p-subtext">
                              {c.booking_id
                                ? `Booking ID: #${c.booking_id}`
                                : "General Inquiry"}
                            </span>
                          </span>
                        </div>

                        <div className="p-data-group">
                          <span className="p-label-sm">
                            Resolution Timeline
                          </span>
                          <span className="p-value">
                            {c.responded_at ? (
                              <strong style={{ color: "var(--green-2)" }}>
                                Replied:{" "}
                                {new Date(c.responded_at).toLocaleDateString()}
                              </strong>
                            ) : (
                              "Awaiting Reply"
                            )}
                            <br />
                            <span className="p-subtext">
                              Created:{" "}
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="c-details-box">
                        <span className="p-label-sm">Issue Description</span>
                        <p className="c-details-text">{c.details}</p>
                      </div>

                      <hr
                        style={{
                          border: "none",
                          borderTop: "1px dashed var(--line)",
                          margin: "20px 0",
                        }}
                      />

                      <form
                        onSubmit={(e) => handleStatusUpdate(e, c.id)}
                        className="p-admin-row-react"
                        style={{
                          gridTemplateColumns: "auto minmax(140px, 1fr) auto",
                          marginBottom: "16px",
                          background: "transparent",
                          padding: 0,
                          border: "none",
                        }}
                      >
                        <div
                          className="p-admin-col"
                          style={{ justifyContent: "center" }}
                        >
                          <span className="p-label-sm">Quick Action:</span>
                        </div>

                        <div className="p-admin-col">
                          <select
                            name="status"
                            aria-label={`Quick status for ticket #${c.id}`}
                            defaultValue={c.status}
                            className="p-select-react"
                            style={{ height: "38px" }}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_review">In Review</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>

                        <div className="p-admin-col action-col">
                          <button
                            type="submit"
                            className="admin-btn-react admin-btn-cancel-react"
                            style={{ height: "38px", borderRadius: "8px" }}
                          >
                            Update Status Only
                          </button>
                        </div>
                      </form>

                      <form
                        onSubmit={(e) => handleReplySubmit(e, c.id)}
                        className="p-admin-row-react"
                        style={{
                          gridTemplateColumns: "minmax(140px, 1fr) 2fr auto",
                          alignItems: "flex-start",
                        }}
                      >
                        <div className="p-admin-col">
                          <label className="p-label-sm" htmlFor={`reply-status-${c.id}`}>
                            Set Status & Reply
                          </label>

                          <select
                            id={`reply-status-${c.id}`}
                            name="status"
                            aria-label={`Reply status for ticket #${c.id}`}
                            defaultValue={c.status}
                            className="p-select-react"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_review">In Review</option>
                            <option value="resolved">Resolved</option>
                          </select>

                          <label
                            htmlFor={`email-reply-${c.id}`}
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--muted)",
                              marginTop: "8px",
                              display: "flex",
                              gap: "6px",
                              alignItems: "center",
                            }}
                          >
                            <input
                              id={`email-reply-${c.id}`}
                              type="checkbox"
                              aria-label="Email user setting for this reply"
                              checked={emailReply}
                              readOnly
                              style={{ margin: 0 }}
                            />
                            {emailReply ? "Email User" : "Dashboard Only"}
                          </label>
                        </div>

                        <div className="p-admin-col note-col">
                          <label className="p-label-sm" htmlFor={`admin-response-${c.id}`}>
                            Admin Response
                          </label>

                          <textarea
                            id={`admin-response-${c.id}`}
                            name="admin_response"
                            aria-label={`Admin response for ticket #${c.id}`}
                            required
                            defaultValue={c.admin_response || ""}
                            className="p-textarea-react"
                            placeholder="Write your detailed reply to the customer here…"
                          />
                        </div>

                        <div className="p-admin-col action-col">
                          <button
                            type="submit"
                            className="admin-btn-react admin-btn-approve-react"
                            style={{
                              height: "42px",
                              marginTop: "22px",
                              padding: "0 24px",
                              borderRadius: "8px",
                            }}
                          >
                            Send Reply
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}