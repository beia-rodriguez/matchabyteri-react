import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

function formatTimeRange(start, end) {
  if (!start || !end) return "";
  const formatOne = (value) => {
    const d = new Date(`1970-01-01T${value}`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };
  return `${formatOne(start)} - ${formatOne(end)}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function money(value) {
  return `₱${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

  const loadData = async (params = {}) => {
    try {
      setLoading(true);
      setError("");

      const res = await adminApi.get("/admin/admin-reports.php", { params });
      const payload = res?.data || {};

      setData({
        publicWorkshopRows: Array.isArray(payload.publicWorkshopRows) ? payload.publicWorkshopRows : [],
        privateWorkshopRows: Array.isArray(payload.privateWorkshopRows) ? payload.privateWorkshopRows : [],
        privateEventRows: Array.isArray(payload.privateEventRows) ? payload.privateEventRows : [],
      });
    } catch (err) {
      console.error("Reports fetch error:", err);
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

  const applyFilters = async (e) => {
    e.preventDefault();
    loadData({ from, to });
  };

  const clearFilters = async () => {
    setFrom("");
    setTo("");
    loadData({});
  };

  return (
    <AdminLayout title="Sales Reports">
      <div className="admin-panel-react">
        <h3>Filters</h3>

        <form onSubmit={applyFilters} className="admin-form-row-react">
          <div>
            <label className="admin-muted-react" style={{ display: "block", marginBottom: 6 }}>
              From
            </label>
            <input
              className="admin-input-react"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="admin-muted-react" style={{ display: "block", marginBottom: 6 }}>
              To
            </label>
            <input
              className="admin-input-react"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <button className="admin-pill-react" type="submit">
            Apply
          </button>

          {(from !== "" || to !== "") && (
            <button className="admin-pill-react" type="button" onClick={clearFilters}>
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="admin-panel-react">
        <h3>Reports</h3>

        {loading && <div className="admin-muted-react">Loading reports...</div>}
        {error && <div className="admin-notice-react bad">{error}</div>}

        <div className="admin-tabs-react">
          <button
            className={`admin-tab-react ${tab === "public" ? "active" : ""}`}
            type="button"
            onClick={() => setTab("public")}
          >
            Public Workshops
          </button>

          <button
            className={`admin-tab-react ${tab === "private-workshop" ? "active" : ""}`}
            type="button"
            onClick={() => setTab("private-workshop")}
          >
            Private Workshops
          </button>

          <button
            className={`admin-tab-react ${tab === "private-event" ? "active" : ""}`}
            type="button"
            onClick={() => setTab("private-event")}
          >
            Private Events
          </button>
        </div>

        <div className={`admin-section-react ${tab === "public" ? "show" : ""}`}>
          {!data.publicWorkshopRows.length ? (
            <div className="admin-muted-react">No public workshop registrations found.</div>
          ) : (
            <table className="admin-table-react">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Workshop</th>
                  <th>Package</th>
                  <th>Location</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Time</th>
                  <th>Amount</th>
                  <th>Registered At</th>
                </tr>
              </thead>
              <tbody>
                {data.publicWorkshopRows.map((r) => {
                  const pkg = String(r.package || "STANDARD").toUpperCase();
                  const amt = pkg === "PREMIUM"
                    ? Number(r.premium_price || 0)
                    : Number(r.standard_price || 0);

                  const time = formatTimeRange(r.start_time, r.end_time);

                  return (
                    <tr key={r.reg_id}>
                      <td>{r.workshop_date || ""}</td>
                      <td>{r.title || "Workshop"}</td>
                      <td>{pkg}</td>
                      <td>{r.location || ""}</td>
                      <td>{r.full_name || ""}</td>
                      <td>{r.email || ""}</td>
                      <td>{r.phone_number || ""}</td>
                      <td>{time}</td>
                      <td>{money(amt)}</td>
                      <td>{formatDateTime(r.registered_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className={`admin-section-react ${tab === "private-workshop" ? "show" : ""}`}>
          {!data.privateWorkshopRows.length ? (
            <div className="admin-muted-react">No private workshop bookings found.</div>
          ) : (
            <table className="admin-table-react">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Workshop</th>
                  <th>Location</th>
                  <th>Attendees</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Time</th>
                  <th>Paid Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.privateWorkshopRows.map((r) => {
                  const notes = r.notes_decoded || {};
                  const time = formatTimeRange(r.start_time, r.end_time);

                  return (
                    <tr key={r.id}>
                      <td>{r.booking_date || ""}</td>
                      <td>{notes.workshop_type || "Workshop"}</td>
                      <td>{notes.location || "-"}</td>
                      <td>{notes.attendees || "-"}</td>
                      <td>{r.status || ""}</td>
                      <td>{notes.full_name || r.user_name || "Guest"}</td>
                      <td>{notes.email || r.user_email || ""}</td>
                      <td>{time}</td>
                      <td>{money(r.paid_amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className={`admin-section-react ${tab === "private-event" ? "show" : ""}`}>
          {!data.privateEventRows.length ? (
            <div className="admin-muted-react">No private event bookings found.</div>
          ) : (
            <table className="admin-table-react">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event Name</th>
                  <th>Purpose</th>
                  <th>Location</th>
                  <th>Guests</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Time</th>
                  <th>Ref #</th>
                  <th>Paid Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.privateEventRows.map((r) => {
                  const notes = r.notes_decoded || {};
                  const time = formatTimeRange(r.start_time, r.end_time);
                  const ref = (r.paid_reference_no || "").trim() || "—";

                  return (
                    <tr key={r.id}>
                      <td>{r.booking_date || ""}</td>
                      <td>{notes.event_name || "—"}</td>
                      <td>{notes.event_type || "—"}</td>
                      <td>{notes.location || "—"}</td>
                      <td>{notes.guests || "—"}</td>
                      <td>{r.status || ""}</td>
                      <td>{notes.full_name || r.user_name || "Guest"}</td>
                      <td>{notes.email || r.user_email || ""}</td>
                      <td>{time}</td>
                      <td>{ref}</td>
                      <td>{money(r.paid_amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}