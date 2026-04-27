import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";
import "../assets/css/private-workshop.css";

export default function PublicWorkshop() {
  return (
    <>
      <Navbar />

      <div className="pw-wrapper">

        <section className="pw-book-section-text">
          <p>Book a workshop with us!</p>

          <div className="pw-workshop-image">
            <img src="/images/menu-1.png" alt="Workshop image 1" />
          </div>

          <p className="pw-workshop-text">
            Make your next get-together unforgettable with a hands-on matcha
            experience led by our team! Perfect for team-building events,
            bridal showers, baby showers, birthdays, corporate gatherings,
            product launches, or simply a fun day with friends.
          </p>
        </section>

        <section className="pw-details-section">
          <h1>Details:</h1>
          <ul>
            <li>Minimum of 5 attendees, maximum of 15</li>
            <li>3-hour interactive workshop</li>
            <li>Learn all about matcha — its history, process, and preparation</li>
            <li>Taste different matcha drinks</li>
            <li>Create and whisk your own matcha beverages</li>
          </ul>
        </section>

        <section className="pw-workshop-tier-section">
          <div className="pw-workshop-tier">

            <div className="pw-standard-tier">
              <div className="pw-standard-button">
                <button>STANDARD</button>
              </div>

              <div className="pw-standard-desc">
                <p>
                  Matcha soirée: a gathering to learn and enjoy matcha with the community!
                </p>

                <ul className="pw-workshop-tier-list">
                  <li>Full workshop experience (no kit included)</li>
                  <li>Bring your own matcha tools</li>
                  <li>
                    Please indicate if you don't have your own kit and prefer not to purchase the premium package
                  </li>
                </ul>
              </div>
            </div>

            <div className="pw-premium-tier">
              <div className="pw-premium-button">
                <button>PREMIUM</button>
              </div>

              <div className="pw-premium-desc">
                <p>
                  Matcha soirée: a gathering to learn and enjoy matcha with the community!
                </p>

                <ul className="pw-workshop-tier-list">
                  <li>Full workshop experience (no kit included)</li>
                  <li>
                    Includes a basic matcha kit to take home:
                    Chawan (bowl), Chasen (whisk), Chashaku (scoop), and
                    Chasen rest (stand)
                  </li>
                </ul>
              </div>
            </div>

          </div>

          <div className="pw-book-button">
            <Link to="/calendar?type=workshop">
              <button>BOOK NOW</button>
            </Link>
          </div>
        </section>

      </div>
    </>
  );
}