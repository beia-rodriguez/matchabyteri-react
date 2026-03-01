import { useState } from "react";
import { Link } from "react-router-dom";
import "../assets/css/header.css"; // your navbar css

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header>
      <div className="logo">
        <Link to="/">
          {/* ✅ Use public path instead of import */}
          <img src="/images/MBT_green 1.png" alt="Logo" />
        </Link>
      </div>

      <div className="nav-wrapper">
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About us</Link></li>
            <li><Link to="/event">Event</Link></li>

            <li
              className={`dropdown ${open ? "open" : ""}`}
              onMouseLeave={() => setOpen(false)}
            >
              <button
                className="dropbtn"
                onClick={() => setOpen(!open)}
              >
                Workshop <span className="caret"></span>
              </button>

              <div className="dropdown-content">
                <Link to="/public-workshop">Public Workshop</Link>
                <Link to="/private-workshop">Private Workshop</Link>

                <div className="dropdown-divider"></div>
                <div className="dropdown-header">More</div>

                <Link to="/gallery">Gallery</Link>
                <Link to="/faq">FAQ</Link>
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
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 
                       1.79-4 4 1.79 4 4 4zm0 2c-3.33 0-6 2.01-6 
                       4.5V20h12v-1.5c0-2.49-2.67-4.5-6-4.5z"/>
            </svg>
          </div>
        </Link>
      </div>
    </header>
  );
}

export default Navbar;