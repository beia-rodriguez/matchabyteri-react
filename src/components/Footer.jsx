import { Link } from "react-router-dom";
import "../assets/css/footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">

        <div className="footer-brand">
          <img src="/images/MBT_white 1.png" alt="Matcha by Teri" />
          <p>
            We share the love for matcha in the Philippines through private
            workshops and exclusive events.
          </p>
        </div>

        <div className="footer-nav">
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/event">Event</Link></li>
            <li><Link to="/private-workshop">Workshops</Link></li>
          </ul>
        </div>

        <div className="footer-hours">
          <ul>
            <li>Opening Hours</li>
            <li>Monday - Friday: 8AM - 8PM</li>
            <li>Saturday: 8AM - 4PM</li>
            <li>Sunday: Closed</li>
          </ul>
        </div>

        <div className="footer-follow">
          <p>
            Follow us on Facebook and Instagram for updates!
          </p>

          <div className="footer-icons">
            <a href="#"><img src="/images/ic_baseline-facebook.png" alt="Facebook" /></a>
            <a href="#"><img src="/images/mdi_instagram.png" alt="Instagram" /></a>
            <a href="/images/mdi_email.png"><img src="/images/mdi_email.png" alt="Email" /></a>
          </div>
        </div>

      </div>

      <div className="footer-bottom">
        <div className="copyright-circle">©</div>
        <p>MATCHABYTERI | ALL RIGHTS RESERVED</p>
      </div>
    </footer>
  );
}

export default Footer;