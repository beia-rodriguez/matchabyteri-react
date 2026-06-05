import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PlusCircle,
  Search,
  Image as ImageIcon,
  Download,
  Pencil,
  Users,
  Eye,
  ExternalLink,
  List,
  Trash2,
  Save,
  CheckCircle2,
  EyeOff
} from "lucide-react";
import { Link } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "./../assets/css/AdminWorkshops.css";

// --- HELPER FUNCTIONS ---
function toTimeInput(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function integerInputValue(value) {
  const clean = String(value ?? "").replace(/\D/g, "");
  return clean === "" ? "" : clean;
}

function blockInvalidIntegerKey(e) {
  if ([".", ",", "e", "E", "-", "+"].includes(e.key)) {
    e.preventDefault();
  }
}

function buildEditForm(w) {
  return {
    title: w.title || "",
    workshop_date: w.workshop_date || "",
    location: w.location || "",
    is_active: Number(w.is_active || 0) === 1 ? "1" : "0",
    start_time: toTimeInput(w.start_time),
    end_time: toTimeInput(w.end_time),
    standard_price: formatMoney(w.standard_price),
    premium_price: formatMoney(w.premium_price),
    max_slots: String(Number(w.max_slots || 0)),
    description: w.description || "",
    register_points: w.register_points || "",
    standard_points: w.standard_points || "",
    premium_points: w.premium_points || "",
  };
}

function posterSrc(path) {
  if (!path) return "";

  const rawPath = String(path).trim();
  if (!rawPath) return "";

  if (/^blob:/i.test(rawPath) || /^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const clean = rawPath.replace(/^\/+/, "");

  if (clean.startsWith("backend/api/")) {
    return `/${clean}`;
  }

  if (clean.startsWith("api/")) {
    return `/backend/${clean}`;
  }

  if (clean.startsWith("uploads/")) {
    return `/backend/api/${clean}`;
  }

  return `/backend/api/uploads/${clean}`;
}

function EmptyState({ text }) {
  return (
    <div className="aw-empty-state" role="status" aria-live="polite">
      {text}
    </div>
  );
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label className="aw-field-label" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

const initialAddForm = {
  title: "",
  workshop_date: "",
  location: "",
  start_time: "",
  end_time: "",
  is_active: "1",
  standard_price: "0.00",
  premium_price: "0.00",
  max_slots: "0",
  description: "",
  register_points: "",
  standard_points: "",
  premium_points: "",
};

export default function AdminWorkshops() {
  const [csrf, setCsrf] = useState("");
  const [tab, setTab] = useState("list"); 
  const [workshops, setWorkshops] = useState([]);
  const [regCounts, setRegCounts] = useState({});
  const [selectedWorkshopId, setSelectedWorkshopId] = useState(0);
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [selectedRegs, setSelectedRegs] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [addPoster, setAddPoster] = useState(null);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addForm, setAddForm] = useState(initialAddForm);

  const [inlineSavingId, setInlineSavingId] = useState(null);
  const [inlineDeletingId, setInlineDeletingId] = useState(null);
  const [inlinePosterFiles, setInlinePosterFiles] = useState({});
  const [editForms, setEditForms] = useState({});
  const [expandedRows, setExpandedRows] = useState({});

  const resetMessages = () => {
    setMsg("");
    setErr("");
  };

  const loadData = useCallback(async (nextTab = "list", nextWorkshopId = 0) => {
    try {
      setLoading(true);
      setErr("");

      const apiTab =
        nextTab === "list" || nextTab === "add" ? "workshops" : nextTab;

      const params = { tab: apiTab };

      if (nextTab === "registrations" && Number(nextWorkshopId) > 0) {
        params.workshop_id = nextWorkshopId;
      }

      const { data } = await adminApi.get("/admin/admin-workshops.php", {
        params,
      });

      if (data?.error) {
        setErr(data.error);
        return;
      }

      setCsrf(data?.csrf || "");
      setWorkshops(Array.isArray(data?.workshops) ? data.workshops : []);
      setRegCounts(data?.regCounts || {});
      setSelectedWorkshopId(Number(data?.selectedWorkshopId || 0));
      setSelectedWorkshop(data?.selectedWorkshop || null);
      setSelectedRegs(
        Array.isArray(data?.selectedRegs) ? data.selectedRegs : []
      );
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load workshops.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData("list", 0);
  }, [loadData]);

  const filteredWorkshops = useMemo(() => {
    const needle = String(search || "").trim().toLowerCase();

    return workshops.filter((w) => {
      const title = String(w.title || "").toLowerCase();
      const location = String(w.location || "").toLowerCase();
      const isActive = Number(w.is_active || 0) === 1;

      const matchesSearch = !needle || title.includes(needle) || location.includes(needle);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "hidden" && !isActive);

      return matchesSearch && matchesStatus;
    });
  }, [workshops, search, statusFilter]);

  const orderedRegCols = useMemo(() => {
    if (!selectedRegs.length) return [];
    const cols = Object.keys(selectedRegs[0]);
    const preferred = ["id", "created_at", "full_name", "email", "phone_number", "package", "user_id", "workshop_id"];
    return [...preferred.filter((p) => cols.includes(p)), ...cols.filter((c) => !preferred.includes(c))];
  }, [selectedRegs]);

  const handleTabChange = (nextTab) => {
    resetMessages();
    setTab(nextTab);

    if (nextTab !== "registrations") {
      setSelectedWorkshopId(0);
      setSelectedWorkshop(null);
      setSelectedRegs([]);
      loadData(nextTab, 0);
      return;
    }

    loadData(nextTab, selectedWorkshopId);
  };

  const handleAddChange = (e) => {
    const { name, value } = e.target;

    if (name === "max_slots") {
      setAddForm((prev) => ({ ...prev, [name]: integerInputValue(value) }));
      return;
    }

    setAddForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (id, field, value) => {
    const nextValue = field === "max_slots" ? integerInputValue(value) : value;

    setEditForms((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: nextValue,
      },
    }));
  };

  const toggleExpanded = (workshop) => {
    const wid = Number(workshop.id || 0);

    setExpandedRows((prev) => ({
      ...prev,
      [wid]: !prev[wid],
    }));

    setEditForms((prev) => {
      if (prev[wid]) return prev;
      return {
        ...prev,
        [wid]: buildEditForm(workshop),
      };
    });
  };

  const handleAddWorkshop = async (e) => {
    e.preventDefault();
    resetMessages();
    setSavingAdd(true);

    try {
      const fd = new FormData();
      Object.entries(addForm).forEach(([key, value]) => fd.append(key, value));
      fd.append("csrf_token", csrf);
      fd.append("action", "add_workshop");

      if (addPoster) fd.append("poster", addPoster);

      const { data } = await adminApi.post("/admin/admin-workshops.php", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data?.error) {
        setErr(data.error);
        return;
      }

      setMsg(data?.message || "Workshop added successfully.");
      setAddForm(initialAddForm);
      setAddPoster(null);
      setTab("list"); 
      await loadData("list", 0);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to save workshop.");
    } finally {
      setSavingAdd(false);
    }
  };

  const handleUpdateWorkshop = async (id) => {
    resetMessages();
    setInlineSavingId(id);

    try {
      const form = editForms[id];
      if (!form) {
        setErr("Nothing to update.");
        return;
      }

      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => fd.append(key, value));
      fd.append("csrf_token", csrf);
      fd.append("action", "update_workshop");
      fd.append("id", id);

      if (inlinePosterFiles[id]) fd.append("poster", inlinePosterFiles[id]);

      const { data } = await adminApi.post("/admin/admin-workshops.php", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data?.error) {
        setErr(data.error);
        return;
      }

      setMsg(data?.message || "Workshop updated.");
      setInlinePosterFiles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      await loadData(tab, selectedWorkshopId);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update workshop.");
    } finally {
      setInlineSavingId(null);
    }
  };

  const handleDeleteWorkshop = async (id) => {
    if (!window.confirm("Delete this workshop? This is only allowed if it has no registrations.")) return;

    resetMessages();
    setInlineDeletingId(id);

    try {
      const fd = new FormData();
      fd.append("csrf_token", csrf);
      fd.append("action", "delete_workshop");
      fd.append("id", id);

      const { data } = await adminApi.post("/admin/admin-workshops.php", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data?.error) {
        setErr(data.error);
        return;
      }

      setMsg(data?.message || "Workshop deleted.");
      await loadData(tab, selectedWorkshopId);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to delete workshop.");
    } finally {
      setInlineDeletingId(null);
    }
  };

  const openRegistrations = (wid) => {
    const id = Number(wid);
    setTab("registrations");
    setSelectedWorkshopId(id);
    loadData("registrations", id);
  };

  const exportRegsCsv = (wid) => {
    window.open(
      `${adminApi.defaults.baseURL}/admin/admin-workshops.php?action=export_regs&csrf_token=${encodeURIComponent(
        csrf
      )}&workshop_id=${encodeURIComponent(wid)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <AdminLayout title="Workshops Management">
      {msg && <div className="admin-notice-react ok" role="status" aria-live="polite">{msg}</div>}
      {err && <div className="admin-notice-react bad" role="alert" aria-live="assertive">{err}</div>}

      <div className="admin-panel-react" style={{ paddingBottom: '0' }}>
        
        {/* --- THREE TAB NAVIGATION --- */}
        <div className="admin-tabs-react" role="tablist" style={{ borderBottom: '2px solid var(--line)', paddingBottom: '16px' }}>
          <button
            className={`admin-tab-react ${tab === "list" ? "active" : ""}`}
            type="button" role="tab"
            onClick={() => handleTabChange("list")}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <List size={16} /> Existing Workshops
          </button>

          <button
            className={`admin-tab-react ${tab === "add" ? "active" : ""}`}
            type="button" role="tab"
            onClick={() => handleTabChange("add")}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <PlusCircle size={16} /> Add New Workshop
          </button>

          <button
            className={`admin-tab-react ${tab === "registrations" ? "active" : ""}`}
            type="button" role="tab"
            onClick={() => handleTabChange("registrations")}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Users size={16} /> Registrations List
          </button>
        </div>

        {/* =========================================
            TAB 1: EXISTING WORKSHOPS (LIST)
        ========================================= */}
        <div className={`admin-section-react ${tab === "list" ? "show" : ""}`} style={{ paddingTop: '20px' }}>
          
          <div className="admin-workshops-toolbar" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <h3 style={{ margin: 0, color: 'var(--green-2)' }}>Active & Hidden Workshops</h3>

            <div className="admin-workshops-toolbar-actions" style={{ display: 'flex', gap: '12px' }}>
              <label className="admin-search-wrap" htmlFor="workshop-search" style={{ position: 'relative' }}>
                <Search size={16} className="admin-search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} aria-hidden="true" />
                <input
                  aria-label="Search workshops"
                  id="workshop-search"
                  className="admin-input-react"
                  style={{ paddingLeft: '36px', width: '250px' }}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title or location..."
                  autoComplete="off"
                />
              </label>

              <select
                aria-label="Workshop status filter"
                id="workshop-status-filter"
                className="admin-input-react"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active Only</option>
                <option value="hidden">Hidden Only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <EmptyState text="Loading workshops..." />
          ) : filteredWorkshops.length === 0 ? (
            <EmptyState text="No workshops found. Click 'Add New Workshop' to create one." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px' }}>
              {filteredWorkshops.map((w) => {
                const wid = Number(w.id || 0);
                const regs = Number(regCounts[wid] || 0);
                const cap = Number(w.max_slots || 0);
                const isFull = cap > 0 && regs >= cap;
                const remaining = cap > 0 ? Math.max(0, cap - regs) : null;
                const form = editForms[wid] || {};
                const expanded = !!expandedRows[wid];
                const isActive = Number(w.is_active || 0) === 1;

                return (
                  <article key={wid} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="pill-mini-react">#{wid}</span>
                        <span className="pill-mini-react">
                          Regs: {regs} / {cap > 0 ? cap : "Unlimited"} {cap > 0 ? `(Left: ${remaining})` : ""}
                        </span>
                        <span className="pill-mini-react" style={{ background: isActive ? '#e8f0eb' : '#f0f0f0', color: isActive ? 'var(--green-2)' : 'var(--muted)', borderColor: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          {isActive ? (
                            <>
                              <CheckCircle2 size={13} aria-hidden="true" />
                              Active
                            </>
                          ) : (
                            <>
                              <EyeOff size={13} aria-hidden="true" />
                              Hidden
                            </>
                          )}
                        </span>
                        {isFull && <span className="pill-mini-react bad">FULL</span>}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="pill-mini-react" onClick={() => openRegistrations(wid)}>
                          <Users size={14} style={{ marginRight: '6px' }} /> View Regs
                        </button>
                        <Link className="pill-mini-react" to={`/admin/workshops/edit/${wid}`}>
                          <ExternalLink size={14} style={{ marginRight: '6px' }} /> Full Edit
                        </Link>
                        <button type="button" className="pill-mini-react" onClick={() => toggleExpanded(w)}>
                          <Pencil size={14} style={{ marginRight: '6px' }} /> {expanded ? "Close Edit" : "Quick Edit"}
                        </button>
                      </div>
                    </div>

                    <div className="workshop-card-react" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                      <div className="workshop-poster-react">
                        {w.poster_path ? (
                          <img
                            src={posterSrc(w.poster_path)}
                            alt={w.title ? `${w.title} poster` : "Workshop poster"}
                            style={{ width: '140px', height: '140px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--line)' }}
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        ) : (
                          <div className="poster-placeholder-react aw-poster-placeholder">
                            <ImageIcon size={32} color="var(--muted)" />
                          </div>
                        )}
                      </div>

                      <div className="workshop-info-react" style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1.25rem', color: 'var(--green-2)', margin: '0 0 8px 0' }}>{w.title || "Untitled Workshop"}</h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>Schedule</span>
                            <div style={{ fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 600 }}>{w.workshop_date || "TBD"}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{toTimeInput(w.start_time)} to {toTimeInput(w.end_time) || "TBD"}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>Location</span>
                            <div style={{ fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 600 }}>{w.location || "TBD"}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800 }}>Pricing</span>
                            <div style={{ fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 600 }}>Standard: ₱{formatMoney(w.standard_price)}</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 600 }}>Premium: ₱{formatMoney(w.premium_price)}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                          <Link className="admin-pill-react" to={`/public-workshops/${wid}`} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                            <Eye size={14} /> Preview Front End
                          </Link>
                          <button className="admin-pill-react" type="button" onClick={() => exportRegsCsv(wid)} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                            <Download size={14} /> Export CSV
                          </button>
                        </div>
                      </div>
                    </div>

                    {expanded && (
                      <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed var(--line)' }}>
                        <h4 style={{ margin: '0 0 16px 0', color: 'var(--green-2)' }}>Quick Edit Details</h4>
                        
                        <div className="admin-form-row-react admin-form-row-three">
                          <div>
                            <FieldLabel htmlFor={`edit-title-${wid}`}>Title</FieldLabel>
                            <input id={`edit-title-${wid}`} className="admin-input-react" type="text" aria-label="Edit workshop title" value={form.title || ""} onChange={(e) => handleEditChange(wid, "title", e.target.value)} required />
                          </div>
                          <div>
                            <FieldLabel htmlFor={`edit-date-${wid}`}>Date</FieldLabel>
                            <input id={`edit-date-${wid}`} className="admin-input-react" type="date" aria-label="Edit workshop date" value={form.workshop_date || ""} onChange={(e) => handleEditChange(wid, "workshop_date", e.target.value)} required />
                          </div>
                          <div>
                            <FieldLabel htmlFor={`edit-location-${wid}`}>Location</FieldLabel>
                            <input id={`edit-location-${wid}`} className="admin-input-react" type="text" aria-label="Edit workshop location" value={form.location || ""} onChange={(e) => handleEditChange(wid, "location", e.target.value)} required />
                          </div>
                        </div>

                        <div className="admin-form-row-react admin-form-row-three">
                          <div>
                            <FieldLabel htmlFor={`edit-start-${wid}`}>Start Time</FieldLabel>
                            <input id={`edit-start-${wid}`} className="admin-input-react" type="time" aria-label="Edit workshop start time" value={form.start_time || ""} onChange={(e) => handleEditChange(wid, "start_time", e.target.value)} required />
                          </div>
                          <div>
                            <FieldLabel htmlFor={`edit-end-${wid}`}>End Time</FieldLabel>
                            <input id={`edit-end-${wid}`} className="admin-input-react" type="time" aria-label="Edit workshop end time" value={form.end_time || ""} onChange={(e) => handleEditChange(wid, "end_time", e.target.value)} />
                          </div>
                          <div>
                            <FieldLabel htmlFor={`edit-status-${wid}`}>Status</FieldLabel>
                            <select id={`edit-status-${wid}`} className="admin-input-react" aria-label="Edit workshop status" value={form.is_active || "0"} onChange={(e) => handleEditChange(wid, "is_active", e.target.value)}>
                              <option value="1">Active</option>
                              <option value="0">Hidden</option>
                            </select>
                          </div>
                        </div>

                        <div className="admin-form-row-react admin-form-row-three">
                          <div>
                            <FieldLabel htmlFor={`edit-standard-price-${wid}`}>Standard Price</FieldLabel>
                            <input id={`edit-standard-price-${wid}`} className="admin-input-react" type="number" aria-label="Edit standard price" min="0" step="0.01" value={form.standard_price || "0.00"} onChange={(e) => handleEditChange(wid, "standard_price", e.target.value)} />
                          </div>
                          <div>
                            <FieldLabel htmlFor={`edit-premium-price-${wid}`}>Premium Price</FieldLabel>
                            <input id={`edit-premium-price-${wid}`} className="admin-input-react" type="number" aria-label="Edit premium price" min="0" step="0.01" value={form.premium_price || "0.00"} onChange={(e) => handleEditChange(wid, "premium_price", e.target.value)} />
                          </div>
                          <div>
                            <FieldLabel htmlFor={`edit-max-slots-${wid}`}>Max Slots (0 = unli)</FieldLabel>
                            <input id={`edit-max-slots-${wid}`} className="admin-input-react" type="number" aria-label="Edit maximum slots" min="0" step="1" inputMode="numeric" value={form.max_slots || "0"} onKeyDown={blockInvalidIntegerKey} onChange={(e) => handleEditChange(wid, "max_slots", e.target.value)} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                          <button className="admin-btn-react admin-btn-approve-react" type="button" onClick={() => handleUpdateWorkshop(wid)} disabled={inlineSavingId === wid}>
                            <Save size={16} style={{ marginRight: '6px' }} />
                            {inlineSavingId === wid ? "UPDATING..." : "SAVE CHANGES"}
                          </button>
                          <button className="admin-btn-react admin-btn-cancel-react" type="button" onClick={() => handleDeleteWorkshop(wid)} disabled={inlineDeletingId === wid}>
                            <Trash2 size={16} style={{ marginRight: '6px' }} />
                            {inlineDeletingId === wid ? "DELETING..." : "DELETE"}
                          </button>
                        </div>

                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

      {/* =========================================
          TAB 2: ADD NEW WORKSHOP
      ========================================= */}
      <div className={`admin-section-react ${tab === "add" ? "show" : ""}`}>
        <section className="aw-add-workshop">
          <header className="aw-add-header">
            <h3 className="aw-add-title">Create a New Workshop</h3>
            <p className="aw-add-subtitle">
              Fill out the workshop details, package inclusions, pricing, capacity, and poster.
            </p>
          </header>

          <form className="aw-add-form" onSubmit={handleAddWorkshop}>
            <div className="aw-add-layout">
              <div className="aw-add-column">
                <section className="aw-form-card">
                  <h4 className="aw-form-card-title">Basic Information</h4>

                  <div className="aw-field">
                    <FieldLabel htmlFor="add-title">Workshop Title</FieldLabel>
                    <input
                      aria-label="Workshop title"
                      id="add-title"
                      className="aw-input"
                      type="text"
                      name="title"
                      value={addForm.title}
                      onChange={handleAddChange}
                      required
                    />
                  </div>

                  <div className="aw-grid aw-grid-2">
                    <div className="aw-field">
                      <FieldLabel htmlFor="add-date">Date</FieldLabel>
                      <input
                        aria-label="Workshop date"
                        id="add-date"
                        className="aw-input"
                        type="date"
                        name="workshop_date"
                        value={addForm.workshop_date}
                        onChange={handleAddChange}
                        required
                      />
                    </div>

                    <div className="aw-field">
                      <FieldLabel htmlFor="add-location">Location</FieldLabel>
                      <input
                        aria-label="Workshop location"
                        id="add-location"
                        className="aw-input"
                        type="text"
                        name="location"
                        value={addForm.location}
                        onChange={handleAddChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="aw-grid aw-grid-3">
                    <div className="aw-field">
                      <FieldLabel htmlFor="add-start-time">Start Time</FieldLabel>
                      <input
                        aria-label="Workshop start time"
                        id="add-start-time"
                        className="aw-input"
                        type="time"
                        name="start_time"
                        value={addForm.start_time}
                        onChange={handleAddChange}
                        required
                      />
                    </div>

                    <div className="aw-field">
                      <FieldLabel htmlFor="add-end-time">End Time</FieldLabel>
                      <input
                        aria-label="Workshop end time"
                        id="add-end-time"
                        className="aw-input"
                        type="time"
                        name="end_time"
                        value={addForm.end_time}
                        onChange={handleAddChange}
                      />
                    </div>

                    <div className="aw-field">
                      <FieldLabel htmlFor="add-is-active">Visibility</FieldLabel>
                      <select
                        aria-label="Is Active"
                        id="add-is-active"
                        className="aw-input"
                        name="is_active"
                        value={addForm.is_active}
                        onChange={handleAddChange}
                      >
                        <option value="1">Active</option>
                        <option value="0">Hidden</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="aw-form-card">
                  <h4 className="aw-form-card-title">Pricing & Capacity</h4>

                  <div className="aw-grid aw-grid-2">
                    <div className="aw-field">
                      <FieldLabel htmlFor="add-standard-price">Standard Price (₱)</FieldLabel>
                      <input
                        aria-label="Standard price"
                        id="add-standard-price"
                        className="aw-input"
                        type="number"
                        min="0"
                        step="0.01"
                        name="standard_price"
                        value={addForm.standard_price}
                        onChange={handleAddChange}
                      />
                    </div>

                    <div className="aw-field">
                      <FieldLabel htmlFor="add-premium-price">Premium Price (₱)</FieldLabel>
                      <input
                        aria-label="Premium price"
                        id="add-premium-price"
                        className="aw-input"
                        type="number"
                        min="0"
                        step="0.01"
                        name="premium_price"
                        value={addForm.premium_price}
                        onChange={handleAddChange}
                      />
                    </div>
                  </div>

                  <div className="aw-field">
                    <FieldLabel htmlFor="add-max-slots">Maximum Slots (0 = Unlimited)</FieldLabel>
                    <input
                      aria-label="Maximum slots"
                      id="add-max-slots"
                      className="aw-input"
                      type="number"
                      name="max_slots"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={addForm.max_slots}
                      onKeyDown={blockInvalidIntegerKey}
                      onChange={handleAddChange}
                    />
                  </div>
                </section>

                <section className="aw-form-card">
                  <h4 className="aw-form-card-title">Poster</h4>

                  <div className="aw-file-box">
                    <FieldLabel htmlFor="add-poster">Workshop Poster Image</FieldLabel>
                    <input
                      aria-label="Workshop poster image"
                      id="add-poster"
                      className="aw-file-input"
                      type="file"
                      name="poster"
                      accept="image/*"
                      onChange={(e) => setAddPoster(e.target.files?.[0] || null)}
                      required
                    />

                    {addPoster ? (
                      <div className="aw-file-name">Selected: {addPoster.name}</div>
                    ) : (
                      <div className="aw-file-hint">Upload a clear poster image for the workshop page.</div>
                    )}
                  </div>
                </section>
              </div>

              <div className="aw-add-column">
                <section className="aw-form-card aw-content-card">
                  <h4 className="aw-form-card-title">Content & Media</h4>

                  <div className="aw-field">
                    <FieldLabel htmlFor="add-description">Main Description</FieldLabel>
                    <textarea
                      aria-label="Main description"
                      id="add-description"
                      className="aw-textarea aw-textarea-large"
                      name="description"
                      rows="6"
                      value={addForm.description}
                      onChange={handleAddChange}
                      required
                    />
                  </div>

                  <div className="aw-field">
                    <FieldLabel htmlFor="add-register-points">Register Page Points</FieldLabel>
                    <textarea
                      aria-label="Register page points"
                      id="add-register-points"
                      className="aw-textarea"
                      name="register_points"
                      rows="5"
                      placeholder={"- Bullet 1\n- Bullet 2"}
                      value={addForm.register_points}
                      onChange={handleAddChange}
                    />
                  </div>

                  <div className="aw-grid aw-grid-2">
                    <div className="aw-field">
                      <FieldLabel htmlFor="add-standard-points">Standard Package Inclusions</FieldLabel>
                      <textarea
                        aria-label="Standard package inclusions"
                        id="add-standard-points"
                        className="aw-textarea"
                        name="standard_points"
                        rows="5"
                        value={addForm.standard_points}
                        onChange={handleAddChange}
                      />
                    </div>

                    <div className="aw-field">
                      <FieldLabel htmlFor="add-premium-points">Premium Package Inclusions</FieldLabel>
                      <textarea
                        aria-label="Premium package inclusions"
                        id="add-premium-points"
                        className="aw-textarea"
                        name="premium_points"
                        rows="5"
                        value={addForm.premium_points}
                        onChange={handleAddChange}
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="aw-create-actions">
              <button className="aw-create-button" type="submit" disabled={savingAdd}>
                <Save size={18} aria-hidden="true" />
                {savingAdd ? "SAVING..." : "CREATE WORKSHOP"}
              </button>
            </div>
          </form>
        </section>
      </div>

        {/* =========================================
            TAB 3: REGISTRATIONS
        ========================================= */}
        <div className={`admin-section-react ${tab === "registrations" ? "show" : ""}`} style={{ paddingTop: '20px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--green-2)' }}>Registration Management</h3>
              <div className="admin-muted-react">Select a workshop below to view its attendees, or export the list directly.</div>
            </div>
          </div>

          {loading ? (
            <EmptyState text="Loading workshops..." />
          ) : workshops.length === 0 ? (
            <EmptyState text="No workshops yet." />
          ) : (
            <table className="admin-table-react rich-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th>Workshop Details</th>
                  <th style={{ textAlign: 'center' }}>Regs / Cap</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {workshops.map((w) => {
                  const wid = Number(w.id || 0);
                  const regs = Number(regCounts[wid] || 0);
                  const cap = Number(w.max_slots || 0);
                  const isFull = cap > 0 && regs >= cap;

                  return (
                    <tr key={wid}>
                      <td style={{ fontWeight: 900, color: 'var(--green-2)' }}>#{wid}</td>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--ink)', fontSize: '0.95rem' }}>{w.title || "Untitled"}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '2px' }}>{w.workshop_date || "Date TBD"}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`pill-mini-react ${isFull ? 'bad' : ''}`} style={{ border: 'none', background: isFull ? '#fff0f2' : '#f0f3f0' }}>
                          {regs} / {cap > 0 ? cap : "Unlimited"} {isFull ? '(FULL)' : ''}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="admin-pill-react" type="button" onClick={() => openRegistrations(wid)}>
                            <Users size={14} style={{ marginRight: '6px' }} /> View List
                          </button>
                          <button className="admin-pill-react" type="button" onClick={() => exportRegsCsv(wid)}>
                            <Download size={14} style={{ marginRight: '6px' }} /> Export CSV
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {selectedWorkshopId > 0 && (
            <div style={{ marginTop: '40px', background: '#f9fbf9', padding: '24px', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', color: 'var(--green-2)' }}>Attendees: {selectedWorkshop?.title || `Workshop #${selectedWorkshopId}`}</h3>
                  <div className="admin-muted-react" style={{ fontSize: '0.85rem' }}>Total shown: {Number(selectedRegs.length)} (Max 300)</div>
                </div>
                <button className="admin-btn-react admin-btn-approve-react" type="button" onClick={() => exportRegsCsv(selectedWorkshopId)}>
                  <Download size={16} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Export Attendee List
                </button>
              </div>

              {!selectedWorkshop ? (
                <EmptyState text="Workshop not found." />
              ) : selectedRegs.length === 0 ? (
                <EmptyState text="No one has registered for this workshop yet." />
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid var(--line)', borderRadius: '8px' }}>
                  <table className="admin-table-react" style={{ border: 'none', margin: 0 }}>
                    <thead>
                      <tr>
                        {orderedRegCols.map((c) => (
                          <th key={c} style={{ textTransform: 'capitalize' }}>{c.replace(/_/g, ' ')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRegs.map((r, idx) => (
                        <tr key={r.id || idx}>
                          {orderedRegCols.map((c) => (
                            <td key={c}>{String(r[c] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
