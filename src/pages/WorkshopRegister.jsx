import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/workshop-register.scoped.css";
import "../assets/css/universal.css";

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

    line = line.replace(/^[\-\*\u2022\u2023\u25E6\u2043\u2219•]+\s*/u, "").trim();
    if (line) bullets.push(line);
  }

  if (bullets.length === 0 && raw) return [raw];
  return bullets;
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

export default function WorkshopRegister() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    setErrorMsg("");

    API.get("/bookings/public-workshop/public-packages.php", { params: { id } })
      .then((res) => {
        if (!res.data?.workshop) {
          navigate("/public-workshops", { replace: true });
          return;
        }
        setPayload(res.data);
      })
      .catch((err) => {
        console.error("Failed to load workshop packages:", err);
        console.error("Response data:", err.response?.data);
        setErrorMsg(err.response?.data?.message || "Failed to load workshop.");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const view = useMemo(() => {
    if (!payload?.workshop) return null;

    const w = payload.workshop;
    const dateText = formatDate(w.workshop_date);
    const startText = formatTime(w.start_time);
    let timeText = startText;
    if (w.end_time) timeText += ` – ${formatTime(w.end_time)}`;

    return {
      w,
      dateText,
      timeText,
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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .ws-reg-status, .ws-reg-title, .ws-reg-pill, .ws-reg-section, .ws-reg-meta, .ws-reg-btn, .ws-reg-fullNote"
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
          <div className="ws-reg-wrap">
            <div className="ws-reg-status">Loading workshop details...</div>
          </div>
        </div>
      </>
    );
  }

  if (errorMsg || !view) {
    return (
      <>
        <Navbar />
        <div className="ws-reg-page" id="readable-content">
          <div className="ws-reg-wrap">
            <div className="ws-reg-status">
              {errorMsg || "Workshop not found."}
            </div>
          </div>
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
        <div className="ws-reg-wrap">
          <div className="ws-reg-layout">
            <div className="ws-reg-posterCard">
              <img
                className="ws-reg-poster"
                src={posterSrc(view.w.poster_path)}
                alt="Workshop Poster"
                onError={(e) => {
                  e.currentTarget.src = "/pics/default-workshop.jpg";
                }}
              />
            </div>

            <div className="ws-reg-main">
              <div className="ws-reg-title">{view.w.title}</div>

              <div className="ws-reg-capRow">
                <div className="ws-reg-pill">
                  Slots:{" "}
                  {view.maxSlots > 0 ? (
                    <>
                      {view.regCount} / {view.maxSlots} (Remaining: {view.remaining})
                    </>
                  ) : (
                    <>Unlimited (Registered: {view.regCount})</>
                  )}
                </div>

                {view.isFull && (
                  <div className="ws-reg-pill is-bad" aria-label="Full">
                    FULL
                  </div>
                )}
              </div>

              <div className="ws-reg-section">What to Expect:</div>

              {view.bullets.length > 0 ? (
                <ul className="ws-reg-bullets">
                  {view.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              ) : (
                <div className="ws-reg-meta">Workshop details will be posted soon.</div>
              )}

              <div className="ws-reg-meta">
                Date: {view.dateText}
                <br />
                Time: {view.timeText}
                <br />
                Location: {view.w.location}
              </div>

              <div className="ws-reg-btnRow">
                {view.isFull ? (
                  <>
                    <span
                      className="ws-reg-btn is-disabled"
                      aria-disabled="true"
                      aria-label="Standard"
                    >
                      STANDARD
                    </span>

                    <span
                      className="ws-reg-btn is-disabled"
                      aria-disabled="true"
                      aria-label="Premium"
                    >
                      PREMIUM
                    </span>
                  </>
                ) : (
                  <>
                    <a
                      className="ws-reg-btn"
                      href={standardUrl}
                      aria-label="Standard"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(standardUrl);
                      }}
                    >
                      STANDARD
                    </a>

                    <a
                      className="ws-reg-btn"
                      href={premiumUrl}
                      aria-label="Premium"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(premiumUrl);
                      }}
                    >
                      PREMIUM
                    </a>
                  </>
                )}

                <a
                  className="ws-reg-btn ws-reg-btnBack"
                  href={backUrl}
                  aria-label="Back"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(backUrl);
                  }}
                >
                  Back
                </a>
              </div>

              {view.isFull && (
                <div className="ws-reg-fullNote">
                  This workshop is fully booked. Please check other schedules.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}