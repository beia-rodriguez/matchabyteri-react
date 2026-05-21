import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/day.css";
import "../assets/css/universal.css";

export default function Day() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const date = searchParams.get("date");
  const typeParam = searchParams.get("type") || "both";

  const type = ["event", "workshop", "both"].includes(typeParam)
    ? typeParam
    : "both";

  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState(
    type === "both" ? "event" : type
  );

  useEffect(() => {
    if (!date) {
      navigate("/calendar");
      return;
    }

    API.get("/calendar/day-data.php", {
      params: { date }
    })
      .then(res => {
        const safeData = {
          ...res.data,
          bookings_event: Array.isArray(res.data.bookings_event)
            ? res.data.bookings_event
            : [],
          bookings_workshop: Array.isArray(res.data.bookings_workshop)
            ? res.data.bookings_workshop
            : []
        };

        setData(safeData);
      })
      .catch(err => {
        if (err.response?.status === 401) {
          navigate("/login");
        }
      });
  }, [date, navigate]);

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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .day-title, .day-year, .booking-pill, .name, .time, .status, .note"
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
  }, [data, activeTab, type]);

  if (!data) return null;

  const handleBack = () => {
    navigate(`/calendar?type=${type}`);
  };

  const goToReminder = (bookingType) => {
    navigate(`/reminder?date=${date}&type=${bookingType}`);
  };

  const showEvent =
    type === "event" || (type === "both" && activeTab === "event");

  const showWorkshop =
    type === "workshop" || (type === "both" && activeTab === "workshop");

  return (
    <>
      <Navbar />

      <div className="day-page" id="readable-content">
        <div className="day-top">
          <button
            className="back"
            aria-label="Back to calendar"
            onClick={handleBack}
          >
            <img src="/images/left-book.png" alt="" aria-hidden="true" />
          </button>

          <div className="day-title">{data.monthDay}</div>
          <div className="day-year">{data.year}</div>
        </div>

        <div className="panel">
          <h2>{data.heading}</h2>

          {type === "both" && (
            <div className="toggle-row">
              <button
                className={`toggle-btn ${
                  activeTab === "event" ? "active" : ""
                }`}
                aria-label="Events"
                onClick={() => setActiveTab("event")}
              >
                Events
              </button>

              <button
                className={`toggle-btn ${
                  activeTab === "workshop" ? "active" : ""
                }`}
                aria-label="Workshops"
                onClick={() => setActiveTab("workshop")}
              >
                Workshops
              </button>
            </div>
          )}

          {showEvent && (
            <>
              {!data.eventFullyBooked && (
                <button
                  className="add-pill"
                  aria-label="Book Event"
                  onClick={() => goToReminder("event")}
                >
                  ＋ Book Event
                </button>
              )}

              {data.bookings_event.length > 0 ? (
                data.bookings_event.map((b, i) => (
                  <div
                    key={i}
                    className="booking-pill"
                    aria-label={`Event. ${data.monthDay}, ${data.year}.${
                      b.start_time ? ` Time: ${b.start_time} to ${b.end_time}.` : ""
                    }${b.status ? ` Status: ${b.status}.` : ""}`}
                  >
                    <div className="name">
                      Event • {data.monthDay}, {data.year}
                    </div>

                    {b.start_time && (
                      <div className="time">
                        {b.start_time} - {b.end_time}
                      </div>
                    )}

                    {b.status && (
                      <div
                        className={`status ${b.status}`}
                        aria-label={`Status: ${b.status}`}
                      >
                        {b.status}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="note">
                  No events yet for this day.
                </div>
              )}
            </>
          )}

          {showWorkshop && (
            <>
              {!data.workshopFullyBooked && (
                <button
                  className="add-pill"
                  aria-label="Book Workshop"
                  onClick={() => goToReminder("workshop")}
                >
                  ＋ Book Workshop
                </button>
              )}

              {data.bookings_workshop.length > 0 ? (
                data.bookings_workshop.map((b, i) => (
                  <div
                    key={i}
                    className="booking-pill"
                    aria-label={`Workshop. ${data.monthDay}, ${data.year}.${
                      b.start_time ? ` Time: ${b.start_time} to ${b.end_time}.` : ""
                    }${b.status ? ` Status: ${b.status}.` : ""}`}
                  >
                    <div className="name">
                      Workshop • {data.monthDay}, {data.year}
                    </div>

                    {b.start_time && (
                      <div className="time">
                        {b.start_time} - {b.end_time}
                      </div>
                    )}

                    {b.status && (
                      <div
                        className={`status ${b.status}`}
                        aria-label={`Status: ${b.status}`}
                      >
                        {b.status}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="note">
                  No workshops yet for this day.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}