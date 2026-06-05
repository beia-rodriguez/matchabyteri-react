import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../assets/css/header.css";

function getProfilePictureUrl(profilePicture) {
  const picture = profilePicture?.trim();

  if (!picture) {
    return null;
  }

  if (picture.startsWith("http://") || picture.startsWith("https://")) {
    return picture;
  }

  if (picture.startsWith("/backend/")) {
    return picture;
  }

  if (picture.startsWith("/")) {
    return picture;
  }

  return `/backend/api/${picture}`;
}

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);

  const dropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);

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

  const handleLinkClick = () => {
    setOpen(false);
    setProfileOpen(false);
    setIsMobileOpen(false);
  };

  const handleLogout = async () => {
    setOpen(false);
    setProfileOpen(false);
    setIsMobileOpen(false);

    if (typeof logout === "function") {
      await logout();
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      sessionStorage.clear();
    }

    navigate("/login");
  };

  const profilePictureUrl = getProfilePictureUrl(user?.profile_picture);
  const avatarFailed =
    Boolean(profilePictureUrl) && failedAvatarUrl === profilePictureUrl;

  return (
    <header>
      <div className="logo">
        <Link to="/" onClick={handleLinkClick}>
          <img src="/images/MBT_green 1.png" alt="Matcha By Teri Logo" />
        </Link>
      </div>

      <button
        className={`hamburger ${isMobileOpen ? "active" : ""}`}
        onClick={() => setIsMobileOpen((prev) => !prev)}
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
                onClick={() => setOpen((prev) => !prev)}
                type="button"
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
          className={`profile-dropdown ${profileOpen ? "open" : ""}`}
          ref={profileDropdownRef}
          onMouseEnter={() => setProfileOpen(true)}
          onMouseLeave={() => setProfileOpen(false)}
        >
          <button
            className="avatar-button"
            type="button"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((prev) => !prev)}
          >
            <div className="avatar" aria-label="Profile">
              {profilePictureUrl && !avatarFailed ? (
                <img
                  className="avatar-img"
                  src={profilePictureUrl}
                  alt="Profile"
                  onError={() => setFailedAvatarUrl(profilePictureUrl)}
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

          <div className="profile-menu">
            <div className="profile-menu-head">
              <div className="profile-menu-name">
                {user?.name || "My Account"}
              </div>

              <div className="profile-menu-email">
                {user?.email || "Manage your account"}
              </div>
            </div>

            <Link to="/profile" onClick={handleLinkClick}>
              Profile
            </Link>

            <Link to="/my-booking" onClick={handleLinkClick}>
              My Booking
            </Link>

            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;