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
      "h1, h2, h3, h4, h5, h6, p, label, input, button, img, a, li, .fp-helper-text, .fp-login-footer"
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
        const label = readableContent.querySelector(`label[for="${element.id}"]`);

        textToRead =
          element.getAttribute("aria-label") ||
          label?.innerText ||
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

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await API.post("/auth/forgot-password.php", {
        email: cleanEmail,
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
    <main className="fp-page" id="readable-content">
      <div className="fp-shell">
        <section className="fp-brand" aria-label="Matcha By Teri brand">
          <img
            className="fp-brand-logo"
            src="/images/MBT_white 1.png"
            alt="Matcha By Teri"
          />
        </section>

        <section className="fp-card" aria-labelledby="fp-title">
          <h1 className="fp-title" id="fp-title">
            Forgot Password
          </h1>

          <p className="fp-helper-text" id="fp-instructions">
            Enter your email and we’ll send you a password reset link.
          </p>

          {error && (
            <div
              className="fp-alert fp-alert--error"
              role="alert"
              aria-live="assertive"
              tabIndex={0}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              className="fp-alert fp-alert--success"
              role="status"
              aria-live="polite"
              tabIndex={0}
            >
              {message}
            </div>
          )}

          <form className="fp-form" onSubmit={handleSubmit} noValidate>
            <div className="fp-field">
              <label className="fp-label" htmlFor="fp-email">
                Email
              </label>

              <input
                id="fp-email"
                className="fp-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                aria-label="Enter email address"
                aria-describedby="fp-instructions"
              />
            </div>

            <button
              className="fp-submit-button"
              type="submit"
              disabled={submitting}
              aria-label={submitting ? "Sending password reset link" : "Send reset link"}
            >
              {submitting ? "SENDING..." : "SEND RESET LINK"}
            </button>
          </form>

          <p className="fp-login-footer">
            Remembered your password?{" "}
            <Link className="fp-login-link" to="/login">
              LOG IN
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
