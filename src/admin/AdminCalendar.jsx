import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Landmark,
  Lock,
  PartyPopper,
  RefreshCw,
  Save,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "@/assets/css/admin-calendar.css";

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusBadgeClass(status) {
  const s = String(status || "pending").toLowerCase();

  if (["approved", "completed", "complete", "active"].includes(s)) return "paid";
  if (["cancelled", "rejected", "hidden"].includes(s)) return "rejected";

  return "pending";
}

function paymentBadgeClass(status) {
  const s = String(status || "unpaid").toLowerCase();

  if (["paid", "partial"].includes(s)) return "paid";
  if (["rejected", "cancelled"].includes(s)) return "rejected";

  return "pending";
}

function isCancelRequested(record) {
  return Number(record.cancel_requested) === 1 || record.cancel_requested === true;
}

function formatTime(time) {
  if (!time) return "";
  return String(time).slice(0, 5);
}

function formatTimeRange(start, end) {
  const startText = formatTime(start);
  const endText = formatTime(end);

  if (!startText && !endText) return "No time set";
  if (startText && !endText) return startText;

  return `${startText} - ${endText}`;
}

function normalizeType(type = "") {
  const value = String(type || "").toLowerCase();

  if (value === "event") return "event_booking";
  if (value === "workshop") return "private_workshop";

  return value;
}

function getScheduleGroup(record) {
  const type = normalizeType(record.calendar_type || record.booking_type);

  if (type === "event_booking") return "event_booking";
  if (type === "private_workshop") return "private_workshop";
  if (type === "public_workshop") return "public_workshop";
  if (type === "custom") return "private_workshop";

  return "other";
}

