import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import "../assets/css/my-concerns.css";
import "../assets/css/universal.css";
import Navbar from "../components/Navbar";

function readableText(text = "") {
  return String(text)
    .replace(/\bPENDING\b/g, "Pending")
    .replace(/\bRESOLVED\b/g, "Resolved")
    .replace(/\bREVIEW\b/g, "Review")
    .trim();
}

export default function MyConcerns() {
  const navigate = useNavigate();
  const [concerns, setConcerns] = useState([]);

  useEffect(() => {
    API.get("/concerns/get-concerns.php")
      .then((res) => setConcerns(res.data))
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login?redirect=/my-concerns");
        }
      });
  }, [navigate]);

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
      "h1, h2, h3, h4, h5, h6, p, input, textarea, select, button, img, a, li, summary, details, .title, .sub, .empty, .item, .subject, .meta, .badge, .details, .reply-box, .reply-title, .reply-text, .reply-time"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (
        tagName !== "button" &&
        tagName !== "a" &&
        tagName !== "input" &&
        tagName !== "textarea" &&
        tagName !== "select" &&
        tagName !== "summary"
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
          element.value ||
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
        tagName !== "select" &&
        tagName !== "summary"
      ) {
        element.setAttribute("tabindex", "0");
      }

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", readableText(textToRead));
      }
    });
  }, [concerns]);

  const statusLabel = (s) => {
    if (s === "resolved") return "Resolved";
    if (s === "in_review") return "In Review";
    return "Pending";
  };

  return (
    <>
      <Navbar />

      <div className="wrap" id="readable-content">
        <div className="title">My Concerns</div>

        <div className="card">
          <div className="sub">
            This page shows your submitted concerns and any replies from the admin team.
          </div>

          <div className="actions">
            <button
              className="btn btn-back"
              aria-label="Back to Profile"
              onClick={() => navigate("/profile")}
            >
              Back to Profile
            </button>

            <button
              className="btn btn-new"
              aria-label="Report a Concern"
              onClick={() => navigate("/report-concerns")}
            >
              Report a Concern
            </button>
          </div>

          {concerns.length === 0 ? (
            <div className="empty">
              You have not submitted any concerns yet.
            </div>
          ) : (
            <div className="list">
              {concerns.map((c) => (
                <div
                  key={c.id}
                  className="item"
                  aria-label={`Concern: ${c.subject}. Type: ${c.concern_type}. Status: ${statusLabel(c.status)}.`}
                >
                  <div className="top">
                    <div>
                      <div className="subject">{c.subject}</div>

                      <div className="meta">
                        Type: {c.concern_type}
                        {c.booking_id && <> • Booking ID: {c.booking_id}</>}
                        {" • Submitted: "}
                        {new Date(c.created_at).toLocaleString()}
                      </div>
                    </div>

                    <span
                      className="badge"
                      aria-label={`Status: ${statusLabel(c.status)}`}
                    >
                      {statusLabel(c.status)}
                    </span>
                  </div>

                  <div className="divider"></div>

                  <details>
                    <summary
                      className="meta"
                      style={{ fontWeight: 900, cursor: "pointer" }}
                      aria-label="View details"
                    >
                      View details
                    </summary>

                    <div style={{ marginTop: 10 }} className="details">
                      {c.details}
                    </div>
                  </details>

                  {c.admin_response && (
                    <div className="reply-box">
                      <div className="reply-title">Admin Reply</div>

                      <div className="reply-text">{c.admin_response}</div>

                      {c.responded_at && (
                        <div className="reply-time">
                          Replied on: {new Date(c.responded_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}