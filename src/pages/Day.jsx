import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/day.css";

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

      <div className="day-page">
        <div className="day-top">
          <button className="back" onClick={handleBack}>
            <img src="/images/left-book.png" alt="Back" />
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
                onClick={() => setActiveTab("event")}
              >
                Events
              </button>

              <button
                className={`toggle-btn ${
                  activeTab === "workshop" ? "active" : ""
                }`}
                onClick={() => setActiveTab("workshop")}
              >
                Workshops
              </button>
            </div>
          )}

          {/* ================= EVENTS ================= */}
          {showEvent && (
            <>
              {!data.eventFullyBooked && (
                <button
                  className="add-pill"
                  onClick={() => goToReminder("event")}
                >
                  ＋ Book Event
                </button>
              )}

              {data.bookings_event.length > 0 ? (
                data.bookings_event.map((b, i) => (
                  <div key={i} className="booking-pill">
                    <div className="name">
                      Event • {data.monthDay}, {data.year}
                    </div>

                    {b.start_time && (
                      <div className="time">
                        {b.start_time} - {b.end_time}
                      </div>
                    )}

                    {b.status && (
                      <div className={`status ${b.status}`}>
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

          {/* ================= WORKSHOPS ================= */}
          {showWorkshop && (
            <>
              {!data.workshopFullyBooked && (
                <button
                  className="add-pill"
                  onClick={() => goToReminder("workshop")}
                >
                  ＋ Book Workshop
                </button>
              )}

              {data.bookings_workshop.length > 0 ? (
                data.bookings_workshop.map((b, i) => (
                  <div key={i} className="booking-pill">
                    <div className="name">
                      Workshop • {data.monthDay}, {data.year}
                    </div>

                    {b.start_time && (
                      <div className="time">
                        {b.start_time} - {b.end_time}
                      </div>
                    )}

                    {b.status && (
                      <div className={`status ${b.status}`}>
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