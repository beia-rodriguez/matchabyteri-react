import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../assets/css/reminder.css";
import "../assets/css/universal.css";
import { useEffect } from "react";

export default function Reminder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const dateParam = searchParams.get("date");
  const typeParam = searchParams.get("type") || "both";

  useEffect(() => {
    if (!dateParam) {
      navigate("/calendar");
    }
  }, [dateParam, navigate]);

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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .reminder-title, .reminder-year"
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
  }, [dateParam, typeParam]);

  if (!dateParam) return null;

  const type = ["event", "workshop", "both"].includes(typeParam)
    ? typeParam
    : "both";

  const dateObj = new Date(dateParam);
  const monthDay = dateObj.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const year = dateObj.getFullYear();

  const handleBack = () => {
    navigate(`/day?date=${dateParam}&type=${type}`);
  };

  const handleNext = () => {
    if (type === "workshop") {
      navigate(`/add-workshop-booking?date=${dateParam}&type=workshop`);
    } else {
      navigate(`/add-booking?date=${dateParam}&type=event`);
    }
  };

  return (
    <>
      <Navbar />

      <div className="reminder-page" id="readable-content">
        <div className="reminder-top">
          <button
            className="back"
            aria-label="Back"
            onClick={handleBack}
          >
            <img src="/images/left-book.png" alt="" aria-hidden="true" />
          </button>

          <div className="reminder-title">{monthDay}</div>
          <div className="reminder-year">{year}</div>
        </div>

        <div className="panel">
          <div>
            <h2>Reminders!</h2>

            <div className="bullets">
              <ul>
                <li>Please book 2 weeks ahead of the event date</li>
                <li>
                  The final quote will be provided after confirmation of the
                  venue
                </li>
                <li>
                  50% deposit is due upon booking confirmation. Remaining
                  balance is payable 2–3 days before the event
                </li>
                <li>
                  Cancellations 7 days prior the event are eligible for a full
                  deposit refund. Cancellations in less than 7 days will
                  forfeit the deposit.
                </li>
              </ul>
            </div>
          </div>

          <div className="actions">
            <button
              className="btn-next"
              aria-label="Next"
              onClick={handleNext}
            >
              NEXT
            </button>
          </div>
        </div>
      </div>
    </>
  );
}