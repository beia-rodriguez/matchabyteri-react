import { useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "../assets/css/home.css";
import "../assets/css/universal.css";

function Home() {
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
      "h1, h2, h3, h4, h5, h6, p, button, img, a, li"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (tagName !== "button" && tagName !== "a") {
        element.removeAttribute("tabindex");
      }

      if (!isVisible(element)) return;

      let textToRead = "";

      if (tagName === "img") {
        textToRead = element.getAttribute("alt") || "";
      } else {
        textToRead =
          element.getAttribute("aria-label") ||
          element.innerText ||
          element.textContent ||
          "";
      }

      if (!textToRead.trim()) return;

      if (tagName !== "button" && tagName !== "a") {
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

      <section>
        <div className="image-wrap">
          <img
            src="/images/MBT_white 1.png"
            alt="Matcha By Teri Logo Banner"
            tabIndex="0"
          />

          <div className="text-box">
            <p tabIndex="0">Learn about the greens</p>
            <p tabIndex="0">(not the ones you're thinking of, the good stuff)</p>
          </div>
        </div>
      </section>

      <div id="readable-content">
        <section className="welcome-section">
          <div className="welcome-inner">
            <div className="welcome-text">
              <h2 tabIndex="0">Welcome!</h2>

              <p tabIndex="0">
                Welcome to MatchabyTeri, where every sip tells a story. We’re
                passionate about sharing the art of matcha through private workshops
                and exclusive events. Whether you’re new to matcha or a long-time
                enthusiast, our experiences are designed to connect you with the calm,
                beauty, and flavor of this traditional Japanese tea.
              </p>

              <Link
                to="/calendar?type=workshop"
                className="welcome-btn"
                aria-label="Book now"
              >
                Book now
              </Link>
            </div>

            <div className="welcome-image-wrap">
              <img
                src="/images/matchacoffee1.png"
                alt="Image of a delicious Matcha drink"
                className="welcome-image"
                tabIndex="0"
              />
            </div>
          </div>

          <div className="welcome-pill">
            <p tabIndex="0">
              We bring together everything you love about matcha — its calming
              beauty, delicious taste, and meaningful tradition.
            </p>
          </div>
        </section>

        <section className="services-section">
          <div className="m-w">
            <p tabIndex="0">OUR DELICIOUS SERVICES</p>
          </div>

          <div className="workshop-inner">
            <div className="workshop-image-wrap">
              <img
                src="/images/1st pic 1.png"
                alt="Image of a Matcha drink for workshops"
                className="workshop-image"
                tabIndex="0"
              />
            </div>

            <div className="workshop-text">
              <h2 tabIndex="0">
                <span className="black-text">Matcha</span> Workshops
              </h2>

              <p tabIndex="0">
                We host private workshops where you can learn how to prepare,
                whisk, and enjoy authentic matcha the traditional way.
              </p>

              <Link
                to="/private-workshop"
                className="workshop-btn"
                aria-label="Learn more about Matcha Workshops"
              >
                Learn more
              </Link>
            </div>
          </div>

          <div className="welcome-inner">
            <div className="welcome-text">
              <h2 tabIndex="0">
                <span className="black-text">Custom</span> Events
              </h2>

              <p tabIndex="0">
                We host private workshops where you can learn how to prepare,
                whisk, and enjoy authentic matcha the traditional way.
              </p>

              <Link
                to="/calendar?type=event"
                className="welcome-btn"
                aria-label="Learn more about Custom Events"
              >
                Learn more
              </Link>
            </div>

            <div className="welcome-image-wrap">
              <img
                src="/images/2nd pic 1.png"
                alt="Image of a Matcha drink for events"
                className="welcome-image"
                tabIndex="0"
              />
            </div>
          </div>

          <div className="welcome-inner">
            <div className="welcome-text">
              <h2 id="matcha" tabIndex="0">
                Matcha
              </h2>

              <h2 id="creations" tabIndex="0">
                Creations
              </h2>

              <p tabIndex="0">
                Book now to try our delicious matcha to experience the good green
                stuff, not one you're thinking of.
              </p>

              <Link
                to="/about"
                className="welcome-btn"
                aria-label="Learn more about Matcha Creations"
              >
                Learn more
              </Link>
            </div>

            <div className="welcome-image-wrap">
              <img
                src="/images/lastpicmain.png"
                alt="Image of our final Matcha creation"
                className="last-image"
                tabIndex="0"
              />
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}

export default Home;