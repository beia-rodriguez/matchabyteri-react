import "../assets/css/event.css";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Event() {
  return (
    <>

        <Navbar />
      <section className="book-section-text">
        <p>Book a private event with us!</p>

        <div className="event-image">
          <img src="/images/about-matcha-2.png" alt="" />
          <img src="/images/about-matcha-1.png" alt="" />
          <img src="/images/menu-1.png" alt="" />
        </div>

        <p className="event-text">
          After the success of our Pop Up Event with Safe Space Club Pilates,
          we can’t wait to help you host your own unforgettable experience—BOOK NOW!
        </p>
      </section>

      <section className="details-section">
        <h1>Details:</h1>
        <ul>
          <li>12oz iced drinks</li>
          <li>Minimum 50 cups</li>
          <li>PET cups with strawless lids</li>
          <li>Up to 4 hours operation</li>
          <li>2–3 matcharistas</li>
          <li>Fully decorated coffee cart setup</li>
          <li>Customized printed menu</li>
          <li>Full set of condiments</li>
          <li>Exclusions: <span>Transportation, toll fees</span></li>
        </ul>

        <div className="book-button">
          <Link to="/calendar?type=event">
            <button>BOOK HERE</button>
          </Link>
        </div>
      </section>
    </>
  );
}