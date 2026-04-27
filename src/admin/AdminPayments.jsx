import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

function badgeLabel(s) {
  s = String(s || "pending").toLowerCase();
  if (s === "paid") return "PAID";
  if (s === "rejected") return "REJECTED";
  return "PENDING";
}

export default function AdminPayments() {
  const [csrf, setCsrf] = useState("");
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState({ all: 0, pending: 0, paid: 0, rejected: 0 });
  const [payments, setPayments] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState({});
  const [statuses, setStatuses] = useState({});
  const [savingId, setSavingId] = useState(null);

  const loadData = async (statusValue = status, qValue = q) => {
    try {
      const { data } = await adminApi.get("/admin/admin-payments.php", { params: { status: statusValue, q: qValue } });
      setCsrf(data.csrf || "");
      setCounts(data.counts || { all: 0, pending: 0, paid: 0, rejected: 0 });
      setPayments(data.payments || []);

      const nextNotes = {};
      const nextStatuses = {};
      (data.payments || []).forEach((p) => {
        nextNotes[p.id] = p.decoded_context?._admin?.note || "";
        nextStatuses[p.id] = (p.status || "pending").toLowerCase();
      });
      setNotes(nextNotes);
      setStatuses(nextStatuses);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load payments.");
    }
  };

useEffect(() => {
  loadData("pending", q);
}, []);

  const applyFilters = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    loadData(status, q);
  };

  const handleSave = async (paymentId) => {
    if (!window.confirm("Save this payment status update?")) return;
    setSavingId(paymentId);
    setMsg("");
    setErr("");
    try {
      const { data } = await adminApi.post("/admin/admin-payments.php", {
        action: "set_payment_status",
        csrf_token: csrf,
        payment_id: paymentId,
        status: statuses[paymentId],
        admin_note: notes[paymentId] || "",
      });
      if (data.error) setErr(data.error);
      else {
        setMsg(data.message || "Payment updated.");
        loadData(status, q);
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update payment.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminLayout title="Payments (GCash)">
      {msg ? <div className="admin-notice-react ok">{msg}</div> : null}
      {err ? <div className="admin-notice-react bad">{err}</div> : null}

      <div className="admin-panel-react">
        <h3>Filters</h3>
        <form onSubmit={applyFilters} className="admin-form-row-react">
          <div>
            <label className="admin-muted-react" style={{ display: "block", marginBottom: 6 }}>Status</label>
            <select className="admin-input-react" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All ({Number(counts.all)})</option>
              <option value="pending">Pending ({Number(counts.pending)})</option>
              <option value="paid">Paid ({Number(counts.paid)})</option>
              <option value="rejected">Rejected ({Number(counts.rejected)})</option>
            </select>
          </div>

          <div>
            <label className="admin-muted-react" style={{ display: "block", marginBottom: 6 }}>Search (name, email, payer, ref, purpose, token, booking id)</label>
            <input className="admin-input-react" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." />
          </div>

          <button className="admin-pill-react" type="submit">Apply</button>
        </form>
      </div>

      <div className="admin-panel-react">
        <h3>Payments</h3>

       {!payments.length ? (
            <>
              <div className="admin-muted-react">
                {status === "pending"
                  ? "No pending payments."
                  : "No payments found."}
              </div>

              {status === "pending" && (
                <button
                  className="admin-pill-react"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    setStatus("all");
                    loadData("all", q);
                  }}
                >
                  View All Transactions
                </button>
              )}
            </>
          ) : (
          payments.map((p) => {
            const st = String(p.status || "pending").toLowerCase();
            const badgeClass = st === "paid" ? "paid" : st === "rejected" ? "rejected" : "pending";
            const ctx = p.decoded_context || {};
            const paymentChoice = ctx.payment_choice || "";
            const totalAmount = Number(ctx.total_amount || p.total_amount || 0);
            const expectedAmount = Number(ctx.expected_payment_amount || p.amount || 0);
            const paidAt = ctx._paid_at || "";
            const adminCtx = ctx._admin || null;

            let bookingInfo = "";
            if (p.booking_date) {
              bookingInfo = String(p.booking_date).slice(0, 10);
              if (p.start_time && p.end_time) bookingInfo += ` • ${p.start_time} - ${p.end_time}`;
              if (p.booking_type) bookingInfo += ` • ${String(p.booking_type).toUpperCase()}`;
            }

            return (
              <div className="pay-card-react" key={p.id}>
                <div className="p-top-react">
                  <div>
                    <div className="p-title-react">
                      {p.purpose || "Payment"}
                      {p.booking_id ? ` • Booking #${Number(p.booking_id)}` : ""}
                      {p.amount !== null && p.amount !== "" ? ` • Amount: ₱${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
                    </div>

                    <div className="p-meta-react">
                      Customer: {p.user_name || "Unknown"} ({p.user_email || ""})<br />
                      Payer Name: {p.payer_name || ""}<br />
                      Payment Option: {paymentChoice ? paymentChoice.toUpperCase() : "N/A"}<br />
                      Booking Total: ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br />
                      Expected Amount: ₱{expectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br />
                      Booking Payment Status: {p.payment_status || "N/A"}<br />
                      {bookingInfo ? <>{`Schedule: ${bookingInfo}`}<br /></> : null}
                      Reference: {p.reference_no || ""}<br />
                      Token: {p.short_payment_token || ""}<br />
                      Submitted: {p.created_at || ""}
                      {paidAt ? ` • Paid At: ${paidAt}` : ""}
                      {adminCtx?.updated_at ? <><br />Last Admin Update: {adminCtx.updated_at}</> : null}
                    </div>
                  </div>

                  <span className={`p-badge-react ${badgeClass}`}>{badgeLabel(p.status)}</span>
                </div>

                <div className="p-row-react p-proof-react">
                  <label>Proof</label>
                  <div>
                    {p.proof_path ? (
                      <a
                        href={`/api/${p.proof_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Proof Image
                      </a>
                    ) : (
                      <span className="admin-muted-react">No proof uploaded.</span>
                    )}
                  </div>
                </div>

                <div className="p-divider-react" />

                <div className="p-row-react">
                  <label>Status</label>
                  <select className="p-select-react" value={statuses[p.id] || st} onChange={(e) => setStatuses({ ...statuses, [p.id]: e.target.value })}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="p-row-react">
                  <label>Admin Note</label>
                  <textarea className="p-textarea-react" placeholder="Reason / note (saved into context_json)" value={notes[p.id] || ""} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
                </div>

                <div className="p-actions-react">
                  <button className="admin-btn-react admin-btn-approve-react" type="button" onClick={() => handleSave(p.id)} disabled={savingId === p.id}>
                    {savingId === p.id ? "SAVING..." : "SAVE"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
}