import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import "../assets/css/forgot-password.css";
import "../assets/css/universal.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      "h1, h2, h3, h4, h5, h6, p, label, input, button, img, a, li"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (tagName !== "button" && tagName !== "a" && tagName !== "input") {
        element.removeAttribute("tabindex");
      }

      if (!isVisible(element)) return;

      let textToRead = "";

      if (tagName === "img") {
        textToRead = element.getAttribute("alt") || "";
      } else if (tagName === "input") {
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

      if (tagName !== "button" && tagName !== "a" && tagName !== "input") {
        element.setAttribute("tabindex", "0");
      }

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", textToRead.trim());
      }
    });
  }, [message, error, submitting]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await API.post("/auth/forgot-password.php", {
        email: email.trim().toLowerCase(),
      });

      if (res.data.status === "success") {
        setMessage(res.data.message);
        setEmail("");
      } else {
        setError(res.data.message || "Could not send reset link.");
      }
    } catch {
      setError("Server error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page" id="readable-content">
      <div className="shell">
        <div className="brand">
          <img
            className="brand-logo"
            src="/images/MBT_white 1.png"
            alt="Matcha By Teri"
          />
        </div>

        <div className="login-card">
          <h1>Forgot Password</h1>

          <p className="helper-text">
            Enter your email and we’ll send you a password reset link.
          </p>

          {error && (
            <div className="alert" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          {message && (
            <div className="success" role="status" aria-live="polite">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="email" aria-label="Email">
                Email
              </label>

              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                aria-label="Enter email"
              />
            </div>

            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "SENDING..." : "SEND RESET LINK"}
            </button>
          </form>

          <div className="login-footer">
            Remembered your password? <Link to="/login">LOG IN</Link>
          </div>
        </div>
      </div>
    </div>
  );
}