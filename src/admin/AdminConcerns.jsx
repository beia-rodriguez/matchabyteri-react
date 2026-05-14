import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

export default function AdminConcerns() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [limit, setLimit] = useState(80);
  
  const [concerns, setConcerns] = useState([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, in_review: 0, resolved: 0 });
  const [emailReply, setEmailReply] = useState(true);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const loadData = async (search = q, stat = statusFilter, lim = limit) => {
    try {
      setErr("");
      setLoading(true);

      const { data } = await adminApi.get("/admin/admin-concerns.php", {
        params: { q: search.trim(), status: stat, limit: lim },
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
  };

  useEffect(() => {
    loadData("", "all", 80);
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setMsg("");
    loadData(q, statusFilter, limit);
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
        // csrf_token: sessionStorage.getItem("csrf_token") // Include if required by your API wrapper
      });

      if (data.status === "success") {
        setMsg(data.message);
        loadData(); // Refresh list to reflect updates/counts
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
    btn.textContent = "Sending...";

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
        loadData(); // Refresh to show new replies/dates/counts
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

  return (
    <AdminLayout title="Customer Concerns">
      {err && <div className="admin-notice-react bad" role="alert">{err}</div>}
      {msg && <div className="admin-notice-react ok" role="alert">{msg}</div>}

      <div className="admin-panel-react" style={{ marginBottom: "20px" }}>
        <h3>Filters</h3>

        <form onSubmit={handleFilterSubmit} className="admin-form-row-react">
          <div>
            <label className="admin-muted-react" style={{ display: "block", marginBottom: 6 }}>
              Status
            </label>
            <select
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
            <label className="admin-muted-react" style={{ display: "block", marginBottom: 6 }}>
              Search
            </label>
            <input
              className="admin-input-react"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, Email, Subject..."
            />
          </div>

          <button className="admin-pill-react" type="submit" disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
        </form>

        <div className="admin-muted-react" style={{ marginTop: 15 }}>
          <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input 
              type="checkbox" 
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
          <div className="admin-muted-react">Loading concerns...</div>
        ) : concerns.length === 0 ? (
          <div className="admin-muted-react">No concerns found.</div>
        ) : (
          <div>
            {concerns.map((c) => (
              <div 
                key={c.id} 
                className="concern-card-react" 
                style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}
              >
                
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <h4 style={{ margin: "0 0 6px", fontSize: "1.1rem", color: "#2f5d4e" }}>{c.subject}</h4>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      <strong>Customer:</strong> {c.user_name || "Unknown"} ({c.user_email || "N/A"})<br />
                      <strong>Type:</strong> {c.concern_type} 
                      {c.booking_id ? ` • Booking ID: ${c.booking_id}` : ""}<br />
                      <strong>Submitted:</strong> {new Date(c.created_at).toLocaleString()}<br />
                      {c.responded_at && (
                        <span><strong>Replied:</strong> {new Date(c.responded_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <span style={{ 
                      padding: "6px 12px", 
                      borderRadius: "20px", 
                      fontSize: "0.8rem", 
                      fontWeight: "bold",
                      border: "1px solid #ddd",
                      background: "#f9f9f9",
                      color: "#333"
                    }}>
                      {formatBadge(c.status)}
                    </span>
                  </div>
                </div>

                <details style={{ marginBottom: "16px" }}>
                  <summary style={{ fontWeight: "bold", cursor: "pointer", color: "#666" }}>View Issue Details</summary>
                  <div style={{ marginTop: "8px", whiteSpace: "pre-wrap", color: "#333", background: "#f1f1f1", padding: "12px", borderRadius: "6px" }}>
                    {c.details}
                  </div>
                </details>

                <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "16px 0" }} />

                {/* Form 1: Status Only Update */}
                <form onSubmit={(e) => handleStatusUpdate(e, c.id)} style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#2f5d4e", whiteSpace: "nowrap" }}>Status Only:</label>
                  <select name="status" defaultValue={c.status} className="admin-input-react" style={{ width: "auto" }}>
                    <option value="pending">Pending</option>
                    <option value="in_review">In Review</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <button type="submit" className="admin-pill-react" style={{ padding: "6px 14px" }}>Update</button>
                </form>

                <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "16px 0" }} />

                {/* Form 2: Reply & Update Status */}
                <form onSubmit={(e) => handleReplySubmit(e, c.id)}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                       <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#2f5d4e" }}>Set Status:</label>
                       <select name="status" defaultValue={c.status} className="admin-input-react" style={{ width: "auto" }}>
                          <option value="pending">Pending</option>
                          <option value="in_review">In Review</option>
                          <option value="resolved">Resolved</option>
                       </select>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#2f5d4e", display: "block", marginBottom: "6px" }}>Admin Reply:</label>
                      <textarea
                        name="admin_response"
                        required
                        defaultValue={c.admin_response || ""}
                        className="admin-input-react"
                        style={{ width: "100%", minHeight: "100px", resize: "vertical" }}
                        placeholder="Write your reply to the customer..."
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                      <span style={{ fontSize: "0.8rem", color: "#666" }}>
                        {emailReply ? "A notification email will be sent to the user." : "Reply will only appear in their account dashboard."}
                      </span>
                      <button type="submit" className="admin-pill-react" style={{ background: "#2f5d4e", color: "white" }}>
                        Send Reply
                      </button>
                    </div>

                  </div>
                </form>

              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}