import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/workshop-signup.scoped.css";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const t = timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr;
  const d = new Date(`1970-01-01T${t}:00`);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function timeRange(start, end) {
  if (!start) return "";
  if (!end) return formatTime(start);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function posterSrc(path) {
  const fallback = "/pics/default-workshop.jpg";
  if (!path) return fallback;
  if (/^https?:\/\//i.test(path)) return path;

  const clean = String(path).trim().replace(/^\/+/, "");

  if (clean.startsWith("uploads/")) {
    return `/api/${clean}`;
  }

  return `/${clean}`;
}

export default function WorkshopSignup() {
  const navigate = useNavigate();

  const [tab, setTab] = useState("upcoming");
  const [data, setData] = useState({ workshops: [], hasMaxSlots: false });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    setErrorMsg("");

    API.get("/bookings/public-workshop/public-list.php", {
      params: { scope: tab },
    })
      .then((res) => {
        setData({
          workshops: Array.isArray(res.data?.workshops) ? res.data.workshops : [],
          hasMaxSlots: !!res.data?.hasMaxSlots,
        });
      })
      .catch((err) => {
        console.error("Failed to load workshops:", err);
        console.error("Response data:", err.response?.data);
        setData({ workshops: [], hasMaxSlots: false });
        setErrorMsg(err.response?.data?.message || "Failed to load workshops.");
      })
      .finally(() => setLoading(false));
  }, [tab]);

  const sectionTitle = tab === "past" ? "Past Workshops" : "Coming Soon";
  const emptyMsg =
    tab === "past"
      ? "No past workshops found."
      : "No upcoming workshops yet. Please check back soon.";

  return (
    <>
      <Navbar />

      <div className="ws-signup-page">
        <div className="ws-signup-wrap">
          <h1 className="ws-signup-heading">Workshops</h1>

          <div className="ws-signup-sub">
            {tab === "past"
              ? "Browse past workshops. Click any workshop to view full details."
              : "Explore upcoming workshops. Click any “Coming Soon” workshop to view full details."}
          </div>

          <div className="ws-signup-tabs">
            <button
              type="button"
              className={`ws-signup-tab ${tab === "upcoming" ? "is-active" : ""}`}
              onClick={() => setTab("upcoming")}
            >
              Upcoming
            </button>

            <button
              type="button"
              className={`ws-signup-tab ${tab === "past" ? "is-active" : ""}`}
              onClick={() => setTab("past")}
            >
              Past Workshops
            </button>
          </div>

          <div className="ws-signup-section-title">{sectionTitle}</div>

          {loading ? (
            <div className="ws-signup-sub">Loading workshops...</div>
          ) : errorMsg ? (
            <div className="ws-signup-sub">{errorMsg}</div>
          ) : data.workshops.length === 0 ? (
            <div className="ws-signup-sub">{emptyMsg}</div>
          ) : (
            <div className="ws-signup-grid">
              {data.workshops.map((w) => {
                const wid = Number(w.id);
                const maxSlots = data.hasMaxSlots ? Number(w.max_slots || 0) : 0;
                const taken = Number(w.taken || 0);

                let slotsLeft = null;
                if (data.hasMaxSlots && maxSlots > 0) {
                  slotsLeft = Math.max(0, maxSlots - taken);
                }

                const dateStr = formatDate(w.workshop_date);
                const timeStr = timeRange(w.start_time, w.end_time);
                const locStr = w.location || "";

                return (
                  <a
                    key={wid}
                    className="ws-signup-card"
                    href={`/public-workshops/${wid}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/public-workshops/${wid}`);
                    }}
                    aria-label={`View workshop: ${w.title || "Workshop"}`}
                  >
                    <img
                      className="ws-signup-poster"
                      src={posterSrc(w.poster_path)}
                      loading="lazy"
                      alt={`${w.title || "Workshop"} poster`}
                      onError={(e) => {
                        e.currentTarget.src = "/pics/default-workshop.jpg";
                      }}
                    />

                    <div className="ws-signup-card-content">
                      <div className="ws-signup-pill-row">
                        <div className="ws-signup-pill">
                          {tab === "past" ? "Past" : "Coming Soon"}
                        </div>

                        {tab !== "past" &&
                          slotsLeft !== null &&
                          (slotsLeft <= 0 ? (
                            <div className="ws-signup-pill is-full">FULL</div>
                          ) : (
                            <div className="ws-signup-pill is-left">
                              {slotsLeft} slots left
                            </div>
                          ))}
                      </div>

                      <div className="ws-signup-card-title">
                        {w.title || "Workshop"}
                      </div>

                      <div className="ws-signup-meta">
                        {dateStr && (
                          <>
                            Date: {dateStr}
                            <br />
                          </>
                        )}
                        {timeStr && (
                          <>
                            Time: {timeStr}
                            <br />
                          </>
                        )}
                        {locStr && <>Location: {locStr}</>}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}