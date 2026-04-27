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
    <Link className="admin-pill-react" to="/admin/workshops">
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

      <div className="admin-panel-react">
        <h3>Workshop Details</h3>

        <div className="poster-preview-react" style={{ marginBottom: 12 }}>
          {previewPoster ? (
            <img
              src={previewPoster}
              alt="Poster"
              style={{
                width: 180,
                height: 180,
                objectFit: "cover",
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "#fff",
              }}
            />
          ) : (
            <div
              style={{
                width: 180,
                height: 180,
                border: "1px solid var(--line)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted)",
                fontWeight: 800,
                background: "#fff",
              }}
            >
              No Poster
            </div>
          )}

          <div className="poster-meta-react">
            <div className="title-react">{workshop?.title || ""}</div>
            <div className="muted-react">
              Date: {workshop?.workshop_date || ""}
              <br />
              Time: {toTimeInput(workshop?.start_time)}
              {workshop?.end_time ? ` - ${toTimeInput(workshop?.end_time)}` : ""}
              <br />
              Location: {workshop?.location || ""}
              <br />
              Status:{" "}
              <strong>
                {Number(workshop?.is_active || 0) === 1 ? "Active" : "Hidden"}
              </strong>
              <br />
              Max Slots: <strong>{Number(workshop?.max_slots || 0)}</strong>
              <br />
              Registrations: <strong>{Number(regCount)}</strong>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="admin-pill-react" to={`/public-workshops/${Number(id)}`}>
                View
              </Link>
              <Link className="admin-pill-react" to={`/public-workshops/${Number(id)}/register`}>
                Register Page
              </Link>
              <Link className="admin-pill-react" to={`/public-workshops/${Number(id)}/standard`}>
                Standard
              </Link>
              <Link className="admin-pill-react" to={`/public-workshops/${Number(id)}/premium`}>
                Premium
              </Link>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div
            className="admin-form-row-react"
            style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>Title</div>
              <input
                className="admin-input-react"
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>Date</div>
              <input
                className="admin-input-react"
                type="date"
                name="workshop_date"
                value={form.workshop_date}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>Location</div>
              <input
                className="admin-input-react"
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div
            className="admin-form-row-react"
            style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}
          >
            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>Start Time</div>
              <input
                className="admin-input-react"
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>End Time (optional)</div>
              <input
                className="admin-input-react"
                type="time"
                name="end_time"
                value={form.end_time}
                onChange={handleChange}
              />
            </div>

            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>Max Slots</div>
              <input
                className="admin-input-react"
                type="number"
                min="0"
                step="1"
                name="max_slots"
                value={form.max_slots}
                onChange={handleChange}
              />
            </div>

            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>Status</div>
              <select
                className="admin-input-react"
                name="is_active"
                value={form.is_active}
                onChange={handleChange}
              >
                <option value="1">Active</option>
                <option value="0">Hidden</option>
              </select>
            </div>
          </div>

          <div style={{ margin: "10px 0 12px" }}>
            <div className="admin-muted-react" style={{ marginBottom: 6 }}>
              Description (public workshop view)
            </div>
            <textarea
              className="admin-input-react"
              name="description"
              rows="4"
              style={{ width: "100%", resize: "vertical" }}
              value={form.description}
              onChange={handleChange}
              required
            />
          </div>

          <div style={{ margin: "10px 0 12px" }}>
            <div className="admin-muted-react" style={{ marginBottom: 6 }}>
              Register Page Points
            </div>
            <textarea
              className="admin-input-react"
              name="register_points"
              rows="4"
              style={{ width: "100%", resize: "vertical" }}
              placeholder={"- Bullet 1\n- Bullet 2"}
              value={form.register_points}
              onChange={handleChange}
            />
          </div>

          <div
            className="admin-form-row-react"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>
                STANDARD inclusions
              </div>
              <textarea
                className="admin-input-react"
                name="standard_points"
                rows="4"
                style={{ width: "100%", resize: "vertical" }}
                value={form.standard_points}
                onChange={handleChange}
              />
            </div>

            <div>
              <div className="admin-muted-react" style={{ marginBottom: 6 }}>
                PREMIUM inclusions
              </div>
              <textarea
                className="admin-input-react"
                name="premium_points"
                rows="4"
                style={{ width: "100%", resize: "vertical" }}
                value={form.premium_points}
                onChange={handleChange}
              />
            </div>
          </div>

          <div style={{ margin: "10px 0 14px" }}>
            <div className="admin-muted-react" style={{ marginBottom: 6 }}>
              Replace Poster (optional)
            </div>
            <input
              className="admin-input-react"
              type="file"
              name="poster"
              accept="image/*"
              onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
            />
          </div>

          <button
            className="admin-btn-react admin-btn-approve-react"
            type="submit"
            style={{ padding: "15px 14px" }}
            disabled={saving}
          >
            {saving ? "SAVING CHANGES..." : "SAVE CHANGES"}
          </button>
        </form>
      </div>

      <div className="admin-panel-react">
        <h3>Delete Workshop</h3>

        {regCount > 0 ? (
          <div className="admin-notice-react bad">
            This workshop has {Number(regCount)} registration(s). Deleting is disabled. Set it to Hidden instead.
          </div>
        ) : null}

        <button
          className="admin-btn-react admin-btn-cancel-react"
          type="button"
          onClick={handleDelete}
          disabled={regCount > 0 || deleting}
        >
          {deleting ? "DELETING..." : "DELETE WORKSHOP"}
        </button>
      </div>
    </AdminLayout>
  );
}
