import { useEffect, useMemo, useReducer } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/workshop-view.scoped.css";
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

const workshopViewInitialState = {
  workshop: null,
  loading: true,
  errorMsg: "",
};

function workshopViewReducer(state, action) {
  switch (action.type) {
    case "loading":
      return {
        workshop: null,
        loading: true,
        errorMsg: "",
      };

    case "success":
      return {
        workshop: action.workshop,
        loading: false,
        errorMsg: "",
      };

    case "error":
      return {
        workshop: null,
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

function isPastDate(dateStr) {
  if (!dateStr) return false;

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const workshopDate = new Date(`${dateStr}T00:00:00`);

  return workshopDate < todayDateOnly;
}

function posterSrc(path) {
  const fallback = "/pics/default-workshop.jpg";

  if (!path) return fallback;

  const rawPath = String(path).trim();

  if (!rawPath) return fallback;

  let clean = rawPath.replace(/\\/g, "/");

  if (/^https?:\/\//i.test(clean)) {
    clean = clean.replace(
      "/backend/uploads/workshops/",
      "/backend/api/uploads/workshops/"
    );

    return clean;
  }

  clean = clean.replace(/^\/+/, "");

  if (clean.startsWith("backend/api/uploads/")) {
    return `/${clean}`;
  }

  if (clean.startsWith("backend/uploads/")) {
    return `/${clean.replace("backend/uploads/", "backend/api/uploads/")}`;
  }

  if (clean.startsWith("uploads/")) {
    return `/backend/api/${clean}`;
  }

  if (clean.startsWith("workshops/")) {
    return `/backend/api/uploads/${clean}`;
  }

  return `/backend/api/uploads/workshops/${clean}`;
}

export default function WorkshopView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pageState, dispatchPageState] = useReducer(
    workshopViewReducer,
    workshopViewInitialState
  );

  const { workshop, loading, errorMsg } = pageState;

  useEffect(() => {
    let ignore = false;

    dispatchPageState({ type: "loading" });

    API.get("/bookings/public-workshop/public-detail.php", {
      params: { id },
    })
      .then((res) => {
        if (ignore) return;

        if (!res.data?.workshop) {
          dispatchPageState({
            type: "error",
            message: "Workshop not found.",
          });
          return;
        }

        dispatchPageState({
          type: "success",
          workshop: res.data.workshop,
        });
      })
      .catch((err) => {
        if (ignore) return;

        console.error("Failed to load workshop detail:", err);
        console.error("Response data:", err.response?.data);

        dispatchPageState({
          type: "error",
          message: err.response?.data?.message || "Failed to load workshop.",
        });
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  const workshopDetails = useMemo(() => {
    if (!workshop) {
      return {
        description: "",
        dateText: "",
        timeText: "",
        locationText: "",
        posterImage: "/pics/default-workshop.jpg",
      };
    }

    return {
      description: String(workshop.description || "").trim(),
      dateText: formatDate(workshop.workshop_date),
      timeText: timeRange(workshop.start_time, workshop.end_time),
      locationText: String(workshop.location || "").trim(),
      posterImage: posterSrc(workshop.poster_url || workshop.poster_path),
    };
  }, [workshop]);

  const isPast = useMemo(() => {
    if (!workshop) return false;

    return isPastDate(workshop.workshop_date);
  }, [workshop]);

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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .wsv-status, .wsv-eyebrow, .wsv-title, .wsv-description, .wsv-detail-label, .wsv-detail-value, .wsv-note"
    );

    readableElements.forEach((element) => {
      const tagName = String(element.tagName || "").toLowerCase();

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
  }, [loading, errorMsg, workshop, workshopDetails, isPast]);

  if (loading) {
    return (
      <>
        <Navbar />

        <div className="wsv-page" id="readable-content">
          <main className="wsv-section">
            <div className="wsv-state-card">
              <div className="wsv-status">Loading workshop details...</div>
            </div>
          </main>
        </div>
      </>
    );
  }

  if (errorMsg || !workshop) {
    return (
      <>
        <Navbar />

        <div className="wsv-page" id="readable-content">
          <main className="wsv-section">
            <div className="wsv-state-card">
              <div className="wsv-status">
                {errorMsg || "Workshop not found."}
              </div>

              <div className="wsv-actionRow">
                <Link className="wsv-backLink" to="/public-workshops">
                  Back to workshops
                </Link>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="wsv-page" id="readable-content">
        <main className="wsv-section">
          <div className="wsv-inner">
            <aside className="wsv-mediaCol" aria-label="Workshop poster">
              <div className="wsv-imageWrap">
                <img
                  className="wsv-image"
                  src={workshopDetails.posterImage}
                  alt={workshop.title || "Workshop poster"}
                  onError={(e) => {
                    e.currentTarget.src = "/pics/default-workshop.jpg";
                  }}
                />
              </div>
            </aside>

            <section className="wsv-contentCol">
              <div className="wsv-eyebrow">
                {isPast ? "Past Workshop" : "Upcoming Workshop"}
              </div>

              <h1 className="wsv-title">{workshop.title}</h1>

              {workshopDetails.description && (
                <p className="wsv-description">
                  {workshopDetails.description}
                </p>
              )}

              <div className="wsv-detailsGrid" aria-label="Workshop details">
                {workshopDetails.dateText && (
                  <div className="wsv-detailCard">
                    <div className="wsv-detail-label">Date</div>
                    <div className="wsv-detail-value">
                      {workshopDetails.dateText}
                    </div>
                  </div>
                )}

                {workshopDetails.timeText && (
                  <div className="wsv-detailCard">
                    <div className="wsv-detail-label">Time</div>
                    <div className="wsv-detail-value">
                      {workshopDetails.timeText}
                    </div>
                  </div>
                )}

                {workshopDetails.locationText && (
                  <div className="wsv-detailCard is-wide">
                    <div className="wsv-detail-label">Location</div>
                    <div className="wsv-detail-value">
                      {workshopDetails.locationText}
                    </div>
                  </div>
                )}
              </div>

              <div className="wsv-actionRow">
                {!isPast ? (
                  <button
                    type="button"
                    className="wsv-primaryBtn"
                    onClick={() =>
                      navigate(`/public-workshops/${workshop.id}/register`)
                    }
                  >
                    Sign Up
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wsv-primaryBtn is-disabled"
                    disabled
                  >
                    Event Ended
                  </button>
                )}

                <Link className="wsv-backLink" to="/public-workshops">
                  Back to workshops
                </Link>
              </div>

              {isPast && (
                <div className="wsv-note">This workshop is already finished.</div>
              )}
            </section>
          </div>
        </main>
      </div>
    </>
  );
}