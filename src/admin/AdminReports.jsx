import { useEffect, useState } from "react";
import { Filter, X } from "lucide-react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

// --- HELPER FUNCTIONS ---
function money(value) {
  return `₱${Number(value || 0).toLocaleString(undefined, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

function formatTimeRange(start, end) {
  if (!start || !end) return "—";
  const formatOne = (value) => {
    const [h, m] = value.split(":");
    const hInt = parseInt(h);
    const ampm = hInt >= 12 ? "PM" : "AM";
    return `${hInt % 12 || 12}:${m} ${ampm}`;
  };
  return `${formatOne(start)} - ${formatOne(end)}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { 
    year: 'numeric', month: 'short', day: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  });
}

function getFieldAnswer(row, labelIncludes) {
  const snapshot = row.form_snapshot_decoded || {};
  const answers = row.dynamic_answers || {};
  const search = String(labelIncludes || "").toLowerCase();

  for (const section of snapshot.sections || []) {
    for (const field of section.fields || []) {
      const label = String(field.label || "").toLowerCase();
      if (!label.includes(search)) continue;

      const rawValue = answers[field.field_name];
      const options = field.options || [];

      if (Array.isArray(rawValue)) {
        return rawValue
          .map((v) => {
            const opt = options.find((o) => String(o.id) === String(v));
            return opt?.label || v;
          })
          .join(", ");
      }
      const opt = options.find((o) => String(o.id) === String(rawValue));
      return opt?.label || rawValue || "—";
    }
  }
  return "—";
}

function paymentBadgeClass(status) {
  const s = String(status || "unpaid").toLowerCase();
  if (s === "paid" || s === "partial") return "paid";
  if (s === "pending") return "pending";
  return "rejected";
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

      const res = await adminApi.get("/admin/admin-reports.php", { params: dateParams });
      const payload = res?.data || {};

      setData({
        publicWorkshopRows: Array.isArray(payload.publicWorkshopRows) ? payload.publicWorkshopRows : [],
        privateWorkshopRows: Array.isArray(payload.privateWorkshopRows) ? payload.privateWorkshopRows : [],
        privateEventRows: Array.isArray(payload.privateEventRows) ? payload.privateEventRows : [],
      });
    } catch (err) {
      setError("Failed to load reports.");
      setData({ publicWorkshopRows: [], privateWorkshopRows: [], privateEventRows: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const applyFilters = (e) => {
    e.preventDefault();
    loadData({ from, to });
  };

  const clearFilters = () => {
    setFrom("");
    setTo("");
    loadData({});
  };

  return (
    <AdminLayout title="Sales Reports">
      {error && <div className="admin-notice-react bad">{error}</div>}

      {/* --- FILTERS --- */}
      <div className="admin-panel-react">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--green-2)' }}>
          <Filter size={18} /> Sales Date Filter
        </h3>
        <form onSubmit={applyFilters} className="admin-form-row-react" style={{ gridTemplateColumns: '1fr 1fr auto auto', alignItems: 'end' }}>
          <div>
            <label className="admin-muted-react" style={{ marginBottom: 6, display: 'block' }}>From</label>
            <input className="admin-input-react" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="admin-muted-react" style={{ marginBottom: 6, display: 'block' }}>To</label>
            <input className="admin-input-react" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="admin-pill-react" type="submit" style={{ background: 'var(--green-2)', color: '#fff' }}>Apply</button>
          {(from || to) && (
            <button className="admin-pill-react" type="button" onClick={clearFilters}><X size={16} /> Clear</button>
          )}
        </form>
      </div>

      {/* --- REPORTS TABLE --- */}
      <div className="admin-panel-react">
        <div className="admin-tabs-react" style={{ marginBottom: '20px' }}>
          {[{id: 'public', label: 'Public Workshops'}, {id: 'private-workshop', label: 'Private Workshops'}, {id: 'private-event', label: 'Private Events'}].map(t => (
            <button key={t.id} className={`admin-tab-react ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="admin-muted-react">Loading report data...</div>
        ) : (
          <div className="admin-table-scroll-wrap" style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--line)' }}>
            <table className="admin-table-react" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Workshop/Event</th>
                  <th>Customer</th>
                  <th>Time</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {(data[tab === 'public' ? 'publicWorkshopRows' : tab === 'private-workshop' ? 'privateWorkshopRows' : 'privateEventRows'] || []).map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 800 }}>{r.workshop_date || r.booking_date}</td>
                    <td>{r.title || getFieldAnswer(r, "event name") || "Private Event"}</td>
                    <td>{r.full_name || r.user_name || "Guest"}</td>
                    <td>{formatTimeRange(r.start_time, r.end_time)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--green-2)' }}>{money(r.total_amount || r.paid_amount)}</td>
                    <td><span className={`pill-mini-react ${paymentBadgeClass(r.payment_status)}`}>{r.payment_status?.toUpperCase() || 'UNPAID'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}