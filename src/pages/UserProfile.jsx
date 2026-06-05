import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Navbar from "../components/Navbar";
import "../assets/css/user-profile.css";
import "../assets/css/universal.css";

function readableText(text = "") {
  return String(text)
    .replace(/\bPAID\b/g, "Paid")
    .replace(/\bPARTIAL\b/g, "Partial")
    .replace(/\bPENDING_PAYMENT\b/g, "Awaiting Payment")
    .replace(/\bAWAITING_PAYMENT\b/g, "Awaiting Payment")
    .replace(/\bPENDING\b/g, "Pending")
    .replace(/\bREJECTED\b/g, "Rejected")
    .replace(/\bUNPAID\b/g, "Unpaid")
    .replace(/\bAPPROVED\b/g, "Approved")
    .replace(/\bCANCELLED\b/g, "Cancelled")
    .replace(/\bEVENT_BOOKING\b/g, "Event Booking")
    .replace(/\bPRIVATE_WORKSHOP\b/g, "Private Workshop")
    .replace(/\bWORKSHOP_REGISTRATION\b/g, "Workshop Registration")
    .replace(/\bCUSTOM\b/g, "Custom")
    .replace(/\bNEW\b/g, "New")
    .replace(/_/g, " ")
    .trim();
}

function DefaultProfileIcon() {
  return (
    <svg
      className="profile-pic"
      viewBox="0 0 24 24"
      role="img"
      aria-label="User avatar"
      focusable="false"
      style={{
        padding: "18px",
        background: "#1f5b38",
        fill: "#ffffff",
        objectFit: "contain",
      }}
    >
      <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-3.31 0-8 1.67-8 5v1.5c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5V19c0-3.33-4.69-5-8-5Z" />
    </svg>
  );
}

function profilePictureSrc(path) {
  if (!path || !String(path).trim()) return "";

  const rawPath = String(path).trim();

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

  return `/backend/api/${clean}`;
}

function formatPhoneForInput(value = "") {
  const clean = String(value).replace(/\s+/g, "").trim();

  if (/^\+639\d{9}$/.test(clean)) {
    return clean.slice(3);
  }

  if (/^09\d{9}$/.test(clean)) {
    return clean.slice(1);
  }

  if (/^9\d{9}$/.test(clean)) {
    return clean;
  }

  return clean.replace(/^\+?63/, "");
}

function normalizePhoneNumber(value = "") {
  const clean = String(value).replace(/\s+/g, "").trim();

  if (!clean) return "";

  if (/^09\d{9}$/.test(clean)) {
    return `+63${clean.slice(1)}`;
  }

  if (/^\+639\d{9}$/.test(clean)) {
    return clean;
  }

  if (/^9\d{9}$/.test(clean)) {
    return `+63${clean}`;
  }

  return clean;
}

function buildProfileForm(userData = {}) {
  return {
    name: userData.name || "",
    phone_number: formatPhoneForInput(userData.phone_number || ""),
    birthdate: userData.birthdate || "",
    profile_picture: null,
  };
}

