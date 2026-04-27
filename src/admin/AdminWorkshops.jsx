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
  return <div className="admin-muted-react">{text}</div>;
}

function SectionLabel({ children }) {
  return <div className="admin-muted-react admin-section-label">{children}</div>;
}

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

  const [addForm, setAddForm] = useState({
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
  });

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

      const params = { tab: nextTab };
      if (nextTab === "registrations" && Number(nextWorkshopId) > 0) {
        params.workshop_id = nextWorkshopId;
      }

      const { data } = await adminApi.get("/admin/admin-workshops.php", { params });

      if (data?.error) {
        setErr(data.error);
        return;
      }

      const nextWorkshops = Array.isArray(data?.workshops) ? data.workshops : [];

      setCsrf(data?.csrf || "");
      setTab(data?.tab || "workshops");
      setWorkshops(nextWorkshops);
      setRegCounts(data?.regCounts || {});
      setSelectedWorkshopId(Number(data?.selectedWorkshopId || 0));
      setSelectedWorkshop(data?.selectedWorkshop || null);
      setSelectedRegs(Array.isArray(data?.selectedRegs) ? data.selectedRegs : []);

      const nextEditForms = {};
      nextWorkshops.forEach((w) => {
        nextEditForms[w.id] = buildEditForm(w);
      });
      setEditForms(nextEditForms);
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

    const ordered = [];
    preferred.forEach((p) => {
      if (cols.includes(p)) ordered.push(p);
    });
    cols.forEach((c) => {
      if (!ordered.includes(c)) ordered.push(c);
    });
    return ordered;
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

  const handleAddWorkshop = async (e) => {
    e.preventDefault();
    resetMessages();
    setSavingAdd(true);

    try {
      const fd = new FormData();
      fd.append("csrf_token", csrf);
      fd.append("action", "add_workshop");
      fd.append("title", addForm.title);
      fd.append("description", addForm.description);
      fd.append("register_points", addForm.register_points);
      fd.append("standard_points", addForm.standard_points);
      fd.append("premium_points", addForm.premium_points);
      fd.append("standard_price", addForm.standard_price);
      fd.append("premium_price", addForm.premium_price);
      fd.append("max_slots", addForm.max_slots);
      fd.append("workshop_date", addForm.workshop_date);
      fd.append("start_time", addForm.start_time);
      fd.append("end_time", addForm.end_time);
      fd.append("location", addForm.location);
      fd.append("is_active", addForm.is_active);
      if (addPoster) fd.append("poster", addPoster);

      const { data } = await adminApi.post("/admin/admin-workshops.php", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data?.error) {
        setErr(data.error);
      } else {
        setMsg(data?.message || "Workshop added successfully.");
        setAddForm({
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
        });
        setAddPoster(null);
        await loadData("workshops", 0);
      }
    } catch (e2) {
      setErr(e2.response?.data?.error || "Failed to save workshop.");
    } finally {
      setSavingAdd(false);
    }
  };

  const handleUpdateWorkshop = async (id) => {
    resetMessages();
    setInlineSavingId(id);

    try {
      const form = editForms[id];
      const fd = new FormData();
      fd.append("csrf_token", csrf);
      fd.append("action", "update_workshop");
      fd.append("id", id);
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("register_points", form.register_points);
      fd.append("standard_points", form.standard_points);
      fd.append("premium_points", form.premium_points);
      fd.append("standard_price", form.standard_price);
      fd.append("premium_price", form.premium_price);
      fd.append("max_slots", form.max_slots);
      fd.append("workshop_date", form.workshop_date);
      fd.append("start_time", form.start_time);
      fd.append("end_time", form.end_time);
      fd.append("location", form.location);
      fd.append("is_active", form.is_active);

      if (inlinePosterFiles[id]) {
        fd.append("poster", inlinePosterFiles[id]);
      }

      const { data } = await adminApi.post("/admin/admin-workshops.php", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data?.error) {
        setErr(data.error);
      } else {
        setMsg(data?.message || "Workshop updated.");
        setInlinePosterFiles((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        await loadData(tab, selectedWorkshopId);
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update workshop.");
    } finally {
      setInlineSavingId(null);
    }
  };

  const handleDeleteWorkshop = async (id) => {
    if (!window.confirm("Delete this workshop? (Only allowed if no registrations)")) return;

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
      } else {
        setMsg(data?.message || "Workshop deleted.");
        await loadData(tab, selectedWorkshopId);
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to delete workshop.");
    } finally {
      setInlineDeletingId(null);
    }
  };

  const openRegistrations = (wid) => {
    setTab("registrations");
    setSelectedWorkshopId(Number(wid));
    loadData("registrations", Number(wid));
  };

  const handleExportCsv = () => {
    if (!selectedWorkshopId) return;
    window.open(
      `${adminApi.defaults.baseURL}/admin/admin-workshops.php?action=export_regs&csrf_token=${encodeURIComponent(
        csrf
      )}&workshop_id=${encodeURIComponent(selectedWorkshopId)}`,
      "_blank"
    );
  };

  const exportWorkshopCsv = (wid) => {
    window.open(
      `${adminApi.defaults.baseURL}/admin/admin-workshops.php?action=export_regs&csrf_token=${encodeURIComponent(
        csrf
      )}&workshop_id=${encodeURIComponent(wid)}`,
      "_blank"
    );
  };

  const toggleExpanded = (wid) => {
    setExpandedRows((prev) => ({ ...prev, [wid]: !prev[wid] }));
  };

  return (
    <AdminLayout title="Workshops">
      {msg ? <div className="admin-notice-react ok">{msg}</div> : null}
      {err ? <div className="admin-notice-react bad">{err}</div> : null}

      <div className="admin-panel-react">
        <div className="admin-tabs-react">
          <button
            className={`admin-tab-react ${tab === "workshops" ? "active" : ""}`}
            type="button"
            onClick={() => handleTabChange("workshops")}
          >
            Workshops
          </button>
          <button
            className={`admin-tab-react ${tab === "registrations" ? "active" : ""}`}
            type="button"
            onClick={() => handleTabChange("registrations")}
          >
            Registrations
          </button>
        </div>

        <div className={`admin-section-react ${tab === "workshops" ? "show" : ""}`}>
          <div className="admin-panel-react admin-panel-no-top-margin">
            <h3>
              <span className="admin-heading-with-icon">
                <PlusCircle size={18} />
                Add Workshop
              </span>
            </h3>

            <form onSubmit={handleAddWorkshop}>
              <div className="admin-form-row-react admin-form-row-three">
                <div>
                  <SectionLabel>Title</SectionLabel>
                  <input className="admin-input-react" type="text" name="title" value={addForm.title} onChange={handleAddChange} required />
                </div>

                <div>
                  <SectionLabel>Date</SectionLabel>
                  <input className="admin-input-react" type="date" name="workshop_date" value={addForm.workshop_date} onChange={handleAddChange} required />
                </div>

                <div>
                  <SectionLabel>Location</SectionLabel>
                  <input className="admin-input-react" type="text" name="location" value={addForm.location} onChange={handleAddChange} required />
                </div>
              </div>

              <div className="admin-form-row-react admin-form-row-three">
                <div>
                  <SectionLabel>Start Time</SectionLabel>
                  <input className="admin-input-react" type="time" name="start_time" value={addForm.start_time} onChange={handleAddChange} required />
                </div>

                <div>
                  <SectionLabel>End Time (optional)</SectionLabel>
                  <input className="admin-input-react" type="time" name="end_time" value={addForm.end_time} onChange={handleAddChange} />
                </div>

                <div>
                  <SectionLabel>Status</SectionLabel>
                  <select className="admin-input-react" name="is_active" value={addForm.is_active} onChange={handleAddChange}>
                    <option value="1">Active (Show on site)</option>
                    <option value="0">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="admin-form-row-react admin-form-row-three">
                <div>
                  <SectionLabel>Standard Price</SectionLabel>
                  <input className="admin-input-react" type="text" name="standard_price" placeholder="e.g. 499.00" value={addForm.standard_price} onChange={handleAddChange} />
                </div>

                <div>
                  <SectionLabel>Premium Price</SectionLabel>
                  <input className="admin-input-react" type="text" name="premium_price" placeholder="e.g. 799.00" value={addForm.premium_price} onChange={handleAddChange} />
                </div>

                <div>
                  <SectionLabel>Max Slots (0 = unlimited)</SectionLabel>
                  <input className="admin-input-react" type="number" name="max_slots" min="0" value={addForm.max_slots} onChange={handleAddChange} />
                </div>
              </div>

              <div className="admin-block-spacing">
                <SectionLabel>Description</SectionLabel>
                <textarea
                  className="admin-input-react admin-textarea-full"
                  name="description"
                  rows="4"
                  value={addForm.description}
                  onChange={handleAddChange}
                  required
                />
              </div>

              <div className="admin-block-spacing">
                <SectionLabel>Register Page Points</SectionLabel>
                <textarea
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
                  <SectionLabel>STANDARD inclusions</SectionLabel>
                  <textarea
                    className="admin-input-react admin-textarea-full"
                    name="standard_points"
                    rows="4"
                    value={addForm.standard_points}
                    onChange={handleAddChange}
                  />
                </div>

                <div>
                  <SectionLabel>PREMIUM inclusions</SectionLabel>
                  <textarea
                    className="admin-input-react admin-textarea-full"
                    name="premium_points"
                    rows="4"
                    value={addForm.premium_points}
                    onChange={handleAddChange}
                  />
                </div>
              </div>

              <div className="admin-poster-upload-block">
                <SectionLabel>Poster Image</SectionLabel>
                <input
                  className="admin-input-react"
                  type="file"
                  name="poster"
                  accept="image/*"
                  onChange={(e) => setAddPoster(e.target.files?.[0] || null)}
                  required
                />
                {addPoster ? (
                  <div className="admin-muted-react admin-file-selected">
                    Selected: {addPoster.name}
                  </div>
                ) : null}
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
                <div className="admin-search-wrap">
                  <Search size={16} className="admin-search-icon" />
                  <input
                    className="admin-input-react admin-search-input"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
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
                                {isFull ? <span className="pill-mini-react bad">FULL</span> : null}
                              </div>

                              <div className="admin-workshop-header-actions">
                                <button
                                  type="button"
                                  className="pill-mini-react"
                                  onClick={() => openRegistrations(wid)}
                                >
                                  <Users size={14} className="admin-icon-inline" />
                                  Registrations ({regs})
                                </button>

                                <Link
                                  className="pill-mini-react"
                                  to={`/admin/workshops/edit/${wid}`}
                                >
                                  <Pencil size={14} className="admin-icon-inline" />
                                  Full Edit
                                </Link>

                                <button
                                  type="button"
                                  className="pill-mini-react"
                                  onClick={() => toggleExpanded(wid)}
                                >
                                  <Pencil size={14} className="admin-icon-inline" />
                                  {expanded ? "Hide Edit" : "Quick Edit"}
                                </button>
                              </div>
                            </div>

                            <div className="workshop-card-react">
                              <div className="workshop-poster-react">
                                {w.poster_path ? (
                                  <img
                                    src={posterSrc(w.poster_path)}
                                    alt={w.title || "Workshop poster"}
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="poster-placeholder-react">
                                    <ImageIcon size={32} />
                                  </div>
                                )}
                              </div>

                              <div className="workshop-info-react">
                                <div className="workshop-title-react">{w.title || "Workshop"}</div>

                                <div className="workshop-meta-react">
                                  {w.workshop_date || "No date"} • {w.location || "No location"}
                                </div>

                                <div className="workshop-meta-react">
                                  Standard: ₱{formatMoney(w.standard_price)} • Premium: ₱{formatMoney(w.premium_price)}
                                </div>

                                <div className="workshop-meta-react">
                                  Slots: {cap > 0 ? cap : "Unlimited"}
                                </div>

                                <div className="workshop-actions-react">
                                  <a
                                    className="admin-pill-react"
                                    href={`workshop-view.php?id=${wid}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Eye size={15} /> View
                                  </a>

                                  <a
                                    className="admin-pill-react"
                                    href={`workshop-register.php?id=${wid}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <ExternalLink size={15} /> Register Page
                                  </a>

                                  <button
                                    className="admin-pill-react"
                                    onClick={() => exportWorkshopCsv(wid)}
                                  >
                                    <Download size={15} /> Export CSV
                                  </button>
                                </div>
                              </div>
                            </div>

                            {expanded ? (
                              <>
                                <div className="admin-form-row-react admin-edit-row-top">
                                  <div>
                                    <SectionLabel>Title</SectionLabel>
                                    <input
                                      className="admin-input-react"
                                      type="text"
                                      value={form.title || ""}
                                      onChange={(e) => handleEditChange(wid, "title", e.target.value)}
                                      required
                                    />
                                  </div>

                                  <div>
                                    <SectionLabel>Date</SectionLabel>
                                    <input
                                      className="admin-input-react"
                                      type="date"
                                      value={form.workshop_date || ""}
                                      onChange={(e) => handleEditChange(wid, "workshop_date", e.target.value)}
                                      required
                                    />
                                  </div>

                                  <div>
                                    <SectionLabel>Location</SectionLabel>
                                    <input
                                      className="admin-input-react"
                                      type="text"
                                      value={form.location || ""}
                                      onChange={(e) => handleEditChange(wid, "location", e.target.value)}
                                      required
                                    />
                                  </div>

                                  <div>
                                    <SectionLabel>Status</SectionLabel>
                                    <select
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
                                    <SectionLabel>Start Time</SectionLabel>
                                    <input
                                      className="admin-input-react"
                                      type="time"
                                      value={form.start_time || ""}
                                      onChange={(e) => handleEditChange(wid, "start_time", e.target.value)}
                                      required
                                    />
                                  </div>

                                  <div>
                                    <SectionLabel>End Time</SectionLabel>
                                    <input
                                      className="admin-input-react"
                                      type="time"
                                      value={form.end_time || ""}
                                      onChange={(e) => handleEditChange(wid, "end_time", e.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <SectionLabel>Replace Poster (optional)</SectionLabel>
                                    <input
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
                                    {inlinePosterFiles[wid] ? (
                                      <div className="admin-muted-react admin-inline-file-selected">
                                        Selected: {inlinePosterFiles[wid].name}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="admin-form-row-react admin-form-row-three">
                                  <div>
                                    <SectionLabel>Standard Price</SectionLabel>
                                    <input
                                      className="admin-input-react"
                                      type="text"
                                      value={form.standard_price || "0.00"}
                                      onChange={(e) => handleEditChange(wid, "standard_price", e.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <SectionLabel>Premium Price</SectionLabel>
                                    <input
                                      className="admin-input-react"
                                      type="text"
                                      value={form.premium_price || "0.00"}
                                      onChange={(e) => handleEditChange(wid, "premium_price", e.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <SectionLabel>Max Slots (0 = unlimited)</SectionLabel>
                                    <input
                                      className="admin-input-react"
                                      type="number"
                                      min="0"
                                      value={form.max_slots || "0"}
                                      onChange={(e) => handleEditChange(wid, "max_slots", e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="admin-block-spacing">
                                  <SectionLabel>Description</SectionLabel>
                                  <textarea
                                    className="admin-input-react admin-textarea-full"
                                    rows="3"
                                    value={form.description || ""}
                                    onChange={(e) => handleEditChange(wid, "description", e.target.value)}
                                    required
                                  />
                                </div>

                                <div className="admin-block-spacing">
                                  <SectionLabel>Register Page Points</SectionLabel>
                                  <textarea
                                    className="admin-input-react admin-textarea-full"
                                    rows="4"
                                    value={form.register_points || ""}
                                    onChange={(e) => handleEditChange(wid, "register_points", e.target.value)}
                                  />
                                </div>

                                <div className="admin-form-row-react admin-form-row-two">
                                  <div>
                                    <SectionLabel>STANDARD inclusions</SectionLabel>
                                    <textarea
                                      className="admin-input-react admin-textarea-full"
                                      rows="4"
                                      value={form.standard_points || ""}
                                      onChange={(e) => handleEditChange(wid, "standard_points", e.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <SectionLabel>PREMIUM inclusions</SectionLabel>
                                    <textarea
                                      className="admin-input-react admin-textarea-full"
                                      rows="4"
                                      value={form.premium_points || ""}
                                      onChange={(e) => handleEditChange(wid, "premium_points", e.target.value)}
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
                            ) : null}
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
              <div className="admin-muted-react admin-top-gap-sm">
                Loading workshops...
              </div>
            ) : workshops.length === 0 ? (
              <div className="admin-muted-react admin-top-gap-sm">
                No workshops yet.
              </div>
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
                          {isFull ? (
                            <span className="pill-mini-react bad admin-pill-offset-left">
                              FULL
                            </span>
                          ) : null}
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
                            onClick={() => exportWorkshopCsv(wid)}
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

          {selectedWorkshopId > 0 ? (
            <div className="admin-panel-react">
              <h3>
                Registrations for: {selectedWorkshop?.title || `Workshop #${selectedWorkshopId}`}
              </h3>

              <div className="admin-registrations-header">
                <div className="admin-muted-react">
                  Total shown: {Number(selectedRegs.length)} (max 300)
                </div>

                <button
                  className="admin-pill-react admin-reg-action-btn"
                  type="button"
                  onClick={handleExportCsv}
                >
                  <Download size={15} />
                  <span>Export CSV</span>
                </button>
              </div>

              {!selectedWorkshop ? (
                <div className="admin-muted-react admin-top-gap-sm">
                  Workshop not found.
                </div>
              ) : selectedRegs.length === 0 ? (
                <div className="admin-muted-react admin-top-gap-sm">
                  No registrations for this workshop yet.
                </div>
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
                        <tr key={idx}>
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
          ) : null}
        </div>
      </div>
    </AdminLayout>
  );
}