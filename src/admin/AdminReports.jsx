import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Filter,
  GraduationCap,
  PartyPopper,
  ReceiptText,
  UserRound,
  X,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "@/assets/css/admin-reports.css";

function money(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTimeRange(start, end) {
  if (!start || !end) return "—";

  const formatOne = (value) => {
    const [h, m] = String(value).split(":");
    const hInt = parseInt(h, 10);

    if (Number.isNaN(hInt)) return value;

    const ampm = hInt >= 12 ? "PM" : "AM";
    return `${hInt % 12 || 12}:${m || "00"} ${ampm}`;
  };

  return `${formatOne(start)} - ${formatOne(end)}`;
}

function readableStatus(value = "unpaid") {
  return String(value || "unpaid")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function paymentBadgeClass(status) {
  const s = String(status || "unpaid").toLowerCase();

  if (s === "paid" || s === "partial") return "paid";
  if (s === "pending") return "pending";
  if (s === "unpaid") return "";
  return "rejected";
}

function getNotesValue(row, keys, fallback = "—") {
  const notes = row.notes_decoded || row.notes || {};

  if (!notes || typeof notes !== "object") return fallback;

  for (const key of keys) {
    const value = notes[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

function getTitle(row, tab) {
  if (tab === "public") {
    return row.title || "Public Workshop";
  }

  if (tab === "private-workshop") {
    const total = getNotesValue(row, ["total_attendees"], "");

    if (total) return `Private Workshop • ${total} attendee(s)`;

    return "Private Workshop";
  }

  const eventName = getNotesValue(row, ["event_name"], "");
  const eventType = getNotesValue(row, ["event_type"], "");

  if (eventName && eventType) return `${eventName} • ${eventType}`;
  if (eventName) return eventName;
  if (eventType) return `${eventType} Event`;

  return "Private Event";
}

function getCustomer(row) {
  return row.full_name || row.user_name || row.email || row.user_email || "Guest";
}

function getAmount(row) {
  const paid = Number(row.paid_amount || 0);
  const total = Number(row.total_amount || 0);

  return paid > 0 ? paid : total;
}

function getPaymentStatus(row) {
  return row.computed_payment_status || row.payment_status || "unpaid";
}

function getActiveRows(data, tab) {
  if (tab === "public") return data.publicWorkshopRows || [];
  if (tab === "private-workshop") return data.privateWorkshopRows || [];
  return data.privateEventRows || [];
}

function ReportSummary({ rows }) {
  const totalRows = rows.length;
  const paidRevenue = rows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const paidRows = rows.filter(
    (row) => String(getPaymentStatus(row)).toLowerCase() === "paid"
  ).length;
  const pendingRows = rows.filter(
    (row) => String(getPaymentStatus(row)).toLowerCase() === "pending"
  ).length;

  return (
    <div className="reports-summary-grid">
      <div className="reports-summary-card">
        <span>
          <ClipboardList size={15} /> Total Records
        </span>
        <strong>{totalRows}</strong>
      </div>

      <div className="reports-summary-card">
        <span>
          <Banknote size={15} /> Paid Revenue
        </span>
        <strong>{money(paidRevenue)}</strong>
      </div>

      <div className="reports-summary-card">
        <span>
          <ReceiptText size={15} /> Total Amount
        </span>
        <strong>{money(totalAmount)}</strong>
      </div>

      <div className="reports-summary-card">
        <span>
          <CheckCircle2 size={15} /> Paid / Pending
        </span>
        <strong>
          {paidRows} / {pendingRows}
        </strong>
      </div>
    </div>
  );
}

export default function AdminReports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState({
    publicWorkshopRows: [],
    privateWorkshopRows: [],
    privateEventRows: [],
  });

  const loadData = async (dateParams = {}) => {
    try {
      setLoading(true);
      setError("");

      const res = await adminApi.get("/admin/admin-reports.php", {
        params: dateParams,
      });

      const payload = res?.data || {};

      setData({
        publicWorkshopRows: Array.isArray(payload.publicWorkshopRows)
          ? payload.publicWorkshopRows
          : [],
        privateWorkshopRows: Array.isArray(payload.privateWorkshopRows)
          ? payload.privateWorkshopRows
          : [],
        privateEventRows: Array.isArray(payload.privateEventRows)
          ? payload.privateEventRows
          : [],
      });
    } catch (err) {
      console.error("Reports load error:", err);

      setError("Failed to load reports.");
      setData({
        publicWorkshopRows: [],
        privateWorkshopRows: [],
        privateEventRows: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeRows = useMemo(() => getActiveRows(data, tab), [data, tab]);

  const applyFilters = (e) => {
    e.preventDefault();

    if (from && to && from > to) {
      setError("The From date cannot be later than the To date.");
      return;
    }

    loadData({ from, to });
  };

  const clearFilters = () => {
    setFrom("");
    setTo("");
    loadData({});
  };

  const tabs = [
    { id: "public", label: "Public Workshops", icon: GraduationCap },
    { id: "private-workshop", label: "Private Workshops", icon: ClipboardList },
    { id: "private-event", label: "Private Events", icon: PartyPopper },
  ];

  return (
    <AdminLayout title="Sales Reports">
      {error && (
        <div className="admin-notice-react bad reports-notice" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-panel-react reports-filter-panel">
        <h3 className="reports-panel-title">
          <Filter size={18} /> Sales Date Filter
        </h3>

        <form onSubmit={applyFilters} className="reports-filter-form">
          <div className="reports-filter-field">
            <label className="admin-muted-react">
              <CalendarDays size={14} /> From
            </label>
            <input
              className="admin-input-react"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div className="reports-filter-field">
            <label className="admin-muted-react">
              <CalendarDays size={14} /> To
            </label>
            <input
              className="admin-input-react"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <button
            className="admin-pill-react reports-filter-button"
            type="submit"
            disabled={loading}
          >
            <Filter size={16} />
            {loading ? "Loading..." : "Apply"}
          </button>

          {(from || to) && (
            <button
              className="admin-pill-react reports-filter-button reports-clear-button"
              type="button"
              onClick={clearFilters}
              disabled={loading}
            >
              <X size={16} /> Clear
            </button>
          )}
        </form>
      </div>

      <div className="admin-panel-react reports-main-panel">
        <div className="admin-tabs-react reports-tabs">
          {tabs.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                className={`admin-tab-react ${tab === item.id ? "active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>

        <ReportSummary rows={activeRows} />

        {loading ? (
          <div className="admin-muted-react reports-loading">
            <Clock3 size={17} />
            Loading report data...
          </div>
        ) : activeRows.length === 0 ? (
          <div className="reports-empty-state">
            <ClipboardList size={40} />
            <strong>No report records found.</strong>
            <span>Try another date range or add new paid transactions.</span>
          </div>
        ) : (
          <div className="admin-table-scroll-wrap reports-table-wrap">
            <table className="admin-table-react reports-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Workshop/Event</th>
                  <th>Customer</th>
                  <th>Time</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Payment</th>
                  <th>Reference</th>
                </tr>
              </thead>

              <tbody>
                {activeRows.map((row, index) => {
                  const paymentStatus = getPaymentStatus(row);

                  return (
                    <tr key={row.report_key || row.id || row.reg_id || index}>
                      <td data-label="Date" className="reports-date-cell">
                        <CalendarDays size={14} />
                        <span>{row.workshop_date || row.booking_date || "—"}</span>
                      </td>

                      <td data-label="Workshop/Event">
                        <strong className="reports-title-cell">
                          {getTitle(row, tab)}
                        </strong>

                        {tab === "private-workshop" && (
                          <span className="reports-sub-cell">
                            Standard: {getNotesValue(row, ["standard_attendees"], 0)} •
                            Premium: {getNotesValue(row, ["premium_attendees"], 0)}
                          </span>
                        )}

                        {tab === "private-event" && (
                          <span className="reports-sub-cell">
                            Cups: {getNotesValue(row, ["cup_quantity"], "—")} •
                            Package: {getNotesValue(row, ["menu_package"], "—")}
                          </span>
                        )}

                        {tab === "public" && row.package && (
                          <span className="reports-sub-cell">{row.package} Package</span>
                        )}
                      </td>

                      <td data-label="Customer">
                        <span className="reports-icon-text">
                          <UserRound size={14} />
                          {getCustomer(row)}
                        </span>
                      </td>

                      <td data-label="Time">
                        <span className="reports-icon-text">
                          <Clock3 size={14} />
                          {formatTimeRange(row.start_time, row.end_time)}
                        </span>
                      </td>

                      <td data-label="Amount" className="reports-amount-cell">
                        {money(getAmount(row))}
                      </td>

                      <td data-label="Payment">
                        <span className={`pill-mini-react ${paymentBadgeClass(paymentStatus)}`}>
                          {readableStatus(paymentStatus)}
                        </span>
                      </td>

                      <td data-label="Reference" className="reports-reference-cell">
                        {row.paid_reference_no || row.reference_no || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}