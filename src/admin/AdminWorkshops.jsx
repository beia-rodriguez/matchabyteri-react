import { useEffect, useMemo, useState } from "react";
import {
  PlusCircle,
  Search,
  Image as ImageIcon,
  Download,
  Pencil,
  Users,
  Eye,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "./../assets/css/AdminWorkshops.css";

function toTimeInput(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
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
  if (/^https?:\/\//i.test(path)) return path;

  const clean = String(path).trim().replace(/^\/+/, "");

  if (clean.startsWith("uploads/")) {
    return `/api/${clean}`;
  }

  return `/${clean}`;
}

function EmptyState({ text }) {
  return (
    <div className="admin-muted-react" role="status" aria-live="polite">
      {text}
    </div>
  );
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label
      className="admin-muted-react admin-section-label"
      htmlFor={htmlFor}
      style={{ display: "block" }}
    >
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
  const [tab, setTab] = useState("workshops");
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

  const loadData = async (nextTab = tab, nextWorkshopId = selectedWorkshopId) => {
    try {
      setLoading(true);
      setErr("");

      const params = { tab: nextTab };

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
      setTab(data?.tab || nextTab || "workshops");
      setWorkshops(Array.isArray(data?.workshops) ? data.workshops : []);
      setRegCounts(data?.regCounts || {});
      setSelectedWorkshopId(Number(data?.selectedWorkshopId || 0));
      setSelectedWorkshop(data?.selectedWorkshop || null);
      setSelectedRegs(Array.isArray(data?.selectedRegs) ? data.selectedRegs : []);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load workshops.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData("workshops", 0);
  }, []);

  const filteredWorkshops = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return workshops.filter((w) => {
      const title = String(w.title || "").toLowerCase();
      const location = String(w.location || "").toLowerCase();
      const isActive = Number(w.is_active || 0) === 1;

      const matchesSearch =
        !needle || title.includes(needle) || location.includes(needle);

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
    const preferred = [
      "id",
      "created_at",
      "full_name",
      "email",
      "phone_number",
      "package",
      "user_id",
      "workshop_id",
    ];

    return [
      ...preferred.filter((p) => cols.includes(p)),
      ...cols.filter((c) => !preferred.includes(c)),
    ];
  }, [selectedRegs]);

  const handleTabChange = (nextTab) => {
    resetMessages();

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
    setAddForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (id, field, value) => {
    setEditForms((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
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

      Object.entries(addForm).forEach(([key, value]) => {
        fd.append(key, value);
      });

      fd.append("csrf_token", csrf);
      fd.append("action", "add_workshop");

      if (addPoster) {
        fd.append("poster", addPoster);
      }

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
      await loadData("workshops", 0);
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

      Object.entries(form).forEach(([key, value]) => {
        fd.append(key, value);
      });

      fd.append("csrf_token", csrf);
      fd.append("action", "update_workshop");
      fd.append("id", id);

      if (inlinePosterFiles[id]) {
        fd.append("poster", inlinePosterFiles[id]);
      }

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
    if (!window.confirm("Delete this workshop? This is only allowed if it has no registrations.")) {
      return;
    }

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
    <AdminLayout title="Workshops">
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
        <div className="admin-tabs-react" role="tablist" aria-label="Workshop sections">
          <button
            className={`admin-tab-react ${tab === "workshops" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab === "workshops"}
            onClick={() => handleTabChange("workshops")}
          >
            Workshops
          </button>

          <button
            className={`admin-tab-react ${tab === "registrations" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab === "registrations"}
            onClick={() => handleTabChange("registrations")}
          >
            Registrations
          </button>
        </div>

        <div className={`admin-section-react ${tab === "workshops" ? "show" : ""}`}>
          <div className="admin-panel-react admin-panel-no-top-margin">
            <h3>
              <span className="admin-heading-with-icon">
                <PlusCircle size={18} aria-hidden="true" />
                Add Workshop
              </span>
            </h3>

            <form onSubmit={handleAddWorkshop}>
              <div className="admin-form-row-react admin-form-row-three">
                <div>
                  <FieldLabel htmlFor="add-title">Title</FieldLabel>
                  <input
                    id="add-title"
                    className="admin-input-react"
                    type="text"
                    name="title"
                    value={addForm.title}
                    onChange={handleAddChange}
                    required
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="add-date">Date</FieldLabel>
                  <input
                    id="add-date"
                    className="admin-input-react"
                    type="date"
                    name="workshop_date"
                    value={addForm.workshop_date}
                    onChange={handleAddChange}
                    required
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="add-location">Location</FieldLabel>
                  <input
                    id="add-location"
                    className="admin-input-react"
                    type="text"
                    name="location"
                    value={addForm.location}
                    onChange={handleAddChange}
                    required
                  />
                </div>
              </div>

              <div className="admin-form-row-react admin-form-row-three">
                <div>
                  <FieldLabel htmlFor="add-start-time">Start Time</FieldLabel>
                  <input
                    id="add-start-time"
                    className="admin-input-react"
                    type="time"
                    name="start_time"
                    value={addForm.start_time}
                    onChange={handleAddChange}
                    required
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="add-end-time">End Time optional</FieldLabel>
                  <input
                    id="add-end-time"
                    className="admin-input-react"
                    type="time"
                    name="end_time"
                    value={addForm.end_time}
                    onChange={handleAddChange}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="add-status">Status</FieldLabel>
                  <select
                    id="add-status"
                    className="admin-input-react"
                    name="is_active"
                    value={addForm.is_active}
                    onChange={handleAddChange}
                  >
                    <option value="1">Active - Show on site</option>
                    <option value="0">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="admin-form-row-react admin-form-row-three">
                <div>
                  <FieldLabel htmlFor="add-standard-price">Standard Price</FieldLabel>
                  <input
                    id="add-standard-price"
                    className="admin-input-react"
                    type="number"
                    min="0"
                    step="0.01"
                    name="standard_price"
                    value={addForm.standard_price}
                    onChange={handleAddChange}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="add-premium-price">Premium Price</FieldLabel>
                  <input
                    id="add-premium-price"
                    className="admin-input-react"
                    type="number"
                    min="0"
                    step="0.01"
                    name="premium_price"
                    value={addForm.premium_price}
                    onChange={handleAddChange}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="add-max-slots">Max Slots 0 = unlimited</FieldLabel>
                  <input
                    id="add-max-slots"
                    className="admin-input-react"
                    type="number"
                    name="max_slots"
                    min="0"
                    value={addForm.max_slots}
                    onChange={handleAddChange}
                  />
                </div>
              </div>

              <div className="admin-block-spacing">
                <FieldLabel htmlFor="add-description">Description</FieldLabel>
                <textarea
                  id="add-description"
                  className="admin-input-react admin-textarea-full"
                  name="description"
                  rows="4"
                  value={addForm.description}
                  onChange={handleAddChange}
                  required
                />
              </div>

              <div className="admin-block-spacing">
                <FieldLabel htmlFor="add-register-points">Register Page Points</FieldLabel>
                <textarea
                  id="add-register-points"
                  className="admin-input-react admin-textarea-full"
                  name="register_points"
                  rows="4"
                  placeholder={"- Bullet 1\n- Bullet 2"}
                  value={addForm.register_points}
                  onChange={handleAddChange}
                />
              </div>

              <div className="admin-form-row-react admin-form-row-two">
                <div>
                  <FieldLabel htmlFor="add-standard-points">STANDARD inclusions</FieldLabel>
                  <textarea
                    id="add-standard-points"
                    className="admin-input-react admin-textarea-full"
                    name="standard_points"
                    rows="4"
                    value={addForm.standard_points}
                    onChange={handleAddChange}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="add-premium-points">PREMIUM inclusions</FieldLabel>
                  <textarea
                    id="add-premium-points"
                    className="admin-input-react admin-textarea-full"
                    name="premium_points"
                    rows="4"
                    value={addForm.premium_points}
                    onChange={handleAddChange}
                  />
                </div>
              </div>

              <div className="admin-poster-upload-block">
                <FieldLabel htmlFor="add-poster">Poster Image</FieldLabel>
                <input
                  id="add-poster"
                  className="admin-input-react"
                  type="file"
                  name="poster"
                  accept="image/*"
                  onChange={(e) => setAddPoster(e.target.files?.[0] || null)}
                  required
                />

                {addPoster && (
                  <div className="admin-muted-react admin-file-selected">
                    Selected: {addPoster.name}
                  </div>
                )}
              </div>

              <button
                className="admin-btn-react admin-btn-approve-react admin-save-workshop-btn"
                type="submit"
                disabled={savingAdd}
              >
                {savingAdd ? "SAVING WORKSHOP..." : "SAVE WORKSHOP"}
              </button>
            </form>
          </div>

          <div className="admin-panel-react">
            <div className="admin-workshops-toolbar">
              <h3 className="admin-existing-workshops-title">Existing Workshops</h3>

              <div className="admin-workshops-toolbar-actions">
                <label className="admin-search-wrap" htmlFor="workshop-search">
                  <Search size={16} className="admin-search-icon" aria-hidden="true" />
                  <input
                    id="workshop-search"
                    className="admin-input-react admin-search-input"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title or location"
                    autoComplete="off"
                  />
                </label>

                <label className="sr-only" htmlFor="workshop-status-filter">
                  Filter by status
                </label>
                <select
                  id="workshop-status-filter"
                  className="admin-input-react"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>

            {loading ? (
              <EmptyState text="Loading workshops..." />
            ) : filteredWorkshops.length === 0 ? (
              <EmptyState text="No workshops found." />
            ) : (
              <table className="admin-table-react">
                <thead>
                  <tr>
                    <th>Workshop</th>
                  </tr>
                </thead>

                <tbody>
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
                      <tr key={wid}>
                        <td className="admin-workshop-table-cell">
                          <div className="admin-workshop-inner">
                            <div className="admin-workshop-header">
                              <div className="cap-react">
                                <span className="pill-mini-react">#{wid}</span>
                                <span className="pill-mini-react">
                                  Regs: {regs} / {cap > 0 ? cap : "∞"}{" "}
                                  {cap > 0 ? `(Remaining: ${remaining})` : ""}
                                </span>
                                <span className="pill-mini-react">
                                  {isActive ? "Active" : "Hidden"}
                                </span>
                                {isFull && <span className="pill-mini-react bad">FULL</span>}
                              </div>

                              <div className="admin-workshop-header-actions">
                                <button
                                  type="button"
                                  className="pill-mini-react"
                                  onClick={() => openRegistrations(wid)}
                                >
                                  <Users size={14} className="admin-icon-inline" aria-hidden="true" />
                                  Registrations ({regs})
                                </button>

                                <Link className="pill-mini-react" to={`/admin/workshops/edit/${wid}`}>
                                  <Pencil size={14} className="admin-icon-inline" aria-hidden="true" />
                                  Full Edit
                                </Link>

                                <button
                                  type="button"
                                  className="pill-mini-react"
                                  onClick={() => toggleExpanded(w)}
                                  aria-expanded={expanded}
                                >
                                  <Pencil size={14} className="admin-icon-inline" aria-hidden="true" />
                                  {expanded ? "Hide Edit" : "Quick Edit"}
                                </button>
                              </div>
                            </div>

                            <div className="workshop-card-react">
                              <div className="workshop-poster-react">
                                {w.poster_path ? (
                                  <img
                                    src={posterSrc(w.poster_path)}
                                    alt={w.title ? `${w.title} poster` : "Workshop poster"}
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="poster-placeholder-react">
                                    <ImageIcon size={32} aria-hidden="true" />
                                  </div>
                                )}
                              </div>

                              <div className="workshop-info-react">
                                <div className="workshop-title-react">{w.title || "Workshop"}</div>

                                <div className="workshop-meta-react">
                                  {w.workshop_date || "No date"} • {w.location || "No location"}
                                </div>

                                <div className="workshop-meta-react">
                                  Standard: ₱{formatMoney(w.standard_price)} • Premium: ₱
                                  {formatMoney(w.premium_price)}
                                </div>

                                <div className="workshop-meta-react">
                                  Slots: {cap > 0 ? cap : "Unlimited"}
                                </div>

                                <div className="workshop-actions-react">
                                  <Link className="admin-pill-react" to={`/public-workshops/${wid}`}>
                                    <Eye size={15} aria-hidden="true" /> View
                                  </Link>

                                  <Link className="admin-pill-react" to={`/public-workshops/${wid}/register`}>
                                    <ExternalLink size={15} aria-hidden="true" /> Register Page
                                  </Link>

                                  <button
                                    className="admin-pill-react"
                                    type="button"
                                    onClick={() => exportRegsCsv(wid)}
                                  >
                                    <Download size={15} aria-hidden="true" /> Export CSV
                                  </button>
                                </div>
                              </div>
                            </div>

                            {expanded && (
                              <>
                                <div className="admin-form-row-react admin-edit-row-top">
                                  <div>
                                    <FieldLabel htmlFor={`edit-title-${wid}`}>Title</FieldLabel>
                                    <input
                                      id={`edit-title-${wid}`}
                                      className="admin-input-react"
                                      type="text"
                                      value={form.title || ""}
                                      onChange={(e) => handleEditChange(wid, "title", e.target.value)}
                                      required
                                    />
                                  </div>

                                  <div>
                                    <FieldLabel htmlFor={`edit-date-${wid}`}>Date</FieldLabel>
                                    <input
                                      id={`edit-date-${wid}`}
                                      className="admin-input-react"
                                      type="date"
                                      value={form.workshop_date || ""}
                                      onChange={(e) =>
                                        handleEditChange(wid, "workshop_date", e.target.value)
                                      }
                                      required
                                    />
                                  </div>

                                  <div>
                                    <FieldLabel htmlFor={`edit-location-${wid}`}>Location</FieldLabel>
                                    <input
                                      id={`edit-location-${wid}`}
                                      className="admin-input-react"
                                      type="text"
                                      value={form.location || ""}
                                      onChange={(e) => handleEditChange(wid, "location", e.target.value)}
                                      required
                                    />
                                  </div>

                                  <div>
                                    <FieldLabel htmlFor={`edit-status-${wid}`}>Status</FieldLabel>
                                    <select
                                      id={`edit-status-${wid}`}
                                      className="admin-input-react"
                                      value={form.is_active || "0"}
                                      onChange={(e) => handleEditChange(wid, "is_active", e.target.value)}
                                    >
                                      <option value="1">Active</option>
                                      <option value="0">Hidden</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="admin-form-row-react admin-form-row-three">
                                  <div>
                                    <FieldLabel htmlFor={`edit-start-${wid}`}>Start Time</FieldLabel>
                                    <input
                                      id={`edit-start-${wid}`}
                                      className="admin-input-react"
                                      type="time"
                                      value={form.start_time || ""}
                                      onChange={(e) => handleEditChange(wid, "start_time", e.target.value)}
                                      required
                                    />
                                  </div>

                                  <div>
                                    <FieldLabel htmlFor={`edit-end-${wid}`}>End Time</FieldLabel>
                                    <input
                                      id={`edit-end-${wid}`}
                                      className="admin-input-react"
                                      type="time"
                                      value={form.end_time || ""}
                                      onChange={(e) => handleEditChange(wid, "end_time", e.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <FieldLabel htmlFor={`edit-poster-${wid}`}>
                                      Replace Poster optional
                                    </FieldLabel>
                                    <input
                                      id={`edit-poster-${wid}`}
                                      className="admin-input-react"
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) =>
                                        setInlinePosterFiles((prev) => ({
                                          ...prev,
                                          [wid]: e.target.files?.[0] || null,
                                        }))
                                      }
                                    />
                                    {inlinePosterFiles[wid] && (
                                      <div className="admin-muted-react admin-inline-file-selected">
                                        Selected: {inlinePosterFiles[wid].name}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="admin-form-row-react admin-form-row-three">
                                  <div>
                                    <FieldLabel htmlFor={`edit-standard-price-${wid}`}>
                                      Standard Price
                                    </FieldLabel>
                                    <input
                                      id={`edit-standard-price-${wid}`}
                                      className="admin-input-react"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={form.standard_price || "0.00"}
                                      onChange={(e) =>
                                        handleEditChange(wid, "standard_price", e.target.value)
                                      }
                                    />
                                  </div>

                                  <div>
                                    <FieldLabel htmlFor={`edit-premium-price-${wid}`}>
                                      Premium Price
                                    </FieldLabel>
                                    <input
                                      id={`edit-premium-price-${wid}`}
                                      className="admin-input-react"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={form.premium_price || "0.00"}
                                      onChange={(e) =>
                                        handleEditChange(wid, "premium_price", e.target.value)
                                      }
                                    />
                                  </div>

                                  <div>
                                    <FieldLabel htmlFor={`edit-max-slots-${wid}`}>
                                      Max Slots 0 = unlimited
                                    </FieldLabel>
                                    <input
                                      id={`edit-max-slots-${wid}`}
                                      className="admin-input-react"
                                      type="number"
                                      min="0"
                                      value={form.max_slots || "0"}
                                      onChange={(e) =>
                                        handleEditChange(wid, "max_slots", e.target.value)
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="admin-block-spacing">
                                  <FieldLabel htmlFor={`edit-description-${wid}`}>Description</FieldLabel>
                                  <textarea
                                    id={`edit-description-${wid}`}
                                    className="admin-input-react admin-textarea-full"
                                    rows="3"
                                    value={form.description || ""}
                                    onChange={(e) =>
                                      handleEditChange(wid, "description", e.target.value)
                                    }
                                    required
                                  />
                                </div>

                                <div className="admin-block-spacing">
                                  <FieldLabel htmlFor={`edit-register-points-${wid}`}>
                                    Register Page Points
                                  </FieldLabel>
                                  <textarea
                                    id={`edit-register-points-${wid}`}
                                    className="admin-input-react admin-textarea-full"
                                    rows="4"
                                    value={form.register_points || ""}
                                    onChange={(e) =>
                                      handleEditChange(wid, "register_points", e.target.value)
                                    }
                                  />
                                </div>

                                <div className="admin-form-row-react admin-form-row-two">
                                  <div>
                                    <FieldLabel htmlFor={`edit-standard-points-${wid}`}>
                                      STANDARD inclusions
                                    </FieldLabel>
                                    <textarea
                                      id={`edit-standard-points-${wid}`}
                                      className="admin-input-react admin-textarea-full"
                                      rows="4"
                                      value={form.standard_points || ""}
                                      onChange={(e) =>
                                        handleEditChange(wid, "standard_points", e.target.value)
                                      }
                                    />
                                  </div>

                                  <div>
                                    <FieldLabel htmlFor={`edit-premium-points-${wid}`}>
                                      PREMIUM inclusions
                                    </FieldLabel>
                                    <textarea
                                      id={`edit-premium-points-${wid}`}
                                      className="admin-input-react admin-textarea-full"
                                      rows="4"
                                      value={form.premium_points || ""}
                                      onChange={(e) =>
                                        handleEditChange(wid, "premium_points", e.target.value)
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="admin-inline-actions">
                                  <button
                                    className="admin-btn-react admin-btn-approve-react"
                                    type="button"
                                    onClick={() => handleUpdateWorkshop(wid)}
                                    disabled={inlineSavingId === wid}
                                  >
                                    {inlineSavingId === wid ? "UPDATING..." : "UPDATE"}
                                  </button>

                                  <button
                                    className="admin-btn-react admin-btn-cancel-react"
                                    type="button"
                                    onClick={() => handleDeleteWorkshop(wid)}
                                    disabled={inlineDeletingId === wid}
                                  >
                                    {inlineDeletingId === wid ? "DELETING..." : "DELETE"}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className={`admin-section-react ${tab === "registrations" ? "show" : ""}`}>
          <div className="admin-panel-react admin-panel-no-top-margin">
            <h3>Workshop Registrations</h3>
            <div className="admin-muted-react">
              Pick a workshop to view registrations, or export CSV.
            </div>

            {loading ? (
              <EmptyState text="Loading workshops..." />
            ) : workshops.length === 0 ? (
              <EmptyState text="No workshops yet." />
            ) : (
              <table className="admin-table-react admin-top-gap-sm">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Workshop</th>
                    <th>Date</th>
                    <th>Regs / Capacity</th>
                    <th>Actions</th>
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
                        <td>#{wid}</td>
                        <td>
                          {w.title || ""}
                          {isFull && (
                            <span className="pill-mini-react bad admin-pill-offset-left">
                              FULL
                            </span>
                          )}
                        </td>
                        <td>{w.workshop_date || ""}</td>
                        <td>
                          {regs} / {cap > 0 ? cap : "∞"}
                        </td>
                        <td className="admin-nowrap">
                          <button
                            className="admin-pill-react admin-reg-action-btn admin-reg-action-btn-right"
                            type="button"
                            onClick={() => openRegistrations(wid)}
                          >
                            View
                          </button>

                          <button
                            className="admin-pill-react admin-reg-action-btn"
                            type="button"
                            onClick={() => exportRegsCsv(wid)}
                          >
                            Export CSV
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selectedWorkshopId > 0 && (
            <div className="admin-panel-react">
              <h3>
                Registrations for:{" "}
                {selectedWorkshop?.title || `Workshop #${selectedWorkshopId}`}
              </h3>

              <div className="admin-registrations-header">
                <div className="admin-muted-react">
                  Total shown: {Number(selectedRegs.length)} max 300
                </div>

                <button
                  className="admin-pill-react admin-reg-action-btn"
                  type="button"
                  onClick={() => exportRegsCsv(selectedWorkshopId)}
                >
                  <Download size={15} aria-hidden="true" />
                  <span>Export CSV</span>
                </button>
              </div>

              {!selectedWorkshop ? (
                <EmptyState text="Workshop not found." />
              ) : selectedRegs.length === 0 ? (
                <EmptyState text="No registrations for this workshop yet." />
              ) : (
                <div className="admin-table-scroll-wrap">
                  <table className="admin-table-react">
                    <thead>
                      <tr>
                        {orderedRegCols.map((c) => (
                          <th key={c}>{c}</th>
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