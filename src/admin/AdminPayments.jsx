import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "@/assets/css/admin-payments.css";

function badgeLabel(s) {
  const status = String(s || "pending").toLowerCase();

  if (status === "paid") return "PAID";
  if (status === "rejected") return "REJECTED";

  return "PENDING";
}

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
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

function cleanStatus(value) {
  const status = String(value || "pending").toLowerCase();

  if (["pending", "paid", "rejected"].includes(status)) return status;

  return "pending";
}

function readablePurpose(value) {
  const purpose = String(value || "").toLowerCase();

  if (purpose === "event_booking") return "Event Booking";
  if (purpose === "private_workshop" || purpose === "workshop_booking") {
    return "Private Workshop";
  }
  if (purpose === "workshop_registration" || purpose === "workshop_public") {
    return "Public Workshop";
  }

  return String(value || "Payment")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getLinkedRecordText(payment) {
  if (payment.linked_record_type === "registration" || payment.registration_id) {
    return `Registration #${payment.registration_id || payment.linked_record_id}`;
  }

  if (payment.booking_id) {
    return `Booking #${payment.booking_id}`;
  }

  return "No linked record";
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
        nextNotes[p.id] = p.admin_notes || p.decoded_context?._admin?.note || "";
        nextStatuses[p.id] = cleanStatus(p.status);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    await loadData(status, q);
  };

  const handleSave = async (payment) => {
    const paymentId = Number(payment.id);
    const currentStatus = cleanStatus(payment.status);
    const nextStatus = cleanStatus(statuses[paymentId]);
    const note = notes[paymentId] || "";

    if (currentStatus === "paid" && nextStatus !== "paid") {
      setErr(
        "Paid payments are locked. Use an adjustment/refund record instead of changing a paid payment back."
      );
      return;
    }

    if (nextStatus === "rejected" && note.trim().length < 5) {
      setErr("Please add a short reason before rejecting a payment.");
      return;
    }

    if (!window.confirm(`Save this payment as ${nextStatus.toUpperCase()}?`)) return;

    setSavingId(paymentId);
    setMsg("");
    setErr("");

    try {
      const { data } = await adminApi.post("/admin/admin-payments.php", {
        action: "set_payment_status",
        csrf_token: csrf,
        payment_id: paymentId,
        status: nextStatus,
        admin_note: note,
      });

      if (data?.error) {
        setErr(data.error);
        return;
      }

      const linkedRecord = data?.linked_record || data?.booking;
      const suffix = linkedRecord
        ? ` Linked record is now ${String(
            linkedRecord.payment_status || ""
          ).toUpperCase()}. Paid: ₱${money(
            linkedRecord.amount_paid
          )}. Balance: ₱${money(linkedRecord.remaining_balance)}.`
        : "";

      setMsg((data?.message || "Payment updated.") + suffix);
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
            const st = cleanStatus(p.status);
            const selectedStatus = cleanStatus(statuses[paymentId] || st);
            const isPaidLocked = st === "paid";
            const isSaving = savingId === paymentId;

            const badgeClass =
              st === "paid" ? "paid" : st === "rejected" ? "rejected" : "pending";

            const ctx = p.decoded_context || {};
            const paymentChoice = ctx.payment_choice || "";
            const totalAmount = Number(ctx.total_amount || p.total_amount || 0);
            const expectedAmount = Number(ctx.expected_payment_amount || p.amount || 0);
            const amountPaid = Number(p.amount_paid || 0);
            const remainingBalance = Number(
              p.remaining_balance || Math.max(totalAmount - amountPaid, 0)
            );
            const paidAt = ctx._paid_at || p.reviewed_at || "";
            const adminCtx = ctx._admin || null;

            const linkedRecordText = getLinkedRecordText(p);
            const linkedSchedule = p.linked_schedule || "";
            const linkedType = p.linked_type || readablePurpose(p.purpose);

            return (
              <article className="pay-card-react" key={paymentId}>
                <div className="p-header-react">
                  <div className="p-header-info">
                    <h4 className="p-title-react">
                      {readablePurpose(p.purpose)}
                      <span className="p-ref">{linkedRecordText}</span>
                    </h4>
                    <span className="p-date-react">Submitted: {p.created_at || "N/A"}</span>
                    {paidAt && st === "paid" && (
                      <span className="p-date-react">Reviewed/Paid: {paidAt}</span>
                    )}
                  </div>

                  <span className={`p-badge-react ${badgeClass}`}>{badgeLabel(p.status)}</span>
                </div>

                <div className="p-grid-react">
                  <div className="p-data-group">
                    <span className="p-label-sm">Customer</span>
                    <span className="p-value">
                      <strong>{p.user_name || p.registration_full_name || "Unknown"}</strong>
                      <br />
                      <span className="p-subtext">
                        {p.user_email || p.registration_email || "No email provided"}
                      </span>
                    </span>
                  </div>

                  <div className="p-data-group">
                    <span className="p-label-sm">Payer & Reference</span>
                    <span className="p-value">
                      Name: {p.payer_name || "-"}
                      <br />
                      <span className="p-subtext">Ref: {p.reference_no || "-"}</span>
                    </span>
                  </div>

                  <div className="p-data-group">
                    <span className="p-label-sm">Linked Record</span>
                    <span className="p-value">
                      {linkedRecordText}
                      <br />
                      <span className="p-subtext">
                        {linkedSchedule || "No schedule"}
                        {linkedType ? ` • ${linkedType}` : ""}
                      </span>
                      <br />
                      <span className="p-subtext">Token: {p.short_payment_token || "-"}</span>
                    </span>
                  </div>

                  <div className="p-data-group">
                    <span className="p-label-sm">Amount Details</span>
                    <span className="p-value">
                      This Proof: {" "}
                      <strong style={{ color: "var(--green-2)" }}>₱{money(expectedAmount)}</strong>
                      <br />
                      <span className="p-subtext">
                        Total: ₱{money(totalAmount)} {" "}
                        {paymentChoice ? `(${String(paymentChoice).toUpperCase()})` : ""}
                      </span>
                      <br />
                      <span className="p-subtext">
                        Record Paid: ₱{money(amountPaid)} • Balance: ₱{money(remainingBalance)}
                      </span>
                    </span>
                  </div>
                </div>

                {adminCtx?.note && (
                  <div className="admin-muted-react" style={{ marginTop: 8 }}>
                    Last admin note: {adminCtx.note}
                  </div>
                )}

                {isPaidLocked && (
                  <div className="admin-muted-react" style={{ marginTop: 8 }}>
                    This payment is locked because it is already paid. Admin notes can still be saved,
                    but the status should not be reversed.
                  </div>
                )}

                <div className="p-admin-row-react">
                  <div className="p-admin-col">
                    <span className="p-label-sm">Proof of Payment</span>
                    {p.proof_path ? (
                      <a
                        href={proofSrc(p.proof_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-view-proof"
                      >
                        🖼️ View Image
                      </a>
                    ) : (
                      <span className="admin-muted-react" style={{ padding: "8px 0" }}>
                        No proof attached
                      </span>
                    )}
                  </div>

                  <div className="p-admin-col">
                    <label className="p-label-sm" htmlFor={`payment-status-${paymentId}`}>
                      Update Status
                    </label>

                    <select
                      id={`payment-status-${paymentId}`}
                      className="p-select-react"
                      value={selectedStatus}
                      disabled={isSaving}
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

                  <div className="p-admin-col note-col">
                    <label className="p-label-sm" htmlFor={`admin-note-${paymentId}`}>
                      Admin Note
                    </label>

                    <input
                      type="text"
                      id={`admin-note-${paymentId}`}
                      className="p-input-react"
                      placeholder="Reason for rejection / general note..."
                      value={notes[paymentId] || ""}
                      disabled={isSaving}
                      onChange={(e) =>
                        setNotes((prev) => ({
                          ...prev,
                          [paymentId]: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="p-admin-col action-col">
                    <button
                      className="admin-btn-react admin-btn-approve-react"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSave(p);
                      }}
                      disabled={isSaving}
                      style={{
                        height: "42px",
                        padding: "0 24px",
                        position: "relative",
                        zIndex: 10,
                        pointerEvents: "auto",
                      }}
                    >
                      {isSaving ? "SAVING..." : "SAVE"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
}
