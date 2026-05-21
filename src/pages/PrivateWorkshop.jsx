import { useEffect } from "react";
import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";
import "../assets/css/private-workshop.css";
import "../assets/css/universal.css";

export default function PublicWorkshop() {
  useEffect(() => {
    const readableContent = document.getElementById("readable-content");

    if (!readableContent) return;

    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const readableElements = readableContent.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (
        tagName !== "button" &&
        tagName !== "a" &&
        tagName !== "input" &&
        tagName !== "textarea" &&
        tagName !== "select"
      ) {
        element.removeAttribute("tabindex");
      }

      if (!isVisible(element)) return;

      let textToRead = "";

      if (tagName === "img") {
        textToRead = element.getAttribute("alt") || "";
      } else if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        textToRead =
          element.getAttribute("aria-label") ||
          element.placeholder ||
          element.name ||
          element.id ||
          "Input field";
      } else {
        textToRead =
          element.getAttribute("aria-label") ||
          element.innerText ||
          element.textContent ||
          "";
      }

      if (!textToRead.trim()) return;

      if (
        tagName !== "button" &&
        tagName !== "a" &&
        tagName !== "input" &&
        tagName !== "textarea" &&
        tagName !== "select"
      ) {
        element.setAttribute("tabindex", "0");
      }

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", textToRead.trim());
      }
    });
  }, []);

  return (
    <>
      <Navbar />

      <div className="pw-wrapper" id="readable-content">
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
                <button aria-label="Standard">STANDARD</button>
              </div>

              <div className="pw-standard-desc">
                <p>
                  Matcha soirée: a gathering to learn and enjoy matcha with the community!
                </p>

                <ul className="pw-workshop-tier-list">
                  <li>Full workshop experience no kit included</li>
                  <li>Bring your own matcha tools</li>
                  <li>
                    Please indicate if you don't have your own kit and prefer not to purchase the premium package
                  </li>
                </ul>
              </div>
            </div>

            <div className="pw-premium-tier">
              <div className="pw-premium-button">
                <button aria-label="Premium">PREMIUM</button>
              </div>

              <div className="pw-premium-desc">
                <p>
                  Matcha soirée: a gathering to learn and enjoy matcha with the community!
                </p>

                <ul className="pw-workshop-tier-list">
                  <li>Full workshop experience no kit included</li>
                  <li>
                    Includes a basic matcha kit to take home:
                    Chawan bowl, Chasen whisk, Chashaku scoop, and
                    Chasen rest stand
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pw-book-button">
            <Link to="/calendar?type=workshop" aria-label="Book now">
              <button aria-label="Book now">BOOK NOW</button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}