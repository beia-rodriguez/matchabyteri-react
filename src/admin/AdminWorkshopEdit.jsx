import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  ListChecks,
  MapPin,
  PhilippinePeso,
  Save,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "../assets/css/admin-workshop-edit.css";

function toTimeInput(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
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

function normalizeMoneyInput(value) {
  if (value === "" || value === null || value === undefined) return "0.00";

  const amount = Number(value);

  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : "0.00";
}

function formatPeso(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function integerOnly(value) {
  const clean = String(value ?? "").replace(/[^\d]/g, "");
  return clean === "" ? "" : String(Number(clean));
}

function buildFormFromWorkshop(w) {
  return {
    title: w?.title || "",
    workshop_date: w?.workshop_date || "",
    location: w?.location || "",
    start_time: toTimeInput(w?.start_time),
    end_time: toTimeInput(w?.end_time),
    is_active: Number(w?.is_active || 0) === 1 ? "1" : "0",
    description: w?.description || "",
    register_points: w?.register_points || "",
    standard_points: w?.standard_points || "",
    standard_price: w?.standard_price ?? "",
    premium_points: w?.premium_points || "",
    premium_price: w?.premium_price ?? "",
    max_slots: String(w?.max_slots ?? "0"),
  };
}


const EMPTY_WORKSHOP_FORM = {
  title: "",
  workshop_date: "",
  location: "",
  start_time: "",
  end_time: "",
  is_active: "0",
  description: "",
  register_points: "",
  standard_points: "",
  standard_price: "",
  premium_points: "",
  premium_price: "",
  max_slots: "0",
};

const workshopEditInitialState = {
  csrf: "",
  workshop: null,
  regCount: 0,
  form: EMPTY_WORKSHOP_FORM,
};

function workshopEditReducer(state, action) {
  switch (action.type) {
    case "load_success": {
      const workshop = action.workshop || null;

      return {
        csrf: action.csrf || "",
        workshop,
        regCount: Number(action.regCount || 0),
        form: workshop ? buildFormFromWorkshop(workshop) : EMPTY_WORKSHOP_FORM,
      };
    }

    case "update_success": {
      const workshop = action.workshop || state.workshop;

      return {
        ...state,
        workshop,
        regCount: Number(action.regCount || 0),
        form: workshop ? buildFormFromWorkshop(workshop) : state.form,
      };
    }

    case "set_form": {
      const nextForm =
        typeof action.updater === "function"
          ? action.updater(state.form)
          : action.updater;

      return {
        ...state,
        form: nextForm || EMPTY_WORKSHOP_FORM,
      };
    }

    default:
      return state;
  }
}

function SummaryItem({ icon: Icon, label, children }) {
  return (
    <div>
      <dt>
        <Icon size={14} aria-hidden="true" />
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function AdminWorkshopEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [editState, dispatchEditState] = useReducer(
    workshopEditReducer,
    workshopEditInitialState
  );
  const { csrf, workshop, regCount, form } = editState;

  const setForm = useCallback((updater) => {
    dispatchEditState({ type: "set_form", updater });
  }, []);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [posterFile, setPosterFile] = useState(null);

  const originalWorkshopRef = useRef(null);

  const loadWorkshop = useCallback(async () => {
    setErr("");
    setMsg("");

    try {
      const { data } = await adminApi.get("/admin/admin-workshop-edit.php", {
        params: { id },
      });

      if (data.error) {
        setErr(data.error);
        return;
      }

      const w = data.workshop || null;

      dispatchEditState({
        type: "load_success",
        csrf: data.csrf,
        workshop: w,
        regCount: data.regCount,
      });

      if (w) {
        originalWorkshopRef.current = w;
      }
    } catch (e) {
      const message = e.response?.data?.error || "Failed to load workshop.";
      setErr(message);

      if (e.response?.status === 404) {
        navigate("/admin/workshops", { replace: true });
      }
    }
  }, [id, navigate]);

  useEffect(() => {
    loadWorkshop();
  }, [loadWorkshop]);

  const posterPreviewUrl = useMemo(() => {
    if (!posterFile) return "";
    return URL.createObjectURL(posterFile);
  }, [posterFile]);

  useEffect(() => {
    if (!posterPreviewUrl) return undefined;

    return () => URL.revokeObjectURL(posterPreviewUrl);
  }, [posterPreviewUrl]);

  const previewPoster = useMemo(() => {
    if (posterPreviewUrl) return posterPreviewUrl;
    return posterSrc(workshop?.poster_path || "");
  }, [posterPreviewUrl, workshop]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "standard_price" || name === "premium_price") {
      if (value === "" || /^\d*(\.\d{0,2})?$/.test(value)) {
        setForm((prev) => ({
          ...prev,
          [name]: value,
        }));
      }

      return;
    }

    if (name === "max_slots") {
      setForm((prev) => ({
        ...prev,
        [name]: integerOnly(value),
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMoneyBlur = (name) => {
    setForm((prev) => ({
      ...prev,
      [name]: normalizeMoneyInput(prev[name]),
    }));
  };

  const getChangedFields = () => {
    const originalWorkshop = originalWorkshopRef.current;

    if (!originalWorkshop) return [];

    const originalForm = buildFormFromWorkshop(originalWorkshop);

    const labels = {
      title: "Title",
      workshop_date: "Date",
      location: "Location",
      start_time: "Start time",
      end_time: "End time",
      is_active: "Status",
      description: "Description",
      register_points: "Register page points",
      standard_points: "Standard inclusions",
      standard_price: "Standard price",
      premium_points: "Premium inclusions",
      premium_price: "Premium price",
      max_slots: "Max slots",
    };

    const changedFields = [];

    for (const [key, label] of Object.entries(labels)) {
      if (String(form[key] ?? "") !== String(originalForm[key] ?? "")) {
        changedFields.push(label);
      }
    }

    return changedFields;
  };

  const hasUnsavedChanges = () => {
    return getChangedFields().length > 0 || Boolean(posterFile);
  };

  const handlePosterChange = (e) => {
    const file = e.target.files?.[0] || null;

    setErr("");

    if (!file) {
      setPosterFile(null);
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    if (!allowed.includes(file.type)) {
      setErr("Only JPG, PNG, GIF, or WEBP poster images are allowed.");
      e.target.value = "";
      setPosterFile(null);
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setErr("Poster image must be less than 3MB.");
      e.target.value = "";
      setPosterFile(null);
      return;
    }

    setPosterFile(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const changedFields = getChangedFields();

    if (posterFile) {
      changedFields.push("Poster image");
    }

    if (changedFields.length === 0) {
      setMsg("");
      setErr("No changes detected.");
      return;
    }

    const confirmMessage = [
      "Save these workshop changes?",
      "",
      "Changed:",
      ...changedFields.map((field) => `- ${field}`),
      "",
      "Customers will see these updates on the public workshop page.",
    ].join("\n");

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setMsg("");
    setErr("");
    setSaving(true);

    try {
      const fd = new FormData();

      fd.append("id", id);
      fd.append("csrf_token", csrf);
      fd.append("action", "update_workshop");
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("register_points", form.register_points);
      fd.append("standard_points", form.standard_points);
      fd.append("standard_price", normalizeMoneyInput(form.standard_price));
      fd.append("premium_points", form.premium_points);
      fd.append("premium_price", normalizeMoneyInput(form.premium_price));
      fd.append("workshop_date", form.workshop_date);
      fd.append("start_time", form.start_time);
      fd.append("end_time", form.end_time);
      fd.append("location", form.location);
      fd.append("is_active", form.is_active);
      fd.append("max_slots", integerOnly(form.max_slots || "0"));

      if (posterFile) {
        fd.append("poster", posterFile);
      }

      const { data } = await adminApi.post("/admin/admin-workshop-edit.php", fd, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (data.error) {
        setErr(data.error);
      } else {
        setMsg(data.message || "Workshop updated.");

        if (data.workshop) {
          const w = data.workshop;
          dispatchEditState({
            type: "update_success",
            workshop: w,
            regCount: data.regCount,
          });
          originalWorkshopRef.current = w;
        }

        setPosterFile(null);
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update workshop.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmMessage = [
      "Delete this workshop?",
      "",
      "This cannot be undone.",
      "If customers may still need to see this workshop history, choose Hidden instead.",
    ].join("\n");

    if (!window.confirm(confirmMessage)) return;

    setMsg("");
    setErr("");
    setDeleting(true);

    try {
      const fd = new FormData();

      fd.append("id", id);
      fd.append("csrf_token", csrf);
      fd.append("action", "delete_workshop");

      const { data } = await adminApi.post("/admin/admin-workshop-edit.php", fd, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (data.error) {
        setErr(data.error);
      } else {
        navigate("/admin/workshops", {
          state: { msg: data.message || "Workshop deleted." },
        });
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to delete workshop.");
    } finally {
      setDeleting(false);
    }
  };

  const topbarRight = useMemo(
    () => (
      <Link className="awe-back-link" to="/admin/workshops">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Workshops
      </Link>
    ),
    []
  );

  return (
    <AdminLayout
      title={`Edit Workshop #${Number(id || 0)}`}
      topbarRight={topbarRight}
    >
      {msg ? <div className="admin-notice-react ok">{msg}</div> : null}
      {err ? <div className="admin-notice-react bad">{err}</div> : null}

      <section className="awe-panel">
        <header className="awe-section-header">
          <h3 className="awe-section-title">
            <FileText size={18} aria-hidden="true" />
            Workshop Details
          </h3>
        </header>

        <div className="awe-summary-card">
          <div className="awe-poster-frame">
            {previewPoster ? (
              <img className="awe-poster-image" src={previewPoster} alt="Poster" />
            ) : (
              <div className="awe-poster-empty">
                <ImageIcon size={26} aria-hidden="true" />
                No Poster
              </div>
            )}
          </div>

          <div className="awe-summary-meta">
            <h4 className="awe-workshop-title">
              {workshop?.title || "Untitled Workshop"}
            </h4>

            <dl className="awe-meta-list">
              <SummaryItem icon={CalendarDays} label="Date">
                {workshop?.workshop_date || "N/A"}
              </SummaryItem>

              <SummaryItem icon={Clock3} label="Time">
                {toTimeInput(workshop?.start_time) || "N/A"}
                {workshop?.end_time ? ` to ${toTimeInput(workshop?.end_time)}` : ""}
              </SummaryItem>

              <SummaryItem icon={MapPin} label="Location">
                {workshop?.location || "N/A"}
              </SummaryItem>

              <SummaryItem
                icon={Number(workshop?.is_active || 0) === 1 ? Eye : EyeOff}
                label="Status"
              >
                <strong>
                  {Number(workshop?.is_active || 0) === 1 ? "Active" : "Hidden"}
                </strong>
              </SummaryItem>

              <SummaryItem icon={PhilippinePeso} label="Standard Price">
                <strong>₱{formatPeso(workshop?.standard_price)}</strong>
              </SummaryItem>

              <SummaryItem icon={PhilippinePeso} label="Premium Price">
                <strong>₱{formatPeso(workshop?.premium_price)}</strong>
              </SummaryItem>

              <SummaryItem icon={Users} label="Max Slots">
                <strong>{Number(workshop?.max_slots || 0)}</strong>
              </SummaryItem>

              <SummaryItem icon={ListChecks} label="Registrations">
                <strong>{Number(regCount)}</strong>
              </SummaryItem>
            </dl>

            <div className="awe-link-row">
              <Link className="awe-mini-link" to={`/public-workshops/${Number(id)}`}>
                <ExternalLink size={14} aria-hidden="true" />
                View
              </Link>
              <Link className="awe-mini-link" to={`/public-workshops/${Number(id)}/register`}>
                <ExternalLink size={14} aria-hidden="true" />
                Register Page
              </Link>
              <Link className="awe-mini-link" to={`/public-workshops/${Number(id)}/standard`}>
                <ExternalLink size={14} aria-hidden="true" />
                Standard
              </Link>
              <Link className="awe-mini-link" to={`/public-workshops/${Number(id)}/premium`}>
                <ExternalLink size={14} aria-hidden="true" />
                Premium
              </Link>
            </div>
          </div>
        </div>

        {hasUnsavedChanges() ? (
          <div className="awe-warning-box" role="status" aria-live="polite">
            You have unsaved changes. Click Save Changes and confirm before they are applied.
          </div>
        ) : null}

        <form className="awe-form" onSubmit={handleSave}>
          <section className="awe-card">
            <h4 className="awe-card-title">
              <FileText size={16} aria-hidden="true" />
              Basic Information
            </h4>

            <div className="awe-grid awe-grid-3">
              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-title">
                  Title
                </label>
                <input
                  id="awe-title"
                  className="awe-input"
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-date">
                  Date
                </label>
                <input
                  id="awe-date"
                  className="awe-input"
                  type="date"
                  name="workshop_date"
                  value={form.workshop_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-location">
                  Location
                </label>
                <input
                  id="awe-location"
                  className="awe-input"
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="awe-grid awe-grid-4">
              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-start-time">
                  Start Time
                </label>
                <input
                  id="awe-start-time"
                  className="awe-input"
                  type="time"
                  name="start_time"
                  value={form.start_time}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-end-time">
                  End Time <span className="awe-label-muted">(optional)</span>
                </label>
                <input
                  id="awe-end-time"
                  className="awe-input"
                  type="time"
                  name="end_time"
                  value={form.end_time}
                  onChange={handleChange}
                />
              </div>

              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-max-slots">
                  Max Slots
                </label>
                <input
                  id="awe-max-slots"
                  className="awe-input"
                  type="number"
                  min="0"
                  step="1"
                  name="max_slots"
                  value={form.max_slots}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    if ([".", ",", "e", "E", "-", "+"].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                />
              </div>

              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-status">
                  Status
                </label>
                <select
                  id="awe-status"
                  className="awe-input"
                  name="is_active"
                  value={form.is_active}
                  onChange={handleChange}
                >
                  <option value="1">Active</option>
                  <option value="0">Hidden</option>
                </select>
              </div>
            </div>
          </section>

          <section className="awe-card">
            <h4 className="awe-card-title">
              <PhilippinePeso size={16} aria-hidden="true" />
              Pricing
            </h4>

            <div className="awe-grid awe-grid-2">
              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-standard-price">
                  Standard Price (₱)
                </label>
                <input
                  id="awe-standard-price"
                  className="awe-input"
                  type="number"
                  min="0"
                  step="0.01"
                  name="standard_price"
                  value={form.standard_price}
                  onChange={handleChange}
                  onBlur={() => handleMoneyBlur("standard_price")}
                />
              </div>

              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-premium-price">
                  Premium Price (₱)
                </label>
                <input
                  id="awe-premium-price"
                  className="awe-input"
                  type="number"
                  min="0"
                  step="0.01"
                  name="premium_price"
                  value={form.premium_price}
                  onChange={handleChange}
                  onBlur={() => handleMoneyBlur("premium_price")}
                />
              </div>
            </div>

            <p className="awe-help-text">
              These are the amounts customers pay when they choose the Standard or Premium workshop package.
            </p>
          </section>

          <section className="awe-card">
            <h4 className="awe-card-title">
              <ImageIcon size={16} aria-hidden="true" />
              Content & Media
            </h4>

            <div className="awe-field">
              <label className="awe-label" htmlFor="awe-description">
                Description <span className="awe-label-muted">(public workshop view)</span>
              </label>
              <textarea
                id="awe-description"
                className="awe-textarea"
                name="description"
                rows="4"
                value={form.description}
                onChange={handleChange}
                required
              />
            </div>

            <div className="awe-field">
              <label className="awe-label" htmlFor="awe-register-points">
                Register Page Points
              </label>
              <textarea
                id="awe-register-points"
                className="awe-textarea"
                name="register_points"
                rows="4"
                placeholder={"- Bullet 1\n- Bullet 2"}
                value={form.register_points}
                onChange={handleChange}
              />
            </div>

            <div className="awe-grid awe-grid-2">
              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-standard-points">
                  Standard Inclusions
                </label>
                <textarea
                  id="awe-standard-points"
                  className="awe-textarea"
                  name="standard_points"
                  rows="4"
                  value={form.standard_points}
                  onChange={handleChange}
                />
              </div>

              <div className="awe-field">
                <label className="awe-label" htmlFor="awe-premium-points">
                  Premium Inclusions
                </label>
                <textarea
                  id="awe-premium-points"
                  className="awe-textarea"
                  name="premium_points"
                  rows="4"
                  value={form.premium_points}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="awe-field">
              <label className="awe-label" htmlFor="awe-poster">
                Replace Poster <span className="awe-label-muted">(optional)</span>
              </label>
              <div className="awe-file-control">
                <Upload size={16} aria-hidden="true" />
                <input
                  id="awe-poster"
                  className="awe-input awe-file-input"
                  type="file"
                  name="poster"
                  accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp"
                  onChange={handlePosterChange}
                />
              </div>
            </div>
          </section>

          <div className="awe-actions">
            <button className="awe-save-button" type="submit" disabled={saving}>
              <Save size={16} aria-hidden="true" />
              {saving ? "SAVING CHANGES..." : "SAVE CHANGES"}
            </button>
          </div>
        </form>
      </section>

      <section className="awe-panel awe-danger-panel">
        <h3 className="awe-section-title">
          <Trash2 size={18} aria-hidden="true" />
          Delete Workshop
        </h3>

        {regCount > 0 ? (
          <div className="admin-notice-react bad">
            This workshop has {Number(regCount)} registration(s). Deleting is disabled.
            Set it to Hidden instead.
          </div>
        ) : null}

        <button
          className="awe-delete-button"
          type="button"
          onClick={handleDelete}
          disabled={regCount > 0 || deleting}
        >
          <Trash2 size={16} aria-hidden="true" />
          {deleting ? "DELETING..." : "DELETE WORKSHOP"}
        </button>
      </section>
    </AdminLayout>
  );
}
