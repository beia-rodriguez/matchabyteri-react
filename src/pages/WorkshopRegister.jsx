import { useEffect, useMemo, useReducer } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/workshop-register.scoped.css";
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

const workshopRegisterInitialState = {
  payload: null,
  loading: true,
  errorMsg: "",
};

function workshopRegisterReducer(state, action) {
  switch (action.type) {
    case "loading":
      return {
        payload: null,
        loading: true,
        errorMsg: "",
      };

    case "success":
      return {
        payload: action.payload,
        loading: false,
        errorMsg: "",
      };

    case "error":
      return {
        payload: null,
        loading: false,
        errorMsg: action.message,
      };

    default:
      return state;
  }
}

function stableTextKey(value) {
  const text = String(value ?? "");
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }

  return `bullet-${hash.toString(36)}`;
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

function buildBullets(workshop) {
  const raw = String(
    workshop?.register_points && workshop.register_points.trim() !== ""
      ? workshop.register_points
      : workshop?.description || ""
  ).trim();

  if (!raw) return [];

  const lines = raw.split(/\r?\n+/);
  const bullets = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    line = line
      .replace(/^[\-\*\u2022\u2023\u25E6\u2043\u2219•]+\s*/u, "")
      .trim();

    if (line) bullets.push(line);
  }

  if (bullets.length === 0 && raw) return [raw];

  return bullets;
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

