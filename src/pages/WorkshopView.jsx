import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/workshop-view.scoped.css";
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
  if (/^https?:\/\//i.test(path)) return path;

  const clean = String(path).trim().replace(/^\/+/, "");

  if (clean.startsWith("uploads/")) {
    return `/api/${clean}`;
  }

  return `/${clean}`;
}

export default function WorkshopView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [workshop, setWorkshop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    setErrorMsg("");

    API.get("/bookings/public-workshop/public-detail.php", { params: { id } })
      .then((res) => {
        if (!res.data?.workshop) {
          setErrorMsg("Workshop not found.");
          return;
        }
        setWorkshop(res.data.workshop);
      })
      .catch((err) => {
        console.error("Failed to load workshop detail:", err);
        console.error("Response data:", err.response?.data);
        setErrorMsg(err.response?.data?.message || "Failed to load workshop.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const paragraph = useMemo(() => {
    if (!workshop) return "";

    const dateText = formatDate(workshop.workshop_date);
    const startText = formatTime(workshop.start_time);
    let timeText = startText;
    if (workshop.end_time) timeText += ` – ${formatTime(workshop.end_time)}`;

    const desc = (workshop.description || "").trim();
    const loc = (workshop.location || "").trim();

    return [
      desc,
      `Date: ${dateText}`,
      `Time: ${timeText}`,
      `Location: ${loc}`,
    ]
      .filter(Boolean)
      .join("\n\n");
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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .wsv-status, .wsv-title, .wsv-paragraph, .wsv-note"
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
  }, [loading, errorMsg, workshop, paragraph, isPast]);

  if (loading) {
    return (
      <>
        <Navbar />

        <div className="wsv-page" id="readable-content">
          <section className="wsv-section">
            <div className="wsv-inner">
              <div className="wsv-status">Loading workshop details...</div>
            </div>
          </section>
        </div>
      </>
    );
  }

  if (errorMsg || !workshop) {
    return (
      <>
        <Navbar />

        <div className="wsv-page" id="readable-content">
          <section className="wsv-section">
            <div className="wsv-inner">
              <div className="wsv-status">
                {errorMsg || "Workshop not found."}
              </div>

              <div className="wsv-actionRow">
                <a
                  className="wsv-backLink"
                  href="/public-workshops"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/public-workshops");
                  }}
                >
                  Back
                </a>
              </div>
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="wsv-page" id="readable-content">
        <section className="wsv-section">
          <div className="wsv-inner">
            <div className="wsv-imageWrap">
              <img
                className="wsv-image"
                src={posterSrc(workshop.poster_path)}
                alt="Workshop Poster"
                onError={(e) => {
                  e.currentTarget.src = "/pics/default-workshop.jpg";
                }}
              />
            </div>

            <div className="wsv-text">
              <h1 className="wsv-title">{workshop.title}</h1>
              <p className="wsv-paragraph">{paragraph}</p>

              <div className="wsv-actionRow">
                {!isPast ? (
                  <button
                    className="wsv-primaryBtn"
                    onClick={() =>
                      navigate(`/public-workshops/${workshop.id}/register`)
                    }
                  >
                    SIGN UP
                  </button>
                ) : (
                  <button
                    className="wsv-primaryBtn is-disabled"
                    disabled
                  >
                    EVENT ENDED
                  </button>
                )}

                <a
                  className="wsv-backLink"
                  href="/public-workshops"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/public-workshops");
                  }}
                >
                  Back
                </a>
              </div>

              {isPast && (
                <div className="wsv-note">
                  This workshop is in the past.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}