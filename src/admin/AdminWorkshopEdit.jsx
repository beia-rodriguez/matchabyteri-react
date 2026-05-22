import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

function toTimeInput(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function posterSrc(path) {
  if (!path) return "";

  if (/^blob:/i.test(path)) return path;
  if (/^https?:\/\//i.test(path)) return path;

  const clean = String(path).trim().replace(/^\/+/, "");

  if (clean.startsWith("uploads/")) {
    return `/api/${clean}`;
  }

  return `/${clean}`;
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
    premium_points: w?.premium_points || "",
    max_slots: String(w?.max_slots ?? "0"),
  };
}

export default function AdminWorkshopEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [csrf, setCsrf] = useState("");
  const [workshop, setWorkshop] = useState(null);
  const [regCount, setRegCount] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [posterFile, setPosterFile] = useState(null);

  const [form, setForm] = useState({
    title: "",
    workshop_date: "",
    location: "",
    start_time: "",
    end_time: "",
    is_active: "0",
    description: "",
    register_points: "",
    standard_points: "",
    premium_points: "",
    max_slots: "0",
  });

  const loadWorkshop = async () => {
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
      setCsrf(data.csrf || "");
      setWorkshop(w);
      setRegCount(Number(data.regCount || 0));

      if (w) {
        setForm(buildFormFromWorkshop(w));
      }
    } catch (e) {
      const message = e.response?.data?.error || "Failed to load workshop.";
      setErr(message);

      if (e.response?.status === 404) {
        navigate("/admin/workshops", { replace: true });
      }
    }
  };

  useEffect(() => {
    loadWorkshop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const previewPoster = useMemo(() => {
    if (posterFile) {
      return URL.createObjectURL(posterFile);
    }

    return posterSrc(workshop?.poster_path || "");
  }, [posterFile, workshop]);

  useEffect(() => {
    return () => {
      if (previewPoster && previewPoster.startsWith("blob:")) {
        URL.revokeObjectURL(previewPoster);
      }
    };
  }, [previewPoster]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
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
      fd.append("premium_points", form.premium_points);
      fd.append("workshop_date", form.workshop_date);
      fd.append("start_time", form.start_time);
      fd.append("end_time", form.end_time);
      fd.append("location", form.location);
      fd.append("is_active", form.is_active);
      fd.append("max_slots", form.max_slots);

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
          setWorkshop(w);
          setForm(buildFormFromWorkshop(w));
        }

        setRegCount(Number(data.regCount || 0));
        setPosterFile(null);
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update workshop.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this workshop? This cannot be undone.")) return;

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

  const topbarRight = (
    <Link className="awe-back-link" to="/admin/workshops">
      Back to Workshops
    </Link>
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
          <h3 className="awe-section-title">Workshop Details</h3>
        </header>

        <div className="awe-summary-card">
          <div className="awe-poster-frame">
            {previewPoster ? (
              <img className="awe-poster-image" src={previewPoster} alt="Poster" />
            ) : (
              <div className="awe-poster-empty">No Poster</div>
            )}
          </div>

          <div className="awe-summary-meta">
            <h4 className="awe-workshop-title">{workshop?.title || "Untitled Workshop"}</h4>

            <dl className="awe-meta-list">
              <div>
                <dt>Date</dt>
                <dd>{workshop?.workshop_date || "—"}</dd>
              </div>

              <div>
                <dt>Time</dt>
                <dd>
                  {toTimeInput(workshop?.start_time) || "—"}
                  {workshop?.end_time ? ` - ${toTimeInput(workshop?.end_time)}` : ""}
                </dd>
              </div>

              <div>
                <dt>Location</dt>
                <dd>{workshop?.location || "—"}</dd>
              </div>

              <div>
                <dt>Status</dt>
                <dd>
                  <strong>{Number(workshop?.is_active || 0) === 1 ? "Active" : "Hidden"}</strong>
                </dd>
              </div>

              <div>
                <dt>Max Slots</dt>
                <dd>
                  <strong>{Number(workshop?.max_slots || 0)}</strong>
                </dd>
              </div>

              <div>
                <dt>Registrations</dt>
                <dd>
                  <strong>{Number(regCount)}</strong>
                </dd>
              </div>
            </dl>

            <div className="awe-link-row">
              <Link className="awe-mini-link" to={`/public-workshops/${Number(id)}`}>
                View
              </Link>
              <Link className="awe-mini-link" to={`/public-workshops/${Number(id)}/register`}>
                Register Page
              </Link>
              <Link className="awe-mini-link" to={`/public-workshops/${Number(id)}/standard`}>
                Standard
              </Link>
              <Link className="awe-mini-link" to={`/public-workshops/${Number(id)}/premium`}>
                Premium
              </Link>
            </div>
          </div>
        </div>

        <form className="awe-form" onSubmit={handleSave}>
          <section className="awe-card">
            <h4 className="awe-card-title">Basic Information</h4>

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
            <h4 className="awe-card-title">Content & Media</h4>

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
              <input
                id="awe-poster"
                className="awe-input awe-file-input"
                type="file"
                name="poster"
                accept="image/*"
                onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
              />
            </div>
          </section>

          <div className="awe-actions">
            <button
              className="awe-save-button"
              type="submit"
              disabled={saving}
            >
              {saving ? "SAVING CHANGES..." : "SAVE CHANGES"}
            </button>
          </div>
        </form>
      </section>

      <section className="awe-panel awe-danger-panel">
        <h3 className="awe-section-title">Delete Workshop</h3>

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
          {deleting ? "DELETING..." : "DELETE WORKSHOP"}
        </button>
      </section>
    </AdminLayout>
  );
}