export default function WorkshopRegister() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pageState, dispatchPageState] = useReducer(
    workshopRegisterReducer,
    workshopRegisterInitialState
  );

  const { payload, loading, errorMsg } = pageState;

  useEffect(() => {
    let ignore = false;

    dispatchPageState({ type: "loading" });

    API.get("/bookings/public-workshop/public-packages.php", {
      params: { id },
    })
      .then((res) => {
        if (ignore) return;

        if (!res.data?.workshop) {
          navigate("/public-workshops", { replace: true });
          return;
        }

        dispatchPageState({
          type: "success",
          payload: res.data,
        });
      })
      .catch((err) => {
        if (ignore) return;

        console.error("Failed to load workshop packages:", err);
        console.error("Response data:", err.response?.data);

        dispatchPageState({
          type: "error",
          message: err.response?.data?.message || "Failed to load workshop.",
        });
      });

    return () => {
      ignore = true;
    };
  }, [id, navigate]);

  const view = useMemo(() => {
    if (!payload?.workshop) return null;

    const w = payload.workshop;

    return {
      w,
      dateText: formatDate(w.workshop_date),
      timeText: timeRange(w.start_time, w.end_time),
      locationText: String(w.location || "").trim(),
      bullets: buildBullets(w),
      maxSlots: Number(payload.maxSlots || 0),
      regCount: Number(payload.regCount || 0),
      remaining: payload.remaining === null ? null : Number(payload.remaining),
      isFull: !!payload.isFull,
    };
  }, [payload]);

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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .ws-reg-status, .ws-reg-eyebrow, .ws-reg-title, .ws-reg-section, .ws-reg-detail-label, .ws-reg-detail-value, .ws-reg-pill, .ws-reg-btn, .ws-reg-fullNote"
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
  }, [loading, errorMsg, payload, view]);

  if (loading) {
    return (
      <>
        <Navbar />

        <div className="ws-reg-page" id="readable-content">
          <main className="ws-reg-wrap">
            <div className="ws-reg-stateCard">
              <div className="ws-reg-status">Loading workshop details...</div>
            </div>
          </main>
        </div>
      </>
    );
  }

  if (errorMsg || !view) {
    return (
      <>
        <Navbar />

        <div className="ws-reg-page" id="readable-content">
          <main className="ws-reg-wrap">
            <div className="ws-reg-stateCard">
              <div className="ws-reg-status">
                {errorMsg || "Workshop not found."}
              </div>

              <div className="ws-reg-btnRow">
                <Link
                  className="ws-reg-btn ws-reg-btnBack"
                  to="/public-workshops"
                >
                  Back to workshops
                </Link>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  const standardUrl = `/public-workshops/${view.w.id}/standard`;
  const premiumUrl = `/public-workshops/${view.w.id}/premium`;
  const backUrl = `/public-workshops/${view.w.id}`;

  return (
    <>
      <Navbar />

      <div className="ws-reg-page" id="readable-content">
        <main className="ws-reg-wrap">
          <div className="ws-reg-layout">
            <aside className="ws-reg-mediaCol" aria-label="Workshop poster">
              <div className="ws-reg-posterCard">
                <img
                  className="ws-reg-poster"
                  src={posterSrc(view.w.poster_path)}
                  alt={view.w.title || "Workshop poster"}
                  onError={(e) => {
                    e.currentTarget.src = "/pics/default-workshop.jpg";
                  }}
                />
              </div>
            </aside>

            <section className="ws-reg-main">
              <div className="ws-reg-eyebrow">Package Selection</div>

              <h1 className="ws-reg-title">{view.w.title}</h1>

              <div className="ws-reg-capRow">
                <div className="ws-reg-pill">
                  {view.maxSlots > 0 ? (
                    <>
                      {view.remaining} slots left
                    </>
                  ) : (
                    <>Unlimited slots</>
                  )}
                </div>

                <div className="ws-reg-pill">
                  Registered: {view.regCount}
                  {view.maxSlots > 0 ? ` / ${view.maxSlots}` : ""}
                </div>

                {view.isFull && (
                  <div className="ws-reg-pill is-bad" aria-label="Full">
                    Full
                  </div>
                )}
              </div>

              <div className="ws-reg-detailsGrid" aria-label="Workshop details">
                {view.dateText && (
                  <div className="ws-reg-detailCard">
                    <div className="ws-reg-detail-label">Date</div>
                    <div className="ws-reg-detail-value">{view.dateText}</div>
                  </div>
                )}

                {view.timeText && (
                  <div className="ws-reg-detailCard">
                    <div className="ws-reg-detail-label">Time</div>
                    <div className="ws-reg-detail-value">{view.timeText}</div>
                  </div>
                )}

                {view.locationText && (
                  <div className="ws-reg-detailCard is-wide">
                    <div className="ws-reg-detail-label">Location</div>
                    <div className="ws-reg-detail-value">
                      {view.locationText}
                    </div>
                  </div>
                )}
              </div>

              <div className="ws-reg-section">What to Expect</div>

              {view.bullets.length > 0 ? (
                <ul className="ws-reg-bullets">
                  {view.bullets.map((bullet) => (
                    <li key={stableTextKey(bullet)}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <div className="ws-reg-emptyText">
                  Workshop details will be posted soon.
                </div>
              )}

              <div className="ws-reg-section">Choose Your Package</div>

              <div className="ws-reg-packageGrid">
                <div className="ws-reg-packageCard">
                  <div className="ws-reg-packageName">Standard</div>
                  <div className="ws-reg-packageText">
                    Select this package for the standard workshop inclusions.
                  </div>

                  {view.isFull ? (
                    <span
                      className="ws-reg-btn is-disabled"
                      aria-disabled="true"
                      aria-label="Standard unavailable"
                    >
                      Standard
                    </span>
                  ) : (
                    <Link
                      className="ws-reg-btn"
                      to={standardUrl}
                      aria-label="Choose standard package"
                    >
                      Standard
                    </Link>
                  )}
                </div>

                <div className="ws-reg-packageCard is-premium">
                  <div className="ws-reg-packageName">Premium</div>
                  <div className="ws-reg-packageText">
                    Select this package for the premium workshop inclusions.
                  </div>

                  {view.isFull ? (
                    <span
                      className="ws-reg-btn is-disabled"
                      aria-disabled="true"
                      aria-label="Premium unavailable"
                    >
                      Premium
                    </span>
                  ) : (
                    <Link
                      className="ws-reg-btn"
                      to={premiumUrl}
                      aria-label="Choose premium package"
                    >
                      Premium
                    </Link>
                  )}
                </div>
              </div>

              <div className="ws-reg-btnRow">
                <Link
                  className="ws-reg-btn ws-reg-btnBack"
                  to={backUrl}
                  aria-label="Back to workshop details"
                >
                  Back to details
                </Link>
              </div>

              {view.isFull && (
                <div className="ws-reg-fullNote">
                  This workshop is fully booked. Please check other schedules.
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </>
  );
}