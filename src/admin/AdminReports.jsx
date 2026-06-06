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

const TABS = [
  { id: "public", label: "Public Workshops", icon: GraduationCap },
  { id: "private-workshop", label: "Private Workshops", icon: ClipboardList },
  { id: "private-event", label: "Private Events", icon: PartyPopper },
];

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
  const paidRevenue = rows.reduce(
    (sum, row) => sum + Number(row.paid_amount || 0),
    0
  );
  const totalAmount = rows.reduce(
    (sum, row) => sum + Number(row.total_amount || 0),
    0
  );
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
  const [loadStatus, setLoadStatus] = useState("loading");
  const [error, setError] = useState("");

  const loading = loadStatus === "loading";

  const [data, setData] = useState({
    publicWorkshopRows: [],
    privateWorkshopRows: [],
    privateEventRows: [],
  });

  const fetchReportData = async (dateParams = {}) => {
    try {
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
      setLoadStatus("loaded");
    }
  };

  const loadData = async (dateParams = {}) => {
    setError("");
    setLoadStatus("loading");
    await fetchReportData(dateParams);
  };

  useEffect(() => {
    fetchReportData();
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
            <label className="admin-muted-react" htmlFor="reports-from-date">
              <CalendarDays size={14} /> From
            </label>

            <input
              id="reports-from-date"
              className="admin-input-react"
              type="date"
              aria-label="From date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div className="reports-filter-field">
            <label className="admin-muted-react" htmlFor="reports-to-date">
              <CalendarDays size={14} /> To
            </label>

            <input
              id="reports-to-date"
              className="admin-input-react"
              type="date"
              aria-label="To date"
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
            {loading ? "Loading…" : "Apply"}
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
          {TABS.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                className={`admin-tab-react ${tab === item.id ? "active" : ""}`}
                onClick={() => setTab(item.id)}
                aria-label={item.label}
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
            Loading report data…
          </div>
        ) : activeRows.length === 0 ? (
          <div className="reports-empty-state">
            <ClipboardList size={40} />
            <strong>No report records found.</strong>
            <span>Try another date range or add new paid transactions.</span>
          </div>
        ) : (
          <div className="reports-grid-wrap">
            <div className="reports-grid-table" role="table" aria-label="Sales report table">
              <div className="reports-grid-head" role="row">
                <div role="columnheader">Date</div>
                <div role="columnheader">Workshop/Event</div>
                <div role="columnheader">Customer</div>
                <div role="columnheader">Time</div>
                <div role="columnheader" className="reports-align-right">
                  Amount
                </div>
                <div role="columnheader">Payment</div>
                <div role="columnheader">Reference</div>
              </div>

              <div className="reports-grid-body" role="rowgroup">
                {activeRows.map((row, index) => {
                  const paymentStatus = getPaymentStatus(row);
                  const date = row.workshop_date || row.booking_date || "—";
                  const title = getTitle(row, tab);
                  const customer = getCustomer(row);
                  const time = formatTimeRange(row.start_time, row.end_time);
                  const amount = money(getAmount(row));
                  const reference = row.paid_reference_no || row.reference_no || "—";

                  return (
                    <div
                      className="reports-grid-row"
                      role="row"
                      key={row.report_key || row.id || row.reg_id || index}
                    >
                      <div
                        className="reports-grid-cell reports-date-cell"
                        role="cell"
                        data-label="Date"
                      >
                        <CalendarDays size={14} />
                        <span>{date}</span>
                      </div>

                      <div
                        className="reports-grid-cell reports-event-cell"
                        role="cell"
                        data-label="Workshop/Event"
                      >
                        <strong className="reports-title-cell">{title}</strong>

                        {tab === "private-workshop" && (
                          <span className="reports-sub-cell">
                            Standard:{" "}
                            {getNotesValue(row, ["standard_attendees"], 0)} •
                            Premium:{" "}
                            {getNotesValue(row, ["premium_attendees"], 0)}
                          </span>
                        )}

                        {tab === "private-event" && (
                          <span className="reports-sub-cell">
                            Cups: {getNotesValue(row, ["cup_quantity"], "—")} •
                            Package: {getNotesValue(row, ["menu_package"], "—")}
                          </span>
                        )}

                        {tab === "public" && row.package && (
                          <span className="reports-sub-cell">
                            {row.package} Package
                          </span>
                        )}
                      </div>

                      <div
                        className="reports-grid-cell reports-customer-cell"
                        role="cell"
                        data-label="Customer"
                      >
                        <span className="reports-icon-text">
                          <UserRound size={14} />
                          <span>{customer}</span>
                        </span>
                      </div>

                      <div
                        className="reports-grid-cell reports-time-cell"
                        role="cell"
                        data-label="Time"
                      >
                        <span className="reports-icon-text">
                          <Clock3 size={14} />
                          <span>{time}</span>
                        </span>
                      </div>

                      <div
                        className="reports-grid-cell reports-amount-cell"
                        role="cell"
                        data-label="Amount"
                      >
                        {amount}
                      </div>

                      <div
                        className="reports-grid-cell reports-payment-cell"
                        role="cell"
                        data-label="Payment"
                      >
                        <span
                          className={`pill-mini-react ${paymentBadgeClass(
                            paymentStatus
                          )}`}
                        >
                          {readableStatus(paymentStatus)}
                        </span>
                      </div>

                      <div
                        className="reports-grid-cell reports-reference-cell"
                        role="cell"
                        data-label="Reference"
                      >
                        {reference}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}