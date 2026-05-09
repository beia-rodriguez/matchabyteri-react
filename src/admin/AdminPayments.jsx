import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

function badgeLabel(s) {
  const status = String(s || "pending").toLowerCase();

  if (status === "paid") return "PAID";
  if (status === "rejected") return "REJECTED";

  return "PENDING";
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function proofSrc(path) {
  if (!path) return "";

  const clean = String(path).trim();

  if (/^https?:\/\//i.test(clean)) return clean;
  if (clean.startsWith("/api/")) return clean;

  return `/api/${clean.replace(/^\/+/, "")}`;
}

export default function AdminPayments() {
  const [csrf, setCsrf] = useState("");
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");

  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    paid: 0,
    rejected: 0,
  });

  const [payments, setPayments] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [notes, setNotes] = useState({});
  const [statuses, setStatuses] = useState({});

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const loadData = async (statusValue = status, qValue = q) => {
    try {
      setLoading(true);
      setErr("");

      const { data } = await adminApi.get("/admin/admin-payments.php", {
        params: {
          status: statusValue,
          q: qValue.trim(),
        },
      });

      const nextPayments = Array.isArray(data?.payments) ? data.payments : [];

      setCsrf(data?.csrf || "");
      setCounts(
        data?.counts || {
          all: 0,
          pending: 0,
          paid: 0,
          rejected: 0,
        }
      );
      setPayments(nextPayments);

      const nextNotes = {};
      const nextStatuses = {};

      nextPayments.forEach((p) => {
        nextNotes[p.id] = p.decoded_context?._admin?.note || "";
        nextStatuses[p.id] = String(p.status || "pending").toLowerCase();
      });

      setNotes(nextNotes);
      setStatuses(nextStatuses);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load payments.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData("pending", "");
  }, []);

  const applyFilters = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    await loadData(status, q);
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

      if (data?.error) {
        setErr(data.error);
        return;
      }

      setMsg(data?.message || "Payment updated.");
      await loadData(status, q);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update payment.");
    } finally {
      setSavingId(null);
    }
  };

  const handleViewAll = async () => {
    setStatus("all");
    setMsg("");
    setErr("");
    await loadData("all", q);
  };

  return (
    <AdminLayout title="Payments (GCash)">
      {msg && (
        <div className="admin-notice-react ok" role="status" aria-live="polite">
          {msg}
        </div>
      )}

      {err && (
        <div className="admin-notice-react bad" role="alert" aria-live="assertive">
          {err}
        </div>
      )}

      <div className="admin-panel-react">
        <h3>Filters</h3>

        <form onSubmit={applyFilters} className="admin-form-row-react">
          <div>
            <label
              className="admin-muted-react"
              htmlFor="payment-status"
              style={{ display: "block", marginBottom: 6 }}
            >
              Status
            </label>

            <select
              id="payment-status"
              className="admin-input-react"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All ({Number(counts.all || 0)})</option>
              <option value="pending">Pending ({Number(counts.pending || 0)})</option>
              <option value="paid">Paid ({Number(counts.paid || 0)})</option>
              <option value="rejected">Rejected ({Number(counts.rejected || 0)})</option>
            </select>
          </div>

          <div>
            <label
              className="admin-muted-react"
              htmlFor="payment-search"
              style={{ display: "block", marginBottom: 6 }}
            >
              Search
            </label>

            <input
              id="payment-search"
              className="admin-input-react"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, payer, ref, purpose, token, booking id"
              autoComplete="off"
            />
          </div>

          <button className="admin-pill-react" type="submit" disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
        </form>
      </div>

      <div className="admin-panel-react">
        <h3>Payments</h3>

        {loading ? (
          <div className="admin-muted-react" role="status" aria-live="polite">
            Loading payments...
          </div>
        ) : !payments.length ? (
          <>
            <div className="admin-muted-react">
              {status === "pending" ? "No pending payments." : "No payments found."}
            </div>

            {status === "pending" && (
              <button
                className="admin-pill-react"
                type="button"
                style={{ marginTop: 10 }}
                onClick={handleViewAll}
              >
                View All Transactions
              </button>
            )}
          </>
        ) : (
          payments.map((p) => {
            const paymentId = Number(p.id);
            const st = String(p.status || "pending").toLowerCase();

            const badgeClass =
              st === "paid" ? "paid" : st === "rejected" ? "rejected" : "pending";

            const ctx = p.decoded_context || {};
            const paymentChoice = ctx.payment_choice || "";
            const totalAmount = Number(ctx.total_amount || p.total_amount || 0);
            const expectedAmount = Number(ctx.expected_payment_amount || p.amount || 0);
            const paidAt = ctx._paid_at || "";
            const adminCtx = ctx._admin || null;

            let bookingInfo = "";

            if (p.booking_date) {
              bookingInfo = String(p.booking_date).slice(0, 10);

              if (p.start_time && p.end_time) {
                bookingInfo += ` • ${p.start_time} - ${p.end_time}`;
              }

              if (p.booking_type) {
                bookingInfo += ` • ${String(p.booking_type).toUpperCase()}`;
              }
            }

            return (
              <article className="pay-card-react" key={paymentId}>
                <div className="p-top-react">
                  <div>
                    <div className="p-title-react">
                      {p.purpose || "Payment"}
                      {p.booking_id ? ` • Booking #${Number(p.booking_id)}` : ""}
                      {p.amount !== null && p.amount !== ""
                        ? ` • Amount: ₱${money(p.amount)}`
                        : ""}
                    </div>

                    <div className="p-meta-react">
                      Customer: {p.user_name || "Unknown"} ({p.user_email || ""})
                      <br />
                      Payer Name: {p.payer_name || ""}
                      <br />
                      Payment Option:{" "}
                      {paymentChoice ? paymentChoice.toUpperCase() : "N/A"}
                      <br />
                      Booking Total: ₱{money(totalAmount)}
                      <br />
                      Expected Amount: ₱{money(expectedAmount)}
                      <br />
                      Booking Payment Status: {p.payment_status || "N/A"}
                      <br />
                      {bookingInfo && (
                        <>
                          Schedule: {bookingInfo}
                          <br />
                        </>
                      )}
                      Reference: {p.reference_no || ""}
                      <br />
                      Token: {p.short_payment_token || ""}
                      <br />
                      Submitted: {p.created_at || ""}
                      {paidAt ? ` • Paid At: ${paidAt}` : ""}
                      {adminCtx?.updated_at && (
                        <>
                          <br />
                          Last Admin Update: {adminCtx.updated_at}
                        </>
                      )}
                    </div>
                  </div>

                  <span className={`p-badge-react ${badgeClass}`}>
                    {badgeLabel(p.status)}
                  </span>
                </div>

                <div className="p-row-react p-proof-react">
                  <span className="p-label-react">Proof</span>

                  <div>
                    {p.proof_path ? (
                      <a
                        href={proofSrc(p.proof_path)}
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
                  <label htmlFor={`payment-status-${paymentId}`}>Status</label>

                  <select
                    id={`payment-status-${paymentId}`}
                    className="p-select-react"
                    value={statuses[paymentId] || st}
                    onChange={(e) =>
                      setStatuses((prev) => ({
                        ...prev,
                        [paymentId]: e.target.value,
                      }))
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="p-row-react">
                  <label htmlFor={`admin-note-${paymentId}`}>Admin Note</label>

                  <textarea
                    id={`admin-note-${paymentId}`}
                    className="p-textarea-react"
                    placeholder="Reason / note saved into context_json"
                    value={notes[paymentId] || ""}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [paymentId]: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="p-actions-react">
                  <button
                    className="admin-btn-react admin-btn-approve-react"
                    type="button"
                    onClick={() => handleSave(paymentId)}
                    disabled={savingId === paymentId}
                  >
                    {savingId === paymentId ? "SAVING..." : "SAVE"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
}