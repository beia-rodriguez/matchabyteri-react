import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Navbar from "../components/Navbar";
import "../assets/css/user-profile.css";

export default function UserProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [preview, setPreview] = useState(null);
  const [unreadReplies, setUnreadReplies] = useState(0);

  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    birthdate: "",
    profile_picture: null
  });

  useEffect(() => {
    API.get("/user/get-profile.php")
      .then(res => {
        setUser(res.data);
        setUnreadReplies(res.data.unreadReplies || 0);

        setForm({
          name: res.data.name || "",
          phone_number: res.data.phone_number || "",
          birthdate: res.data.birthdate || "",
          profile_picture: null
        });
      })
      .catch(err => {
        if (err.response?.status === 401) {
          navigate("/login?redirect=/profile");
        }
      });
  }, [navigate]);

  const handleChange = e => {
    const { name, value, files } = e.target;

    if (name === "profile_picture") {
      const file = files[0];
      setForm(prev => ({ ...prev, profile_picture: file }));

      if (file) {
        setPreview(URL.createObjectURL(file));
      }
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("phone_number", form.phone_number);
    formData.append("birthdate", form.birthdate);

    if (form.profile_picture) {
      formData.append("profile_picture", form.profile_picture);
    }

    const res = await API.post("/user/update-profile.php", formData);

    if (res.data.success) {
      setUser(prev => ({
        ...prev,
        profile_picture: res.data.profile_picture
      }));
      alert("Profile updated successfully");
    }
  };

  const handleLogout = async (e) => {
    e.preventDefault();
    const ok = window.confirm("Are you sure you want to log out?");
    if (!ok) return;

    await API.get("/auth/logout.php");
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (!user) return null;

  const isAdmin = user.role?.toLowerCase() === "admin";

  return (
    <>
      <Navbar />

      <div className="profile-wrap">
        <div className="profile-title">Profile</div>

        <div className="profile-card">

          {/* TOP ROW */}
          <div className="top-row">
            <div className="who">
              <img
                className="profile-pic"
                src={
                  preview
                    ? preview
                    : user.profile_picture
                    ? `/api/${user.profile_picture}`
                    : "/pics/default-avatar.png"
                }
                alt="Profile"
              />

              <div className="meta">
                <div className="name">{user.name}</div>
                <div className="email">{user.email}</div>
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div className="admin-badge">You are an Admin</div>
                <a href="/admin/dashboard" className="btn-admin">
                  Admin Dashboard
                </a>
              </div>
            )}
          </div>

          {/* QUICK ACTIONS */}
          {!isAdmin && (
            <div className="quick-actions">
              <button
                className="btn-soft btn-report"
                onClick={() => navigate("/report-concerns")}
              >
                Report Concerns
              </button>

              <button
                className="btn-soft"
                onClick={() => navigate("/my-concerns")}
              >
                My Concerns
                {unreadReplies > 0 && (
                  <span className="badge-new">
                    {unreadReplies} NEW
                  </span>
                )}
              </button>
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label>Email (cannot change)</label>
              <input type="text" value={user.email} disabled />
              <div className="hint">
                Email cannot be changed from this page.
              </div>
            </div>

            <div className="field">
              <label>Birthdate</label>
              <input
                type="date"
                name="birthdate"
                value={form.birthdate || ""}
                onChange={handleChange}
              />
              <div className="hint">
                Used for your account information.
              </div>
            </div>

            <div className="field">
              <label>Contact Number</label>
              <input
                type="text"
                name="phone_number"
                value={form.phone_number}
                onChange={handleChange}
              />
            </div>

            <div className="field full">
              <label>Profile Picture</label>
              <input
                type="file"
                name="profile_picture"
                accept="image/*"
                onChange={handleChange}
              />
              <div className="hint">
                JPG/PNG/GIF only. Max 2MB.
              </div>
            </div>

            <div className="actions full">
              <button
                type="button"
                className="btn btn-back"
                onClick={() => navigate(-1)}
              >
                Back
              </button>

              <button
                type="submit"
                className="btn btn-save"
              >
                Save Changes
              </button>
            </div>
          </form>

          <div className="logout">
            <a href="#" onClick={handleLogout}>
              Logout
            </a>
          </div>

        </div>
      </div>
    </>
  );
}