function readableType(record) {
  const type = getScheduleGroup(record);

  if (type === "event_booking") return "Event Booking";
  if (type === "private_workshop") return "Private Workshop";
  if (type === "public_workshop") return "Public Workshop";

  return String(record.booking_type || "Schedule")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRecordTitle(record) {
  const notes = record.notes_decoded || {};

  if (record.record_kind === "public_workshop") {
    return record.title || "Public Workshop";
  }

  if (getScheduleGroup(record) === "event_booking") {
    return notes.event_name || notes.event_type || "Event Booking";
  }

  if (getScheduleGroup(record) === "private_workshop") {
    return notes.workshop_location || notes.location || "Private Workshop";
  }

  return "Booking";
}

function isUpcoming(record, today) {
  const date = String(record.booking_date || "");
  const status = String(record.status || "").toLowerCase();

  return (
    date >= today &&
    ["pending_payment", "pending", "approved", "active"].includes(status)
  );
}

function isNeedsReview(record) {
  const status = String(record.status || "").toLowerCase();
  const payment = String(record.payment_status || "").toLowerCase();

  return (
    status === "pending_payment" ||
    payment === "pending" ||
    isCancelRequested(record)
  );
}

function filterByStatus(record, statusFilter, today) {
  const status = String(record.status || "").toLowerCase();
  const payment = String(record.payment_status || "").toLowerCase();

  if (statusFilter === "all") return true;
  if (statusFilter === "upcoming") return isUpcoming(record, today);
  if (statusFilter === "pending_payment") {
    return status === "pending_payment" || payment === "pending";
  }
  if (statusFilter === "completed") {
    return ["completed", "complete"].includes(status);
  }
  if (statusFilter === "cancelled_rejected") {
    return ["cancelled", "rejected", "hidden"].includes(status);
  }
  if (statusFilter === "cancel_requests") {
    return isCancelRequested(record);
  }

  return status === statusFilter;
}

const MAIN_FILTERS = [
  { key: "all", label: "All Schedules", icon: CalendarDays },
  { key: "bookings", label: "Bookings", icon: FileText },
  { key: "public_workshops", label: "Public Workshops", icon: Landmark },
  { key: "needs_review", label: "Needs Review", icon: AlertTriangle },
  { key: "blocked_dates", label: "Blocked Dates", icon: CalendarX2 },
];

const STATUS_FILTERS = [
  { key: "all", label: "All statuses" },
  { key: "upcoming", label: "Upcoming" },
  { key: "pending_payment", label: "Pending payment" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "completed", label: "Completed" },
  { key: "cancelled_rejected", label: "Cancelled / Rejected" },
  { key: "cancel_requests", label: "Cancel requests" },
  { key: "active", label: "Active public workshops" },
  { key: "hidden", label: "Hidden public workshops" },
];

const TYPE_FILTERS = [
  { key: "all", label: "All types" },
  { key: "event_booking", label: "Event bookings" },
  { key: "private_workshop", label: "Private workshops" },
  { key: "public_workshop", label: "Public workshops" },
];

function CalendarDayCard({ date, records, blocked }) {
  const sortedRecords = [...records].sort((a, b) => {
    const aTime = String(a.start_time || "");
    const bTime = String(b.start_time || "");
    return aTime.localeCompare(bTime);
  });

  return (
    <article className="calendar-day-card">
      <div className="calendar-day-head">
        <div>
          <div className="calendar-day-title">
            <CalendarDays size={16} aria-hidden="true" />
            {date}
          </div>

          {blocked && (
            <div className="calendar-day-blocked">
              <CalendarX2 size={14} aria-hidden="true" />
              Blocked{blocked.reason ? `: ${blocked.reason}` : ""}
            </div>
          )}
        </div>

        <span className="pill-mini-react">
          {records.length} {records.length === 1 ? "record" : "records"}
        </span>
      </div>

      <div className="calendar-day-records">
        {sortedRecords.map((record) => {
          const key = `${record.record_kind || "booking"}-${record.id}`;
          const status = String(record.status || "pending").toLowerCase();
          const payment = String(record.payment_status || "unpaid").toLowerCase();
          const group = getScheduleGroup(record);

          return (
            <div className="calendar-record-card" key={key}>
              <div className="calendar-record-top">
                <div>
                  <div className="calendar-record-title">{getRecordTitle(record)}</div>

                  <div className="calendar-record-meta">
                    <span>
                      <Clock size={13} aria-hidden="true" />
                      {formatTimeRange(record.start_time, record.end_time)}
                    </span>

                    <span>{readableType(record)}</span>
                  </div>
                </div>

                <div className="calendar-badge-row">
                  <span className={`p-badge-react ${statusBadgeClass(status)}`}>
                    {status === "pending_payment" ? "AWAITING PAYMENT" : status.toUpperCase()}
                  </span>
                  <span className={`p-badge-react ${paymentBadgeClass(payment)}`}>
                    {payment.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="calendar-record-bottom">
                <div className="calendar-record-subtext">
                  {group === "public_workshop"
                    ? `${Number(record.registration_count || 0)} registrations`
                    : `${record.user_name || "Guest"}${record.user_email ? ` • ${record.user_email}` : ""}`}
                </div>

                {group === "public_workshop" ? (
                  <Link
                    className="admin-pill-react"
                    to={`/admin/workshops/edit/${Number(record.id || 0)}`}
                  >
                    <Eye size={14} aria-hidden="true" />
                    View Workshop
                  </Link>
                ) : (
                  <Link className="admin-pill-react" to="/admin/reservations">
                    <Eye size={14} aria-hidden="true" />
                    View Reservation
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function AdminCalendar() {
  const [csrf, setCsrf] = useState("");
  const [blockedDates, setBlockedDates] = useState([]);
  const [records, setRecords] = useState([]);

  const [mainFilter, setMainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingDate, setDeletingDate] = useState("");

  const [form, setForm] = useState({
    block_date: "",
    reason: "",
    block_mode: "full_day",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setErr("");

      const { data } = await adminApi.get("/admin/admin-calendar.php");

      if (data.error) {
        setErr(data.error);
        return;
      }

      setBlockedDates(Array.isArray(data.blockedDates) ? data.blockedDates : []);
      setRecords(
        Array.isArray(data.calendarItems)
          ? data.calendarItems
          : Array.isArray(data.bookings)
          ? data.bookings
          : []
      );
      setCsrf(data.csrf || "");
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load calendar data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const blockedByDate = useMemo(() => {
    const map = {};
    blockedDates.forEach((item) => {
      if (item.block_date) {
        map[item.block_date] = item;
      }
    });
    return map;
  }, [blockedDates]);

  const mainCounts = useMemo(() => {
    return {
      all: records.length,
      bookings: records.filter((record) => getScheduleGroup(record) !== "public_workshop").length,
      public_workshops: records.filter((record) => getScheduleGroup(record) === "public_workshop").length,
      needs_review: records.filter(isNeedsReview).length,
      blocked_dates: blockedDates.length,
    };
  }, [records, blockedDates]);

  const filteredRecords = useMemo(() => {
    let next = [...records];

    if (mainFilter === "bookings") {
      next = next.filter((record) => getScheduleGroup(record) !== "public_workshop");
    } else if (mainFilter === "public_workshops") {
      next = next.filter((record) => getScheduleGroup(record) === "public_workshop");
    } else if (mainFilter === "needs_review") {
      next = next.filter(isNeedsReview);
    } else if (mainFilter === "blocked_dates") {
      next = next.filter((record) => Boolean(blockedByDate[record.booking_date]));
    }

    if (typeFilter !== "all") {
      next = next.filter((record) => getScheduleGroup(record) === typeFilter);
    }

    if (statusFilter !== "all") {
      next = next.filter((record) => filterByStatus(record, statusFilter, today));
    }

    return next.sort((a, b) => {
      const dateA = `${a.booking_date || ""} ${a.start_time || ""}`;
      const dateB = `${b.booking_date || ""} ${b.start_time || ""}`;

      return dateB.localeCompare(dateA);
    });
  }, [records, mainFilter, typeFilter, statusFilter, blockedByDate, today]);

  const groupedRecords = useMemo(() => {
    const grouped = {};

    filteredRecords.forEach((record) => {
      const date = record.booking_date || "No date";
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(record);
    });

    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredRecords]);

  const blockedRows = useMemo(() => {
    if (mainFilter !== "blocked_dates") return blockedDates;

    return blockedDates.filter((item) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "upcoming") return String(item.block_date || "") >= today;

      return true;
    });
  }, [blockedDates, mainFilter, statusFilter, today]);

  const saveBlockedDate = async (force = false) => {
    const { data } = await adminApi.post("/admin/admin-calendar.php", {
      action: "add_block",
      csrf_token: csrf,
      block_date: form.block_date,
      reason: form.reason.trim(),
      block_mode: form.block_mode,
      force,
    });

    return data;
  };

  const handleSave = async (e) => {
    e.preventDefault();

    setMsg("");
    setErr("");

    if (!form.block_date) {
      setErr("Please choose a date to block.");
      return;
    }

    if (form.block_mode !== "full_day") {
      setErr("Partial time blocking is planned, but this database currently supports full-day blocking only.");
      return;
    }

    try {
      setSaving(true);

      let data = await saveBlockedDate(false);

      if (data.requires_confirmation) {
        const confirmed = window.confirm(
          `${data.message}\n\nActive bookings: ${Number(data.active_booking_count || 0)}\nPublic workshops: ${Number(data.public_workshop_count || 0)}\n\nContinue blocking this full day?`
        );

        if (!confirmed) {
          setErr("Blocked date was not saved.");
          return;
        }

        data = await saveBlockedDate(true);
      }

      if (data.error) {
        setErr(data.error);
        return;
      }

      setMsg(data.message || "Blocked date saved.");
      setForm({ block_date: "", reason: "", block_mode: "full_day" });

      await loadData();
    } catch (e) {
      const response = e.response?.data;

      if (response?.requires_confirmation) {
        const confirmed = window.confirm(
          `${response.message}\n\nActive bookings: ${Number(response.active_booking_count || 0)}\nPublic workshops: ${Number(response.public_workshop_count || 0)}\n\nContinue blocking this full day?`
        );

        if (!confirmed) {
          setErr("Blocked date was not saved.");
          return;
        }

        try {
          const retry = await saveBlockedDate(true);

          if (retry.error) {
            setErr(retry.error);
            return;
          }

          setMsg(retry.message || "Blocked date saved.");
          setForm({ block_date: "", reason: "", block_mode: "full_day" });
          await loadData();
        } catch (retryError) {
          setErr(retryError.response?.data?.error || "Failed to save blocked date.");
        }
      } else {
        setErr(response?.error || "Failed to save blocked date.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (blockDate) => {
    if (!window.confirm("Remove this blocked date?")) return;

    setMsg("");
    setErr("");

    try {
      setDeletingDate(blockDate);

      const { data } = await adminApi.post("/admin/admin-calendar.php", {
        action: "delete_block",
        csrf_token: csrf,
        block_date: blockDate,
      });

      if (data.error) {
        setErr(data.error);
        return;
      }

      setMsg(data.message || "Blocked date removed.");

      await loadData();
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to remove blocked date.");
    } finally {
      setDeletingDate("");
    }
  };

  const totalBlockedWithSchedules = blockedDates.filter(
    (item) => Number(item.active_booking_count || 0) + Number(item.public_workshop_count || 0) > 0
  ).length;

  return (
    <AdminLayout title="Calendar Management">
      <div className="admin-calendar-page">
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

        <div className="calendar-summary-grid">
          <div className="admin-card-react admin-card-feature-react">
            <div className="admin-card-label-react">
              <CalendarDays size={14} aria-hidden="true" />
              <span>Calendar Records</span>
            </div>
            <h4>Total Schedules</h4>
            <div className="admin-big-react">{loading ? "..." : records.length}</div>
            <div className="admin-muted-react">Bookings and public workshops</div>
          </div>

          <div className="admin-card-react admin-card-feature-react">
            <div className="admin-card-label-react">
              <Lock size={14} aria-hidden="true" />
              <span>Blocked Dates</span>
            </div>
            <h4>Unavailable Days</h4>
            <div className="admin-big-react">{loading ? "..." : blockedDates.length}</div>
            <div className="admin-muted-react">Full-day blocks</div>
          </div>

          <div className="admin-card-react admin-card-feature-react">
            <div className="admin-card-label-react">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>Needs Attention</span>
            </div>
            <h4>Blocked With Schedules</h4>
            <div className="admin-big-react">{loading ? "..." : totalBlockedWithSchedules}</div>
            <div className="admin-muted-react">Blocked dates that still have active schedules</div>
          </div>
        </div>

        <div className="admin-panel-react">
          <h3 className="calendar-section-title">
            <CalendarX2 size={18} aria-hidden="true" />
            Block Dates
          </h3>

          <p className="admin-muted-react">
            Use this to block days that should not be available for new bookings. Partial time blocking is shown as a planned option, but the current database stores full-day blocked dates only.
          </p>

          <form onSubmit={handleSave} className="calendar-block-form-react">
            <div className="calendar-block-grid-react">
              <div className="calendar-block-field-react">
                <label className="calendar-block-label-react" htmlFor="block-date">
                  Block Date
                </label>

                <input
                  id="block-date"
                  className="admin-input-react"
                  type="date"
                  required
                  value={form.block_date}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      block_date: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="calendar-block-field-react">
                <label className="calendar-block-label-react" htmlFor="block-mode">
                  Block Mode
                </label>

                <select
                  id="block-mode"
                  className="admin-input-react"
                  value={form.block_mode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      block_mode: e.target.value,
                    }))
                  }
                >
                  <option value="full_day">Block full day</option>
                  <option value="time_range">Block specific time range - planned</option>
                </select>
              </div>

              <div className="calendar-block-field-react">
                <label className="calendar-block-label-react" htmlFor="block-reason">
                  Reason
                </label>

                <input
                  id="block-reason"
                  className="admin-input-react"
                  type="text"
                  placeholder="Holiday / fully booked / maintenance"
                  value={form.reason}
                  maxLength={255}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="calendar-block-action-react">
                <button
                  className="admin-btn-react admin-btn-approve-react"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? <RefreshCw size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
                  {saving ? "SAVING..." : "SAVE"}
                </button>
              </div>
            </div>
          </form>

          {loading ? (
            <div className="admin-muted-react">Loading blocked dates...</div>
          ) : blockedDates.length === 0 ? (
            <div className="admin-muted-react">No blocked dates yet.</div>
          ) : (
            <div className="calendar-table-scroll">
              <table className="admin-table-react calendar-blocked-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reason</th>
                    <th>Active Schedules</th>
                    <th>Remove</th>
                  </tr>
                </thead>

                <tbody>
                  {blockedRows.map((b) => {
                    const activeSchedules = Number(b.active_booking_count || 0) + Number(b.public_workshop_count || 0);

                    return (
                      <tr key={b.block_date}>
                        <td className="calendar-strong-cell">{b.block_date}</td>
                        <td>{b.reason || "No reason provided"}</td>
                        <td>
                          {activeSchedules > 0 ? (
                            <span className="p-badge-react rejected calendar-warn-badge">
                              {activeSchedules} active
                            </span>
                          ) : (
                            <span className="p-badge-react paid">Clear</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="admin-btn-react admin-btn-cancel-react"
                            type="button"
                            disabled={deletingDate === b.block_date}
                            onClick={() => handleDelete(b.block_date)}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                            {deletingDate === b.block_date ? "REMOVING..." : "REMOVE"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-panel-react calendar-panel-flat">
          <div className="calendar-panel-head">
            <h3>
              <CalendarDays size={18} aria-hidden="true" />
              Calendar Overview
            </h3>

            <p>
              View bookings and public workshops by date. Pending payment records are included because they still hold schedule space.
            </p>
          </div>

          <div className="calendar-filter-area">
            <div className="calendar-main-filters">
              {MAIN_FILTERS.map((filter) => {
                const active = mainFilter === filter.key;
                const Icon = filter.icon;

                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setMainFilter(filter.key)}
                    className={`calendar-filter-pill ${active ? "active" : ""}`}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {filter.label} ({mainCounts[filter.key] || 0})
                  </button>
                );
              })}
            </div>

            <div className="calendar-dropdown-filters">
              <label>
                <span>Type</span>
                <select
                  className="admin-input-react"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  {TYPE_FILTERS.map((item) => (
                    <option value={item.key} key={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Status</span>
                <select
                  className="admin-input-react"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_FILTERS.map((item) => (
                    <option value={item.key} key={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="admin-muted-react calendar-state-pad">
              Loading calendar overview...
            </div>
          ) : groupedRecords.length === 0 ? (
            <div className="admin-muted-react calendar-state-pad">
              No records found for the selected filters.
            </div>
          ) : (
            <div className="calendar-day-grid">
              {groupedRecords.map(([date, dayRecords]) => (
                <CalendarDayCard
                  key={date}
                  date={date}
                  records={dayRecords}
                  blocked={blockedByDate[date]}
                />
              ))}
            </div>
          )}
        </div>

        <div className="admin-panel-react calendar-panel-flat">
          <div className="calendar-panel-head">
            <h3>
              <FileText size={18} aria-hidden="true" />
              Detailed Schedule Table
            </h3>

            <p>
              Use this table when you need to scan exact IDs, customer details, payments, and action links.
            </p>
          </div>

          {loading ? (
            <div className="admin-muted-react calendar-state-pad">
              Loading detailed records...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="admin-muted-react calendar-state-pad">
              No records found for the selected filters.
            </div>
          ) : (
            <div className="calendar-table-scroll">
              <table className="admin-table-react rich-table calendar-detail-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Customer / Record</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Cancel Request</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map((record) => {
                    const status = String(record.status || "pending").toLowerCase();
                    const payment = String(record.payment_status || "unpaid").toLowerCase();
                    const cancelRequested = isCancelRequested(record);
                    const isPublicWorkshop = record.record_kind === "public_workshop";
                    const rowKey = `${record.record_kind || "booking"}-${record.id}`;

                    return (
                      <tr key={rowKey}>
                        <td className="calendar-strong-cell">#{record.id}</td>

                        <td style={{ fontWeight: 800 }}>{record.booking_date}</td>

                        <td>{formatTimeRange(record.start_time, record.end_time)}</td>

                        <td style={{ fontWeight: 800 }}>{readableType(record)}</td>

                        <td>
                          <div className="calendar-record-person">
                            {isPublicWorkshop ? (
                              <Users size={16} aria-hidden="true" />
                            ) : (
                              <UserRound size={16} aria-hidden="true" />
                            )}
                            <div>
                              <div className="calendar-record-person-name">
                                {isPublicWorkshop ? getRecordTitle(record) : record.user_name || "Guest"}
                              </div>
                              <div className="calendar-record-person-sub">
                                {isPublicWorkshop
                                  ? `${Number(record.registration_count || 0)} registrations`
                                  : record.user_email || "No email"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className={`p-badge-react ${statusBadgeClass(status)}`}>
                            {status === "pending_payment" ? "AWAITING PAYMENT" : status.toUpperCase()}
                          </span>
                        </td>

                        <td>
                          <span className={`p-badge-react ${paymentBadgeClass(payment)}`}>
                            {payment.toUpperCase()}
                          </span>
                        </td>

                        <td style={{ fontWeight: 800 }}>₱{money(record.total_amount)}</td>

                        <td>
                          {cancelRequested ? (
                            <div className="calendar-cancel-box">
                              <div className="calendar-cancel-title">
                                <AlertTriangle size={14} aria-hidden="true" />
                                Requested
                              </div>

                              <div className="calendar-cancel-reason">
                                {record.cancel_reason || "No reason provided."}
                              </div>

                              {record.cancel_requested_at && (
                                <div className="calendar-cancel-date">
                                  {record.cancel_requested_at}
                                </div>
                              )}

                              <Link
                                className="admin-pill-react"
                                to="/admin/reservations"
                              >
                                <Eye size={13} aria-hidden="true" />
                                Review in Reservations
                              </Link>
                            </div>
                          ) : (
                            <span className="admin-muted-react">None</span>
                          )}
                        </td>

                        <td>
                          {isPublicWorkshop ? (
                            <Link
                              className="admin-pill-react"
                              to={`/admin/workshops/edit/${Number(record.id || 0)}`}
                            >
                              <Eye size={14} aria-hidden="true" />
                              View Workshop
                            </Link>
                          ) : (
                            <Link className="admin-pill-react" to="/admin/reservations">
                              <Eye size={14} aria-hidden="true" />
                              View Reservation
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
