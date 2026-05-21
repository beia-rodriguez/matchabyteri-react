import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import "../assets/css/header.css";

function Navbar() {
  const [open, setOpen] = useState(false); // For Workshop dropdown
  const [isMobileOpen, setIsMobileOpen] = useState(false); // For Mobile Hamburger Menu
  const [user, setUser] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data } = await API.get("/user/get-profile.php");
        setUser(data);
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

  // Closes menus when a link is clicked
  const handleLinkClick = () => {
    setOpen(false);
    setIsMobileOpen(false);
  };

  return (
    <header>
      <div className="logo">
        <Link to="/" onClick={handleLinkClick}>
          <img src="/images/MBT_green 1.png" alt="Logo" />
        </Link>
      </div>

      {/* Mobile Hamburger Button */}
      <button 
        className={`hamburger ${isMobileOpen ? "active" : ""}`} 
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle navigation"
      >
        <span className="bar"></span>
        <span className="bar"></span>
        <span className="bar"></span>
      </button>

      {/* Navigation Links */}
      <div className={`nav-wrapper ${isMobileOpen ? "mobile-open" : ""}`}>
        <nav>
          <ul>
            <li><Link to="/" onClick={handleLinkClick}>Home</Link></li>
            <li><Link to="/about" onClick={handleLinkClick}>About us</Link></li>
            <li><Link to="/event" onClick={handleLinkClick}>Event</Link></li>

            <li className={`dropdown ${open ? "open" : ""}`} ref={dropdownRef}>
              <button className="dropbtn" onClick={() => setOpen((prev) => !prev)}>
                Workshop <span className="caret"></span>
              </button>

              <div className="dropdown-content">
                <Link to="/public-workshops" onClick={handleLinkClick}>Public Workshop</Link>
                <Link to="/private-workshop" onClick={handleLinkClick}>Private Workshop</Link>
              </div>
            </li>
          </ul>
        </nav>
      </div>

      {/* Action Buttons (Always visible) */}
      <div className="actions">
        <Link to="/calendar" onClick={handleLinkClick}>
          <button className="btn-book">Book Now</button>
        </Link>

        <Link to="/profile" className="avatar-link" onClick={handleLinkClick}>
          <div className="avatar">
            {user && user.profile_picture && user.profile_picture.trim() !== "" ? (
              <img 
                src={`/api/${user.profile_picture}`} 
                alt="Profile" 
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4 1.79 4 4 4zm0 2c-3.33 0-6 2.01-6 4.5V20h12v-1.5c0-2.49-2.67-4.5-6-4.5z" />
              </svg>
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}

export default Navbar;