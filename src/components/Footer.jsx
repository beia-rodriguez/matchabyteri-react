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
            <li>
              <Link to="/" aria-label="Go to Home page">
               
              </Link>
            </li>
            <li>
              <Link to="/about-us" aria-label="Go to About Us page">
               
              </Link>
            </li>
            <li>
              <Link to="/private-workshop" aria-label="Go to Private Workshop page">
               
              </Link>
            </li>
            <li>
              <Link to="/calendar?type=workshop" aria-label="Book a workshop">
               
              </Link>
            </li>
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
          <p>Follow us on Facebook and Instagram for updates!</p>

          <div className="footer-icons">
            <a
              href="https://www.facebook.com/teri.plastina03"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Matcha by Teri Facebook page"
            >
              <img src="/images/ic_baseline-facebook.png" alt="Facebook" />
            </a>

            <a
              href="https://www.instagram.com/matchabyteri/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Matcha by Teri Instagram page"
            >
              <img src="/images/mdi_instagram.png" alt="Instagram" />
            </a>

            <a
              href="mailto:matchabyteri@gmail.com"
              aria-label="Send email to Matcha by Teri"
            >
              <img src="/images/mdi_email.png" alt="Email" />
            </a>
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