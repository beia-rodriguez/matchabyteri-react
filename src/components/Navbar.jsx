import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import "../assets/css/header.css";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [navbarUser, setNavbarUser] = useState(user || null);
  const [avatarIndex, setAvatarIndex] = useState(0);

  const dropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);

  const currentUser = navbarUser || user;
  const isLoggedIn = Boolean(currentUser?.id || currentUser?.email);

  const buildAvatarCandidates = useCallback((profilePicture) => {
    const rawPicture = String(profilePicture || "").trim();

    if (!rawPicture) return [];

    if (
      rawPicture.startsWith("http://") ||
      rawPicture.startsWith("https://") ||
      rawPicture.startsWith("data:image/")
    ) {
      return [rawPicture];
    }

    const cleanPicture = rawPicture
      .replace(/^(\.\.\/)+/, "")
      .replace(/^(\.\/)+/, "")
      .replace(/^\/+/, "");

    if (!cleanPicture) return [];

    const candidates = [];

    if (cleanPicture.startsWith("backend/api/")) {
      candidates.push(`/${cleanPicture}`);
    } else if (cleanPicture.startsWith("backend/")) {
      candidates.push(`/${cleanPicture}`);
      candidates.push(`/backend/api/${cleanPicture.replace(/^backend\//, "")}`);
    } else if (cleanPicture.startsWith("uploads/")) {
      candidates.push(`/backend/api/${cleanPicture}`);
      candidates.push(`/backend/${cleanPicture}`);
      candidates.push(`/${cleanPicture}`);
    } else {
      candidates.push(`/backend/api/${cleanPicture}`);
      candidates.push(`/backend/${cleanPicture}`);
      candidates.push(`/${cleanPicture}`);
    }

    return [...new Set(candidates)];
  }, []);

  const avatarCandidates = useMemo(() => {
    return buildAvatarCandidates(currentUser?.profile_picture);
  }, [buildAvatarCandidates, currentUser?.profile_picture]);

  const profileImageSrc = avatarCandidates[avatarIndex] || "";

  const loadLatestProfile = useCallback(async () => {
    if (!isLoggedIn) return;

    try {
      const { data } = await API.get("/user/get-profile.php");

      if (!data || data.error) return;

      setNavbarUser((previousUser) => ({
        ...(previousUser || {}),
        ...data,
      }));

      setAvatarIndex(0);

      try {
        const storedUserV1 = JSON.parse(
          localStorage.getItem("user:v1") || "null"
        );

        if (storedUserV1) {
          localStorage.setItem(
            "user:v1",
            JSON.stringify({
              ...storedUserV1,
              ...data,
            })
          );
        }

        const storedUser = JSON.parse(localStorage.getItem("user") || "null");

        if (storedUser) {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...storedUser,
              ...data,
            })
          );
        }
      } catch {
        // Ignore invalid saved user data.
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error("Navbar profile fetch error:", err);
      }
    }
  }, [isLoggedIn]);

  useEffect(() => {
    setNavbarUser(user || null);
    setAvatarIndex(0);
  }, [user]);

  useEffect(() => {
    loadLatestProfile();
  }, [loadLatestProfile]);

  useEffect(() => {
    const handleFocus = () => {
      loadLatestProfile();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadLatestProfile]);

  useEffect(() => {
    setAvatarIndex(0);
  }, [currentUser?.profile_picture]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }

      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAvatarError = () => {
    setAvatarIndex((previousIndex) => {
      const nextIndex = previousIndex + 1;

      if (nextIndex >= avatarCandidates.length) {
        return avatarCandidates.length;
      }

      return nextIndex;
    });
  };

  const handleLinkClick = () => {
    setOpen(false);
    setProfileOpen(false);
    setIsMobileOpen(false);
  };

  const handleLogout = async () => {
    setOpen(false);
    setProfileOpen(false);
    setIsMobileOpen(false);

    try {
      if (typeof logout === "function") {
        await logout();
      }
    } catch {
      // Continue clearing frontend auth even if backend logout fails.
    }

    localStorage.removeItem("user:v1");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    sessionStorage.clear();

    setNavbarUser(null);
    setAvatarIndex(0);

    navigate("/login", { replace: true });
  };

  const handleAvatarClick = () => {
    if (!isLoggedIn) {
      setProfileOpen(false);
      setOpen(false);
      setIsMobileOpen(false);
      navigate("/login");
      return;
    }

    setProfileOpen((previousValue) => !previousValue);
  };

  return (
    <header>
      <div className="logo">
        <Link to="/" onClick={handleLinkClick}>
          <img src="/images/MBT_green 1.png" alt="Matcha By Teri Logo" />
        </Link>
      </div>

      <button
        className={`hamburger ${isMobileOpen ? "active" : ""}`}
        onClick={() => setIsMobileOpen((previousValue) => !previousValue)}
        aria-label="Toggle navigation"
        type="button"
      >
        <span className="bar"></span>
        <span className="bar"></span>
        <span className="bar"></span>
      </button>

      <div className={`nav-wrapper ${isMobileOpen ? "mobile-open" : ""}`}>
        <nav>
          <ul>
            <li>
              <Link to="/" onClick={handleLinkClick}>
                Home
              </Link>
            </li>

            <li>
              <Link to="/about" onClick={handleLinkClick}>
                About us
              </Link>
            </li>

            <li>
              <Link to="/event" onClick={handleLinkClick}>
                Event
              </Link>
            </li>

            <li className={`dropdown ${open ? "open" : ""}`} ref={dropdownRef}>
              <button
                className="dropbtn"
                onClick={() => setOpen((previousValue) => !previousValue)}
                type="button"
                aria-expanded={open}
                aria-label="Open workshop menu"
              >
                Workshop <span className="caret"></span>
              </button>

              <div className="dropdown-content">
                <Link to="/public-workshops" onClick={handleLinkClick}>
                  Public Workshop
                </Link>

                <Link to="/private-workshop" onClick={handleLinkClick}>
                  Private Workshop
                </Link>
              </div>
            </li>
          </ul>
        </nav>
      </div>

      <div className="actions">
        <Link to="/calendar" onClick={handleLinkClick}>
          <button className="btn-book" type="button">
            Book Now
          </button>
        </Link>

        <div
          className={`profile-dropdown ${
            profileOpen && isLoggedIn ? "open" : ""
          } ${!isLoggedIn ? "profile-dropdown-guest" : ""}`}
          ref={profileDropdownRef}
          onMouseEnter={() => {
            if (isLoggedIn) {
              setProfileOpen(true);
            }
          }}
          onMouseLeave={() => {
            if (isLoggedIn) {
              setProfileOpen(false);
            }
          }}
        >
          <button
            className="avatar-button"
            type="button"
            aria-label={isLoggedIn ? "Open account menu" : "Go to login"}
            aria-expanded={isLoggedIn ? profileOpen : false}
            onClick={handleAvatarClick}
          >
            <div className="avatar" aria-label="Account">
              {isLoggedIn && profileImageSrc ? (
                <img
                  className="avatar-image"
                  src={profileImageSrc}
                  alt={
                    currentUser?.name
                      ? `${currentUser.name} profile picture`
                      : "User profile picture"
                  }
                  onError={handleAvatarError}
                />
              ) : (
                <svg
                  className="avatar-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-3.31 0-8 1.67-8 5v1.5c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5V19c0-3.33-4.69-5-8-5Z" />
                </svg>
              )}
            </div>
          </button>

          {isLoggedIn && (
            <div className="profile-menu">
              <div className="profile-menu-head">
                <div className="profile-menu-name">
                  {currentUser?.name || "My Account"}
                </div>

                <div className="profile-menu-email">
                  {currentUser?.email || "Manage your account"}
                </div>
              </div>

              <Link to="/profile" onClick={handleLinkClick}>
                Account
              </Link>

              <Link to="/my-booking" onClick={handleLinkClick}>
                My Booking
              </Link>

              <button type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;