export default function UserProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [preview, setPreview] = useState(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [unreadReplies, setUnreadReplies] = useState(0);

  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    birthdate: "",
    profile_picture: null,
  });

  const [originalForm, setOriginalForm] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });

  const todayMaxDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const applyLoadedProfile = (userData) => {
    const nextForm = buildProfileForm(userData);

    setUser(userData);
    setUnreadReplies(userData.unreadReplies || 0);
    setForm(nextForm);
    setOriginalForm(nextForm);
    setPreview(null);
    setAvatarFailed(false);
  };

  useEffect(() => {
    API.get("/user/get-profile.php")
      .then((profileRes) => {
        applyLoadedProfile(profileRes.data);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login?redirect=/profile");
        }
      });
  }, [navigate]);

  useEffect(() => {
    const readableContent = document.getElementById("readable-content");

    if (!readableContent) return;

    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const readableElements = readableContent.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, input, textarea, select, button, img, a, li, th, td, .profile-title, .name, .email, .admin-badge, .badge-new, .hint"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (
        tagName !== "button" &&
        tagName !== "a" &&
        tagName !== "input" &&
        tagName !== "textarea" &&
        tagName !== "select"
      ) {
        element.removeAttribute("tabindex");
      }

      if (!isVisible(element)) return;

      let textToRead = "";

      if (tagName === "img") {
        textToRead = element.getAttribute("alt") || "";
      } else if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        const parentDiv = element.closest(".field") || element.closest("div");
        const label = parentDiv?.querySelector("label");

        textToRead =
          element.getAttribute("aria-label") ||
          label?.innerText ||
          element.placeholder ||
          element.value ||
          element.name ||
          element.id ||
          "Input field";
      } else {
        textToRead =
          element.getAttribute("aria-label") ||
          element.innerText ||
          element.textContent ||
          "";
      }

      if (!textToRead.trim()) return;

      if (
        tagName !== "button" &&
        tagName !== "a" &&
        tagName !== "input" &&
        tagName !== "textarea" &&
        tagName !== "select"
      ) {
        element.setAttribute("tabindex", "0");
      }

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", readableText(textToRead));
      }
    });
  }, [user, form, unreadReplies]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    setNotice({ type: "", message: "" });

    if (name === "profile_picture") {
      const file = files?.[0] || null;

      if (!file) {
        setForm((prev) => ({ ...prev, profile_picture: null }));

        setPreview((oldPreview) => {
          if (oldPreview) URL.revokeObjectURL(oldPreview);
          return null;
        });

        setAvatarFailed(false);
        return;
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

      if (!allowedTypes.includes(file.type)) {
        setNotice({
          type: "bad",
          message: "Please choose a JPG, PNG, GIF, or WEBP image.",
        });

        e.target.value = "";
        return;
      }

      if (file.size > 3 * 1024 * 1024) {
        setNotice({
          type: "bad",
          message: "Profile photo must be less than 3MB.",
        });

        e.target.value = "";
        return;
      }

      setForm((prev) => ({ ...prev, profile_picture: file }));
      setAvatarFailed(false);

      setPreview((oldPreview) => {
        if (oldPreview) URL.revokeObjectURL(oldPreview);
        return URL.createObjectURL(file);
      });

      return;
    }

    if (name === "phone_number") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);

      setForm((prev) => ({ ...prev, phone_number: digitsOnly }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (savingProfile) return;

    const cleanName = form.name.trim();
    const phoneDigits = String(form.phone_number || "").replace(/\D/g, "");
    const cleanPhone = phoneDigits ? normalizePhoneNumber(phoneDigits) : "";
    const cleanBirthdate = form.birthdate || "";

    if (!cleanName) {
      window.alert("Name is required.");
      return;
    }

    if (phoneDigits && !/^9\d{9}$/.test(phoneDigits)) {
      window.alert(
        "Contact number must be a Philippine mobile number. Example: +63 912 345 6789."
      );
      return;
    }

    if (cleanBirthdate) {
      const selectedDate = new Date(`${cleanBirthdate}T00:00:00`);
      const today = new Date();

      today.setHours(0, 0, 0, 0);

      if (Number.isNaN(selectedDate.getTime()) || selectedDate > today) {
        window.alert("Birthdate must be a valid date and cannot be in the future.");
        return;
      }
    }

    const changed =
      !originalForm ||
      cleanName !== String(originalForm.name || "").trim() ||
      phoneDigits !== String(originalForm.phone_number || "").replace(/\D/g, "") ||
      cleanBirthdate !== String(originalForm.birthdate || "") ||
      Boolean(form.profile_picture);

    if (!changed) {
      window.alert("No profile changes detected.");
      return;
    }

    const formData = new FormData();

    formData.append("name", cleanName);
    formData.append("phone_number", cleanPhone);
    formData.append("birthdate", cleanBirthdate);

    if (form.profile_picture) {
      formData.append("profile_picture", form.profile_picture);
    }

    setSavingProfile(true);

    try {
      const res = await API.post("/user/update-profile.php", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success) {
        const updatedProfile = {
          ...user,
          name: res.data.name ?? cleanName,
          phone_number: res.data.phone_number ?? cleanPhone,
          birthdate: res.data.birthdate ?? cleanBirthdate,
          profile_picture: res.data.profile_picture ?? user.profile_picture,
        };

        const nextForm = buildProfileForm(updatedProfile);

        setUser(updatedProfile);
        setForm(nextForm);
        setOriginalForm(nextForm);
        setPreview(null);
        setAvatarFailed(false);

        window.alert(res.data.message || "Profile updated successfully.");
      } else {
        window.alert(res.data?.error || "Update failed.");
      }
    } catch (err) {
      console.error("Profile update error:", err);

      window.alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Error updating profile. Please try again."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async (e) => {
    e.preventDefault();

    if (!window.confirm("Are you sure you want to log out?")) return;

    await API.get("/auth/logout.php");
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (!user) return null;

  const isAdmin = user.role?.toLowerCase() === "admin";
  const currentProfilePicture = profilePictureSrc(preview || user.profile_picture);

  return (
    <>
      <Navbar />

      <div className="profile-wrap" id="readable-content">
        <div className="profile-title">Profile</div>

        <div className="profile-card">
          <div className="top-row">
            <div className="who">
              <div className="profile-pic-container">
                {currentProfilePicture && !avatarFailed ? (
                  <img
                    className="profile-pic"
                    src={currentProfilePicture}
                    alt="User avatar"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <DefaultProfileIcon />
                )}

                <label className="btn-upload-photo" htmlFor="profile-picture-input">
                  Change Photo
                  <input
                    id="profile-picture-input"
                    type="file"
                    name="profile_picture"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    aria-label="Change Profile Photo"
                    onChange={handleChange}
                    hidden
                  />
                </label>
              </div>

              <div className="meta">
                <div className="name">{user.name}</div>
                <div className="email">{user.email}</div>
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div className="admin-badge">You are an Admin</div>

                <button
                  type="button"
                  onClick={() => navigate("/admin/dashboard")}
                  className="btn-admin"
                  aria-label="Admin Dashboard"
                >
                  Admin Dashboard
                </button>
              </div>
            )}
          </div>

          {!isAdmin && (
            <div className="quick-actions">
              <button
                type="button"
                className="btn-soft btn-report"
                aria-label="Report Concerns"
                onClick={() => navigate("/report-concerns")}
              >
                Report Concerns
              </button>

              <button
                type="button"
                className="btn-soft"
                aria-label={
                  unreadReplies > 0
                    ? `My Concerns. ${unreadReplies} new replies`
                    : "My Concerns"
                }
                onClick={() => navigate("/my-concerns")}
              >
                My Concerns
                {unreadReplies > 0 && (
                  <span className="badge-new">{unreadReplies} NEW</span>
                )}
              </button>

              <button
                type="button"
                className="btn-soft"
                aria-label="My Booking"
                onClick={() => navigate("/my-booking")}
              >
                My Booking
              </button>
            </div>
          )}

          {notice.message && (
            <div
              className={`profile-notice ${notice.type === "bad" ? "bad" : "ok"}`}
              role="alert"
            >
              {notice.message}
            </div>
          )}

          <hr
            style={{
              border: "none",
              borderTop: "1px solid #eee",
              margin: "25px 0",
            }}
          />

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="field full">
              <label htmlFor="profile-name">Name</label>

              <input
                id="profile-name"
                type="text"
                name="name"
                value={form.name}
                maxLength={120}
                autoComplete="name"
                aria-label={
                  form.name.trim() ? `Name: ${form.name}` : "Enter Name"
                }
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="profile-birthdate">Birthdate</label>

              <input
                id="profile-birthdate"
                type="date"
                name="birthdate"
                value={form.birthdate || ""}
                max={todayMaxDate || undefined}
                autoComplete="bday"
                aria-label={
                  form.birthdate
                    ? `Birthdate: ${form.birthdate}`
                    : "Enter Birthdate"
                }
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label htmlFor="profile-phone-number">Contact Number</label>

              <div className="ph-phone-input">
                <span
                  className="ph-phone-prefix"
                  aria-hidden="true"
                  title="Philippines"
                >
                  🇵🇭 +63
                </span>

                <input
                  id="profile-phone-number"
                  type="tel"
                  name="phone_number"
                  value={form.phone_number}
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel-national"
                  aria-label={
                    form.phone_number.trim()
                      ? `Philippine contact number: plus 63 ${form.phone_number}`
                      : "Enter Philippine mobile number after plus 63"
                  }
                  onChange={handleChange}
                  placeholder="9123456789"
                />
              </div>

              <p className="profile-field-hint">
                Philippines only. Enter 10 digits after +63, for example
                9123456789.
              </p>
            </div>

            <div className="actions full">
              <button
                type="button"
                className="btn btn-back"
                aria-label="Back"
                onClick={() => navigate(-1)}
              >
                Back
              </button>

              <button
                type="submit"
                className="btn btn-save"
                aria-label={
                  savingProfile ? "Saving Profile Changes" : "Save Changes"
                }
                disabled={savingProfile}
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>

          <button
            type="button"
            className="logout-link"
            aria-label="Logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
}