import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import "../assets/css/header.css";

function Navbar() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLinkClick = () => setOpen(false);

  return (
    <header>
      <div className="logo">
        <Link to="/">
          <img src="/images/MBT_green 1.png" alt="Logo" />
        </Link>
      </div>

      <div className="nav-wrapper">
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About us</Link></li>
            <li><Link to="/event">Event</Link></li>

            <li className={`dropdown ${open ? "open" : ""}`} ref={dropdownRef}>
              <button className="dropbtn" onClick={() => setOpen(prev => !prev)}>
                Workshop <span className="caret"></span>
              </button>

              <div className="dropdown-content">
                {/* ✅ PUBLIC workshop list page (WorkshopSignup.jsx) */}
                <Link to="/public-workshops" onClick={handleLinkClick}>
                  Public Workshop
                </Link>

                {/* ✅ PRIVATE workshop page (PrivateWorkshop.jsx) */}
                <Link to="/private-workshop" onClick={handleLinkClick}>
                  Private Workshop
                </Link>

                <div className="dropdown-divider"></div>
                <div className="dropdown-header">More</div>
              </div>
            </li>
          </ul>
        </nav>
      </div>

      <div className="actions">
        <Link to="/calendar">
          <button className="btn-book">Book Now</button>
        </Link>

        <Link to="/profile" className="avatar-link">
          <div className="avatar">
            <svg viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4 1.79 4 4 4zm0 2c-3.33 0-6 2.01-6 4.5V20h12v-1.5c0-2.49-2.67-4.5-6-4.5z" />
            </svg>
          </div>
        </Link>
      </div>
    </header>
  );
}

export default Navbar;