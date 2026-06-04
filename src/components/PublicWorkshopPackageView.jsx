import { Link } from "react-router-dom";
import "../assets/css/public-workshop-package.css";

const EMPTY_BULLETS = [];

function stableTextKey(value) {
  const text = String(value ?? "");
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }

  return `bullet-${hash.toString(36)}`;
}

export default function PublicWorkshopPackageView({
  packageLabel,
  title,
  posterPath,
  dateText,
  timeText,
  location,
  bullets = EMPTY_BULLETS,
  emptyText,
  continueUrl,
  backUrl,
  slotInfo = null,
  isFull = false,
  fullMessage = "",
}) {
  return (
    <div className="wsPkg-wrap">
      <div className="wsPkg-layout">
        <div className="wsPkg-poster">
          <img src={posterPath} alt="Workshop Poster" />
        </div>

        <div>
          {slotInfo ? (
            <div className="wsPkg-badgeRow">
              <div className="wsPkg-badge">{packageLabel}</div>
              <div className={`wsPkg-pill ${isFull ? "wsPkg-pill-bad" : ""}`}>
                {slotInfo}
              </div>
            </div>
          ) : (
            <div className="wsPkg-badge">{packageLabel}</div>
          )}

          <div className="wsPkg-title">{title}</div>

          <div className="wsPkg-meta">
            Date: {dateText}
            <br />
            Time: {timeText}
            <br />
            Location: {location}
          </div>

          <div className="wsPkg-section">Inclusions:</div>

          {bullets.length === 0 ? (
            <div className="wsPkg-meta">{emptyText}</div>
          ) : (
            <ul className="wsPkg-bullets">
              {bullets.map((bullet) => (
                <li key={stableTextKey(bullet)}>{bullet}</li>
              ))}
            </ul>
          )}

          <div className="wsPkg-btnRow">
            {isFull ? (
              <span className="wsPkg-btn wsPkg-btnDisabled">CONTINUE</span>
            ) : (
              <Link className="wsPkg-btn" to={continueUrl}>
                CONTINUE
              </Link>
            )}

            <Link className="wsPkg-btn wsPkg-back" to={backUrl}>
              Back
            </Link>
          </div>

          {isFull && fullMessage ? (
            <div className="wsPkg-fullMessage">{fullMessage}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
