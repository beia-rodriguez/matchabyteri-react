import { useEffect, useReducer } from "react";
import { Link, useParams } from "react-router-dom";
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

function stableTextKey(value) {
  const text = String(value ?? "");
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }

  return `bullet-${hash.toString(36)}`;
}

function getInitialPackageState(requestKey) {
  return {
    requestKey,
    data: null,
    loading: true,
    errorMsg: "",
  };
}

function publicWorkshopPackageReducer(state, action) {
  switch (action.type) {
    case "loading":
      return {
        requestKey: action.requestKey,
        data: null,
        loading: true,
        errorMsg: "",
      };

    case "success":
      return {
        requestKey: action.requestKey,
        data: action.data,
        loading: false,
        errorMsg: "",
      };

    case "error":
      return {
        requestKey: action.requestKey,
        data: null,
        loading: false,
        errorMsg: action.message,
      };

    default:
      return state;
  }
}

export default function PublicWorkshopPackage({ kind }) {
  const { id } = useParams();
  const isStandard = kind === "standard";
  const requestKey = `${id || ""}:${kind || ""}`;

  const [packageState, dispatchPackageState] = useReducer(
    publicWorkshopPackageReducer,
    requestKey,
    getInitialPackageState
  );

  const activePackageState =
    packageState.requestKey === requestKey
      ? packageState
      : getInitialPackageState(requestKey);

  const { data, loading, errorMsg } = activePackageState;

  useEffect(() => {
    let ignore = false;

    const endpoint = isStandard
      ? "/bookings/public-workshop/public_workshop_standard.php"
      : "/bookings/public-workshop/public_workshop_premium.php";

    dispatchPackageState({
      type: "loading",
      requestKey,
    });

    API.get(endpoint, { params: { id } })
      .then((res) => {
        if (ignore) return;

        if (!res.data?.success || !res.data?.workshop) {
          dispatchPackageState({
            type: "error",
            requestKey,
            message: "Workshop not found.",
          });
          return;
        }

        dispatchPackageState({
          type: "success",
          requestKey,
          data: res.data.workshop,
        });
      })
      .catch((err) => {
        if (ignore) return;

        console.error(`Failed to load ${kind} package:`, err);
        console.error("Response data:", err.response?.data);

        dispatchPackageState({
          type: "error",
          requestKey,
          message:
            err.response?.data?.message || `Failed to load ${kind} package.`,
        });
      });

    return () => {
      ignore = true;
    };
  }, [id, isStandard, kind, requestKey]);

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
          <div className="wsPkg-meta">Loading workshop details…</div>
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

  const slotInfo = isStandard
    ? data.max_slots > 0
      ? `Slots: ${data.reg_count} / ${data.max_slots} (Remaining: ${
          data.remaining
        })${data.is_full ? " • FULL" : ""}`
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
              alt="Workshop poster"
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
                {data.bullets.map((bullet) => (
                  <li key={stableTextKey(bullet)}>{bullet}</li>
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
                <Link className="wsPkg-btn" to={continueUrl} aria-label="Continue">
                  CONTINUE
                </Link>
              )}

              <Link className="wsPkg-btn wsPkg-back" to={backUrl} aria-label="Back">
                Back
              </Link>
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