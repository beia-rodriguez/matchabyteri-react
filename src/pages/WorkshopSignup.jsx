import { useEffect, useReducer, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/workshop-signup.scoped.css";
import "../assets/css/universal.css";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const workshopSignupInitialState = {
  data: {
    workshops: [],
    hasMaxSlots: false,
  },
  loading: true,
  errorMsg: "",
};

function workshopSignupReducer(state, action) {
  switch (action.type) {
    case "loading":
      return {
        data: {
          workshops: [],
          hasMaxSlots: false,
        },
        loading: true,
        errorMsg: "",
      };

    case "success":
      return {
        data: {
          workshops: action.workshops,
          hasMaxSlots: action.hasMaxSlots,
        },
        loading: false,
        errorMsg: "",
      };

    case "error":
      return {
        data: {
          workshops: [],
          hasMaxSlots: false,
        },
        loading: false,
        errorMsg: action.message,
      };

    default:
      return state;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  return DATE_FORMATTER.format(d);
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const t = timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr;
  const d = new Date(`1970-01-01T${t}:00`);
  return TIME_FORMATTER.format(d);
}

function timeRange(start, end) {
  if (!start) return "";
  if (!end) return formatTime(start);
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function posterSrc(path) {
  const fallback = "/pics/default-workshop.jpg";
  if (!path) return fallback;

  const rawPath = String(path).trim();
  if (!rawPath) return fallback;

  if (/^https?:\/\//i.test(rawPath)) return rawPath;

  const clean = rawPath.replace(/^\/+/, "");

  if (clean.startsWith("backend/api/")) {
    return `/${clean}`;
  }

  if (clean.startsWith("uploads/")) {
    return `/backend/api/${clean}`;
  }

  return `/backend/api/uploads/${clean}`;
}

export default function WorkshopSignup() {
  const [tab, setTab] = useState("upcoming");
  const [selectedPoster, setSelectedPoster] = useState(null);
  const [pageState, dispatchPageState] = useReducer(
    workshopSignupReducer,
    workshopSignupInitialState
  );

  const { data, loading, errorMsg } = pageState;

  useEffect(() => {
    let ignore = false;

    dispatchPageState({ type: "loading" });

    API.get("/bookings/public-workshop/public-list.php", {
      params: { scope: tab },
    })
      .then((res) => {
        if (ignore) return;

        dispatchPageState({
          type: "success",
          workshops: Array.isArray(res.data?.workshops)
            ? res.data.workshops
            : [],
          hasMaxSlots: !!res.data?.hasMaxSlots,
        });
      })
      .catch((err) => {
        if (ignore) return;

        console.error("Failed to load workshops:", err);
        console.error("Response data:", err.response?.data);

        dispatchPageState({
          type: "error",
          message: err.response?.data?.message || "Failed to load workshops.",
        });
      });

    return () => {
      ignore = true;
    };
  }, [tab]);

  useEffect(() => {
    if (!selectedPoster) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedPoster(null);
      }
    };

    document.body.classList.add("ws-signup-modal-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("ws-signup-modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPoster]);

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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .ws-signup-heading, .ws-signup-sub, .ws-signup-section-title, .ws-signup-pill, .ws-signup-card-title, .ws-signup-meta"
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
  }, [tab, data, loading, errorMsg, selectedPoster]);

  const sectionTitle = tab === "past" ? "Past Workshops" : "Coming Soon";
  const emptyMsg =
    tab === "past"
      ? "No past workshops found."
      : "No upcoming workshops yet. Please check back soon.";

  return (
    <>
      <Navbar />

      <div className="ws-signup-page" id="readable-content">
        <div className="ws-signup-wrap">
          <h1 className="ws-signup-heading">Workshops</h1>

          <div className="ws-signup-sub">
            {tab === "past"
              ? "Browse past workshops. Click any workshop to view full details."
              : "Explore upcoming workshops. Click any workshop to view full details. Click the poster to preview it larger."}
          </div>

          <div className="ws-signup-tabs">
            <button
              type="button"
              className={`ws-signup-tab ${
                tab === "upcoming" ? "is-active" : ""
              }`}
              onClick={() => setTab("upcoming")}
            >
              Upcoming
            </button>

            <button
              type="button"
              className={`ws-signup-tab ${
                tab === "past" ? "is-active" : ""
              }`}
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
                const maxSlots = data.hasMaxSlots
                  ? Number(w.max_slots || 0)
                  : 0;
                const taken = Number(w.taken || 0);

                let slotsLeft = null;
                if (data.hasMaxSlots && maxSlots > 0) {
                  slotsLeft = Math.max(0, maxSlots - taken);
                }

                const dateStr = formatDate(w.workshop_date);
                const timeStr = timeRange(w.start_time, w.end_time);
                const locStr = w.location || "";
                const title = w.title || "Workshop";
                const imageSrc = posterSrc(w.poster_path);

                return (
                  <article key={wid} className="ws-signup-card">
                    <button
                      type="button"
                      className="ws-signup-poster-button"
                      onClick={() =>
                        setSelectedPoster({
                          src: imageSrc,
                          alt: `${title} poster`,
                          title,
                        })
                      }
                      aria-label={`Preview poster for ${title}`}
                    >
                      <img
                        className="ws-signup-poster"
                        src={imageSrc}
                        loading="lazy"
                        alt={`${title} poster`}
                        onError={(e) => {
                          e.currentTarget.src = "/pics/default-workshop.jpg";
                        }}
                      />

                      <span className="ws-signup-image-hint">
                        Click to view larger
                      </span>
                    </button>

                    <Link
                      className="ws-signup-card-content"
                      to={`/public-workshops/${wid}`}
                      aria-label={`View workshop: ${title}`}
                    >
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

                      <div className="ws-signup-card-title">{title}</div>

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
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {selectedPoster && (
          <div
            className="ws-signup-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedPoster.title} poster preview`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedPoster(null);
              }
            }}
          >
            <div className="ws-signup-modal-panel">
              <div className="ws-signup-modal-top">
                <div className="ws-signup-modal-title">
                  {selectedPoster.title}
                </div>

                <button
                  type="button"
                  className="ws-signup-modal-close"
                  onClick={() => setSelectedPoster(null)}
                  aria-label="Close poster preview"
                >
                  ×
                </button>
              </div>

              <img
                className="ws-signup-modal-image"
                src={selectedPoster.src}
                alt={selectedPoster.alt}
                onError={(e) => {
                  e.currentTarget.src = "/pics/default-workshop.jpg";
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}