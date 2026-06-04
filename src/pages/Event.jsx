import { useEffect } from "react";
import "../assets/css/event.css";
import "../assets/css/universal.css";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Event() {
  useEffect(() => {
    const readableContent = document.getElementById("readable-content");

    if (!readableContent) return;

    // Piece-by-piece only.
    // Do not include div or span to avoid double reading.
    const readableElements = readableContent.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, button, img, a, li"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      // Buttons and links are naturally tabbable.
      if (tagName !== "button" && tagName !== "a") {
        element.setAttribute("tabindex", "0");
      }

      // Add readable label for screen reader / voice reader.
      if (!element.getAttribute("aria-label")) {
        let textToRead = "";

        if (tagName === "img") {
          textToRead = element.getAttribute("alt") || "Image";
        } else {
          textToRead = element.innerText || element.textContent || "";
        }

        if (textToRead.trim() !== "") {
          element.setAttribute("aria-label", textToRead.trim());
        }
      }
    });
  }, []);

  return (
    <>
      <Navbar />

      <div id="readable-content" className="event-page">
        <section className="event-page__book-section-text">
          <p>Book a private event with us!</p>

          <div className="event-page__image-grid">
            <img
              src="/images/about-matcha-2.png"
              alt="Matcha preparation for private event"
            />

            <img
              src="/images/about-matcha-1.png"
              alt="Matcha drink for private event"
            />

            <img
              src="/images/menu-1.png"
              alt="Private event matcha menu"
            />
          </div>

          <p className="event-page__event-text">
            After the success of our Pop Up Event with Safe Space Club Pilates,
            we can’t wait to help you host your own unforgettable experience. BOOK NOW!
          </p>
        </section>

        <section className="event-page__details-section">
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
            <li>
              Exclusions: <span>Transportation, toll fees</span>
            </li>
          </ul>

          <div className="event-page__book-button">
            <Link to="/calendar?type=event" aria-label="Book private event">
              <button type="button">BOOK HERE</button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
