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
  const [activeTab, setActiveTab] = useState(type === "both" ? "event" : type);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isValidDate = (value) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const parsed = new Date(`${value}T00:00:00`);
    return !Number.isNaN(parsed.getTime());
  };

  const getSafeStatusClass = (status = "") => {
    return String(status)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-");
  };

  useEffect(() => {
    if (!isValidDate(date)) {
      navigate("/calendar");
      return;
    }

    let isMounted = true;

    setLoading(true);
    setError("");

    API.get("/calendar/day-data.php", {
      params: { date },
    })
      .then((res) => {
        if (!isMounted) return;

        const safeData = {
          ...res.data,
          bookings_event: Array.isArray(res.data.bookings_event)
            ? res.data.bookings_event
            : [],
          bookings_workshop: Array.isArray(res.data.bookings_workshop)
            ? res.data.bookings_workshop
            : [],
        };

        setData(safeData);
      })
      .catch((err) => {
        if (!isMounted) return;

        if (err.response?.status === 401) {
          navigate(
            `/login?redirect=${encodeURIComponent(
              `/day?date=${date}&type=${type}`
            )}`
          );
          return;
        }

        setError("Sorry, this day could not be loaded. Please try again.");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [date, navigate, type]);

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
      [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "label",
        "input",
        "textarea",
        "select",
        "button",
        "img",
        "a",
        "li",
        ".voice-readable",
        ".day-title",
        ".day-year",
        ".day-booking-pill",
        ".day-booking-name",
        ".day-booking-time",
        ".day-status",
        ".day-note",
        ".day-alert",
      ].join(", ")
    );

    readableElements.forEach((element) => {
      if (element.closest(".accessibility-bubble-wrapper")) return;

      const tagName = element.tagName.toLowerCase();

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

      element.classList.add("voice-readable");

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", textToRead.trim());
      }
    });
  }, [data, activeTab, type, loading, error]);

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

  const renderBookingList = (bookings, bookingType) => {
    if (!bookings.length) {
      return (
        <div
          className="day-note voice-readable"
          tabIndex="0"
          aria-label={`No ${bookingType}s yet for this day.`}
        >
          No {bookingType}s yet for this day.
        </div>
      );
    }

    return bookings.map((booking, index) => {
      const status = booking.status || "";
      const safeStatusClass = getSafeStatusClass(status);

      const readableLabel = `${bookingType}. ${data.monthDay}, ${data.year}.${
        booking.start_time
          ? ` Time: ${booking.start_time} to ${booking.end_time}.`
          : ""
      }${status ? ` Status: ${status}.` : ""}`;

      return (
        <div
          key={`${bookingType}-${index}`}
          className="day-booking-pill voice-readable"
          tabIndex="0"
          aria-label={readableLabel}
        >
          <div className="day-booking-main">
            <div className="day-booking-name">
              {bookingType === "event" ? "Event" : "Workshop"} •{" "}
              {data.monthDay}, {data.year}
            </div>

            {booking.start_time && (
              <div className="day-booking-time">
                {booking.start_time} - {booking.end_time}
              </div>
            )}
          </div>

          {status && (
            <div
              className={`day-status status-${safeStatusClass}`}
              aria-label={`Status: ${status}`}
            >
              {status}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <Navbar />

      <main
        className="day-page"
        id="readable-content"
        aria-label="Selected day booking page"
      >
        <section className="day-top" aria-label="Day navigation">
          <button
            type="button"
            className="day-back"
            aria-label="Back to calendar"
            onClick={handleBack}
          >
            <img src="/images/left-book.png" alt="" aria-hidden="true" />
          </button>

          <h1
            className="day-title voice-readable"
            tabIndex="0"
            aria-label={data ? `Selected date ${data.monthDay}` : "Selected date"}
          >
            {data?.monthDay || "Loading"}
          </h1>

          <div
            className="day-year voice-readable"
            tabIndex="0"
            aria-label={data ? `Year ${data.year}` : "Year loading"}
          >
            {data?.year || ""}
          </div>
        </section>

        <section className="day-panel" aria-label="Bookings for selected day">
          {loading && (
            <div
              className="day-alert voice-readable"
              role="status"
              tabIndex="0"
              aria-label="Loading day details"
            >
              Loading day details...
            </div>
          )}

          {error && (
            <div
              className="day-alert day-alert-error voice-readable"
              role="alert"
              tabIndex="0"
              aria-label={error}
            >
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              <h2
                className="day-heading voice-readable"
                tabIndex="0"
                aria-label={data.heading}
              >
                {data.heading}
              </h2>

              {type === "both" && (
                <div
                  className="day-toggle-row"
                  role="tablist"
                  aria-label="Choose booking type"
                >
                  <button
                    type="button"
                    className={`day-toggle-btn ${
                      activeTab === "event" ? "active" : ""
                    }`}
                    role="tab"
                    aria-selected={activeTab === "event"}
                    aria-controls="event-section"
                    id="event-tab"
                    onClick={() => setActiveTab("event")}
                  >
                    Events
                  </button>

                  <button
                    type="button"
                    className={`day-toggle-btn ${
                      activeTab === "workshop" ? "active" : ""
                    }`}
                    role="tab"
                    aria-selected={activeTab === "workshop"}
                    aria-controls="workshop-section"
                    id="workshop-tab"
                    onClick={() => setActiveTab("workshop")}
                  >
                    Workshops
                  </button>
                </div>
              )}

              {showEvent && (
                <section
                  id="event-section"
                  className="day-section show"
                  role={type === "both" ? "tabpanel" : "region"}
                  aria-labelledby={type === "both" ? "event-tab" : undefined}
                  aria-label={type !== "both" ? "Events" : undefined}
                >
                  {!data.eventFullyBooked && (
                    <button
                      type="button"
                      className="day-add-pill"
                      aria-label="Book Event"
                      onClick={() => goToReminder("event")}
                    >
                      <span className="day-plus" aria-hidden="true">
                        ＋
                      </span>
                      Book Event
                    </button>
                  )}

                  {data.eventFullyBooked && (
                    <div
                      className="day-note voice-readable"
                      tabIndex="0"
                      aria-label="Events are fully booked for this day."
                    >
                      Events are fully booked for this day.
                    </div>
                  )}

                  {renderBookingList(data.bookings_event, "event")}
                </section>
              )}

              {showWorkshop && (
                <section
                  id="workshop-section"
                  className="day-section show"
                  role={type === "both" ? "tabpanel" : "region"}
                  aria-labelledby={type === "both" ? "workshop-tab" : undefined}
                  aria-label={type !== "both" ? "Workshops" : undefined}
                >
                  {!data.workshopFullyBooked && (
                    <button
                      type="button"
                      className="day-add-pill"
                      aria-label="Book Workshop"
                      onClick={() => goToReminder("workshop")}
                    >
                      <span className="day-plus" aria-hidden="true">
                        ＋
                      </span>
                      Book Workshop
                    </button>
                  )}

                  {data.workshopFullyBooked && (
                    <div
                      className="day-note voice-readable"
                      tabIndex="0"
                      aria-label="Workshops are fully booked for this day."
                    >
                      Workshops are fully booked for this day.
                    </div>
                  )}

                  {renderBookingList(data.bookings_workshop, "workshop")}
                </section>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}