import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/public-workshop-package.css";
import "../assets/css/universal.css";

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

function formatPrice(value) {
  return `₱${Number(value || 0).toFixed(2)}`;
}

export default function PublicWorkshopPackage({ kind }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const isStandard = kind === "standard";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    setErrorMsg("");

    const endpoint = isStandard
      ? "/bookings/public-workshop/public_workshop_standard.php"
      : "/bookings/public-workshop/public_workshop_premium.php";

    API.get(endpoint, { params: { id } })
      .then((res) => {
        if (!res.data?.success || !res.data?.workshop) {
          setErrorMsg("Workshop not found.");
          return;
        }
        setData(res.data.workshop);
      })
      .catch((err) => {
        console.error(`Failed to load ${kind} package:`, err);
        console.error("Response data:", err.response?.data);
        setErrorMsg(
          err.response?.data?.message || `Failed to load ${kind} package.`
        );
      })
      .finally(() => setLoading(false));
  }, [id, isStandard, kind]);

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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .wsPkg-meta, .wsPkg-badge, .wsPkg-pill, .wsPkg-title, .wsPkg-price, .wsPkg-section, .wsPkg-btn, .wsPkg-fullMessage"
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
  }, [loading, errorMsg, data, isStandard]);

  if (loading) {
    return (
      <>
        <Navbar />

        <div className="wsPkg-wrap" id="readable-content">
          <div className="wsPkg-meta">Loading workshop details...</div>
        </div>
      </>
    );
  }

  if (errorMsg || !data) {
    return (
      <>
        <Navbar />

        <div className="wsPkg-wrap" id="readable-content">
          <div className="wsPkg-meta">{errorMsg || "Workshop not found."}</div>
        </div>
      </>
    );
  }

  const backUrl = `/public-workshops/${data.id}/register`;
  const continueUrl = `/registration?id=${data.id}&package=${kind}`;

  const slotInfo =
    isStandard
      ? data.max_slots > 0
        ? `Slots: ${data.reg_count} / ${data.max_slots} (Remaining: ${data.remaining})${
            data.is_full ? " • FULL" : ""
          }`
        : `Slots: Unlimited (Registered: ${data.reg_count})`
      : null;

  const emptyText = isStandard
    ? "Standard package details will be posted soon."
    : "Premium package details will be posted soon.";

  const packagePrice = isStandard
    ? formatPrice(data.standard_price)
    : formatPrice(data.premium_price);

  return (
    <>
      <Navbar />

      <div className="wsPkg-wrap" id="readable-content">
        <div className="wsPkg-layout">
          <div className="wsPkg-poster">
            <img
              src={posterSrc(data.poster_path)}
              alt="Workshop Poster"
              onError={(e) => {
                e.currentTarget.src = "/pics/default-workshop.jpg";
              }}
            />
          </div>

          <div>
            {isStandard ? (
              <div className="wsPkg-badgeRow">
                <div className="wsPkg-badge" aria-label="Standard package">
                  STANDARD PACKAGE
                </div>

                <div
                  className={`wsPkg-pill ${
                    data.is_full ? "wsPkg-pill-bad" : ""
                  }`}
                >
                  {slotInfo}
                </div>
              </div>
            ) : (
              <div className="wsPkg-badge" aria-label="Premium package">
                PREMIUM PACKAGE
              </div>
            )}

            <div className="wsPkg-title">{data.title}</div>

            <div className="wsPkg-price">Price: {packagePrice}</div>

            <div className="wsPkg-meta">
              Date: {data.dateText}
              <br />
              Time: {data.timeText}
              <br />
              Location: {data.location}
            </div>

            <div className="wsPkg-section">Inclusions:</div>

            {Array.isArray(data.bullets) && data.bullets.length > 0 ? (
              <ul className="wsPkg-bullets">
                {data.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : (
              <div className="wsPkg-meta">{emptyText}</div>
            )}

            <div className="wsPkg-btnRow">
              {isStandard && data.is_full ? (
                <span
                  className="wsPkg-btn wsPkg-btnDisabled"
                  aria-label="Continue"
                >
                  CONTINUE
                </span>
              ) : (
                <a
                  className="wsPkg-btn"
                  href={continueUrl}
                  aria-label="Continue"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(continueUrl);
                  }}
                >
                  CONTINUE
                </a>
              )}

              <a
                className="wsPkg-btn wsPkg-back"
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

            {isStandard && data.is_full ? (
              <div className="wsPkg-fullMessage">
                This workshop is fully booked. Please choose another schedule.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}