import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Navbar from "../components/Navbar";
import "../assets/css/user-profile.css";

export default function UserProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [preview, setPreview] = useState(null);
  const [unreadReplies, setUnreadReplies] = useState(0);

  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    birthdate: "",
    profile_picture: null
  });

  useEffect(() => {
    // Fetch profile and bookings simultaneously 
    Promise.all([
      API.get("/user/get-profile.php"),
      API.get("/user/get-bookings.php")
    ])
      .then(([profileRes, bookingRes]) => {
        const userData = profileRes.data;
        setUser(userData);
        setUnreadReplies(userData.unreadReplies || 0);
        setBookings(bookingRes.data.privateBookings || []);

        setForm({
          name: userData.name || "",
          phone_number: userData.phone_number || "",
          birthdate: userData.birthdate || "",
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
    // Ensure this is firing for the 'name' input
    setForm(prev => ({ ...prev, [name]: value }));
  }
};

const handleSubmit = async e => {
  e.preventDefault();

  // Validate locally before sending to prevent the alert you see
  if (!form.name.trim()) {
    alert("Please enter your name.");
    return;
  }

  const formData = new FormData();
  // Ensure these strings match exactly what PHP expects in $_POST
  formData.append("name", form.name); 
  formData.append("phone_number", form.phone_number);
  formData.append("birthdate", form.birthdate);

  if (form.profile_picture) {
    formData.append("profile_picture", form.profile_picture);
  }

  try {
    // Important: Do not set Content-Type header manually here
    const res = await API.post("/user/update-profile.php", formData, {
  headers: { "Content-Type": "multipart/form-data" }
});

    if (res.data.success) {
      setUser(prev => ({
        ...prev,
        profile_picture: res.data.profile_picture,
        name: form.name // Update the header name immediately
      }));
      setPreview(null); 
      alert("Profile updated successfully");
    } else {
      // This is where "Name is required" from PHP is caught
      alert(res.data.error || "Update failed");
    }
  } catch (err) {
    console.error("Upload error:", err);
    alert("Error updating profile. Please try again.");
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

          {/* PROFILE HEADER SECTION */}
          <div className="top-row">
            <div className="who">
              <img
  className="profile-pic"
  src={
    preview 
      ? preview 
      : (user.profile_picture && user.profile_picture.trim() !== ""
          ? `/api/${user.profile_picture}` 
          : "/pics/default-avatar.png")
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
                <button 
                  onClick={() => navigate("/admin/dashboard")} 
                  className="btn-admin"
                >
                  Admin Dashboard
                </button>
              </div>
            )}
          </div>

          {/* QUICK ACTIONS FOR USERS */}
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

          <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "25px 0" }} />

          {/* PROFILE UPDATE FORM */}
          <form onSubmit={handleSubmit} className="profile-form">
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
              <div className="hint">Email cannot be changed from this page. [cite: 580]</div>
            </div>

            <div className="field">
              <label>Birthdate</label>
              <input
                type="date"
                name="birthdate"
                value={form.birthdate || ""}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>Contact Number</label>
              <input
                type="text"
                name="phone_number"
                value={form.phone_number}
                onChange={handleChange}
                placeholder="09XXXXXXXXX"
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
              <div className="hint">JPG/PNG/GIF only. Max 2MB.</div>
            </div>

            {/* BOOKINGS HISTORY SECTION */}
            {!isAdmin && (
              <div className="field full" style={{ marginTop: '20px', marginBottom: '10px' }}>
                <label style={{ marginBottom: '10px', display: 'block' }}>My Bookings</label>
                {bookings.length > 0 ? (
                  <div className="table-responsive" style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--line)', overflow: 'hidden' }}>
                    <table className="bookings-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead style={{ background: '#e9ece7' }}>
                        <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                          <th style={{ padding: '10px' }}>Date</th>
                          <th style={{ padding: '10px' }}>Time</th>
                          <th style={{ padding: '10px' }}>Type</th>
                          <th style={{ padding: '10px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map(b => (
                          <tr key={b.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                            <td style={{ padding: '10px', fontWeight: '700' }}>{b.booking_date}</td>
                            <td style={{ padding: '10px' }}>{b.start_time?.slice(0, 5)} - {b.end_time?.slice(0, 5)}</td>
                            <td style={{ padding: '10px', textTransform: 'capitalize' }}>{b.booking_type}</td>
                            <td style={{ padding: '10px' }}>
                              <span style={{ 
                                fontWeight: '900', 
                                textTransform: 'uppercase', 
                                fontSize: '0.7rem',
                                color: b.status === 'approved' ? 'var(--green-2)' : 'var(--muted)'
                              }}>
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="hint">You haven't made any bookings yet.</p>
                )}
              </div>
            )}

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

          {/* ORIGINAL LOGOUT SECTION */}
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