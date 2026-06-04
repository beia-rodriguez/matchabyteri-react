import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import "../assets/css/header.css";

function Navbar() {
  const [open, setOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const dropdownRef = useRef(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data } = await API.get("/user/get-profile.php");
        setUser(data);
        setAvatarFailed(false);
      } catch (e) {
        console.error("Navbar could not fetch profile", e);
      }
    }

    fetchProfile();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLinkClick = () => {
    setOpen(false);
    setIsMobileOpen(false);
  };

  const getProfilePictureUrl = () => {
    const picture = user?.profile_picture?.trim();

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

    /*
      IMPORTANT:
      Since your backend API is inside /backend/api,
      uploaded profile pictures are usually saved like:
      uploads/profile/filename.jpg

      So the correct browser path becomes:
      /backend/api/uploads/profile/filename.jpg
    */
    return `/backend/api/${picture}`;
  };

  const profilePictureUrl = getProfilePictureUrl();

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

        <Link to="/profile" className="avatar-link" onClick={handleLinkClick}>
          <div className="avatar" aria-label="Profile">
            {profilePictureUrl && !avatarFailed ? (
              <img
                className="avatar-img"
                src={profilePictureUrl}
                alt="Profile"
                onError={() => setAvatarFailed(true)}
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
        </Link>
      </div>
    </header>
  );
}

export default Navbar;