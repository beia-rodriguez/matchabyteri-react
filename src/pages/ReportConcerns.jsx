import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../services/api";
import "../assets/css/report-concerns.css";
import "../assets/css/universal.css";
import Navbar from "../components/Navbar";

function readableText(text = "") {
  return String(text)
    .replace(/\bOPTIONAL\b/g, "Optional")
    .replace(/\bSUBMIT\b/g, "Submit")
    .replace(/\bCONCERN\b/g, "Concern")
    .replace(/\bBACK\b/g, "Back")
    .trim();
}

export default function ReportConcerns() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    concern_type: "Booking Issue",
    booking_id: searchParams.get("booking_id") || "",
    subject: "",
    details: "",
  });

  const [error, setError] = useState("");

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
      "h1, h2, h3, h4, h5, h6, p, input, textarea, select, button, img, a, li, .title, .sub, .hint, .alert"
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
        tagName !== "select"
      ) {
        element.setAttribute("tabindex", "0");
      }

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", readableText(textToRead));
      }
    });
  }, [form, error]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));

    const res = await API.post("/concerns/submit-concern.php", formData);

    if (res.data.error) {
      setError(res.data.error);
    } else {
      navigate("/my-concerns");
    }
  };

  return (
    <>
      <Navbar />

      <div className="wrap" id="readable-content">
        <div className="title">Report Concerns</div>

        <div className="card">
          <div className="sub">
            Use this form to report concerns regarding your bookings or an error within the website.
          </div>

          {error && (
            <div className="alerts">
              <div className="alert bad">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Concern Type</label>
              <select
                name="concern_type"
                value={form.concern_type}
                aria-label={`Concern Type: ${form.concern_type}`}
                onChange={handleChange}
              >
                <option>Booking Issue</option>
                <option>Website Error</option>
                <option>Payment Issue</option>
                <option>Other</option>
              </select>
              <div className="hint">
                Choose the category that best matches your concern.
              </div>
            </div>

            <div className="field">
              <label>Booking ID (optional)</label>
              <input
                type="number"
                name="booking_id"
                value={form.booking_id}
                aria-label={
                  form.booking_id
                    ? `Booking ID Optional: ${form.booking_id}`
                    : "Enter Booking ID Optional"
                }
                onChange={handleChange}
                min="1"
              />
              <div className="hint">
                If your concern is about a booking, include the Booking ID if available.
              </div>
            </div>

            <div className="field full">
              <label>Subject</label>
              <input
                type="text"
                name="subject"
                value={form.subject}
                aria-label={
                  form.subject.trim()
                    ? `Subject: ${form.subject}`
                    : "Enter Subject"
                }
                onChange={handleChange}
                maxLength="150"
                required
              />
            </div>

            <div className="field full">
              <label>Details</label>
              <textarea
                name="details"
                value={form.details}
                aria-label={
                  form.details.trim()
                    ? `Details: ${form.details}`
                    : "Enter Details"
                }
                onChange={handleChange}
                required
              />
              <div className="hint">Please include important details.</div>
            </div>

            <div className="actions full">
              <button
                type="button"
                className="btn btn-back"
                aria-label="Back to Profile"
                onClick={() => navigate("/profile")}
              >
                Back to Profile
              </button>

              <button
                type="submit"
                className="btn btn-submit"
                aria-label="Submit Concern"
              >
                Submit Concern
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}