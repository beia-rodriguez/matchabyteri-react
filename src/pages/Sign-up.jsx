import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import API from "../services/api";

import "../assets/css/signup.css";
import "../assets/css/universal.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanReaderText(text = "") {
  return String(text).replace("✅", "").replace("❌", "").trim();
}

export default function SignUp() {
  const navigate = useNavigate();

  const errorRef = useRef(null);
  const emailMessageRef = useRef(null);
  const passwordMatchRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const [error, setError] = useState("");

  const [emailMessage, setEmailMessage] = useState("");
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const rules = useMemo(() => {
    const pass = form.password;

    return {
      length: pass.length >= 8,
      upper: /[A-Z]/.test(pass),
      lower: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[\W_]/.test(pass),
    };
  }, [form.password]);

  const passwordsMatch =
    form.password.length > 0 && form.confirm_password === form.password;

  const passwordMatchMessage =
    form.confirm_password &&
    (passwordsMatch ? "Passwords match" : "Passwords do not match");

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.setAttribute("tabindex", "0");
      errorRef.current.setAttribute("aria-label", error);
    }

    if (emailMessage && emailMessageRef.current) {
      emailMessageRef.current.setAttribute("tabindex", "0");
      emailMessageRef.current.setAttribute(
        "aria-label",
        checkingEmail ? "Checking email" : cleanReaderText(emailMessage)
      );
    }

    if (passwordMatchMessage && passwordMatchRef.current) {
      passwordMatchRef.current.setAttribute("tabindex", "0");
      passwordMatchRef.current.setAttribute("aria-label", passwordMatchMessage);
    }
  }, [error, emailMessage, checkingEmail, passwordMatchMessage]);

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
      [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "label",
        "input",
        "button",
        "img",
        "a",
        "li",
        ".auth-signup-alert",
        ".auth-signup-message",
        ".auth-signup-rule",
        ".auth-signup-footer",
      ].join(", ")
    );

    readableElements.forEach((element) => {
      if (element.closest(".accessibility-bubble-wrapper")) return;

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

      textToRead = cleanReaderText(textToRead);

      if (!textToRead) return;

      if (tagName !== "button" && tagName !== "a" && tagName !== "input") {
        element.setAttribute("tabindex", "0");
      }

      element.setAttribute("aria-label", textToRead);
      element.classList.add("voice-readable");
    });
  }, [
    form.name,
    form.email,
    form.password,
    form.confirm_password,
    emailMessage,
    checkingEmail,
    error,
    passwordsMatch,
    showPassword,
    showConfirmPassword,
    submitting,
  ]);

  useEffect(() => {
    const email = form.email.trim().toLowerCase();

    setEmailAvailable(false);

    if (!email) {
      setEmailMessage("");
      return;
    }

    if (!emailRegex.test(email)) {
      setEmailMessage("Invalid email format.");
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setCheckingEmail(true);
        setEmailMessage("Checking email...");

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/auth/check_email.php`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `email=${encodeURIComponent(email)}`,
            signal: controller.signal,
          }
        );

        const data = await res.json();

        if (data.status === "taken") {
          setEmailMessage("Email already exists");
          setEmailAvailable(false);
        } else if (data.status === "available") {
          setEmailMessage("Email available");
          setEmailAvailable(true);
        } else {
          setEmailMessage(data.message || "Unable to check email.");
          setEmailAvailable(false);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setEmailMessage("Unable to check email right now.");
          setEmailAvailable(false);
        }
      } finally {
        setCheckingEmail(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.email]);

  const allValid =
    form.name.trim().length >= 2 &&
    emailAvailable &&
    Object.values(rules).every(Boolean) &&
    passwordsMatch &&
    !checkingEmail &&
    !submitting;

  const updateField = (field, value) => {
    setError("");

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!allValid) {
      setError("Please complete all requirements before signing up.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
      };

      const res = await API.post("/auth/sign-up.php", payload);

      if (res.data.status === "success") {
        navigate("/login", {
          replace: true,
          state: {
            message:
              res.data.message ||
              "Account created successfully. Please check your email to verify your account.",
          },
        });
      } else {
        setError(res.data.message || "Sign up failed.");
      }
    } catch {
      setError("Server error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="auth-signup-page"
      id="readable-content"
      aria-label="Sign up page"
    >
      <div className="auth-signup-shell">
        <section className="auth-signup-brand" aria-label="Matcha By Teri brand">
          <img
            className="auth-signup-brand-logo"
            src="/images/MBT_white 1.png"
            alt="Matcha By Teri"
          />
        </section>

        <section className="auth-signup-card" aria-label="Sign up form">
          <h1 className="auth-signup-title">Sign Up</h1>

          {error && (
            <div
              ref={errorRef}
              className="auth-signup-alert"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              tabIndex="0"
              aria-label={error}
            >
              {error}
            </div>
          )}

          <form className="auth-signup-form" onSubmit={handleSubmit}>
            <div className="auth-signup-field">
              <label
                className="auth-signup-label"
                htmlFor="auth-signup-name"
                aria-label="Full Name"
              >
                Full Name
              </label>

              <input
                id="auth-signup-name"
                name="name"
                className="auth-signup-input"
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                aria-label={
                  form.name.trim()
                    ? `Full Name: ${form.name}`
                    : "Enter full name"
                }
              />
            </div>

            <div className="auth-signup-field">
              <label
                className="auth-signup-label"
                htmlFor="auth-signup-email"
                aria-label="Email"
              >
                Email
              </label>

              <input
                id="auth-signup-email"
                name="email"
                className="auth-signup-input"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
                autoComplete="email"
                aria-describedby="auth-signup-email-message"
                aria-label={
                  form.email.trim() ? `Email: ${form.email}` : "Enter email"
                }
              />

              <p
                ref={emailMessageRef}
                id="auth-signup-email-message"
                className={`auth-signup-message ${
                  emailAvailable ? "auth-signup-message-ok" : ""
                }`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                tabIndex={emailMessage ? "0" : undefined}
                aria-label={
                  checkingEmail ? "Checking email" : cleanReaderText(emailMessage)
                }
              >
                {checkingEmail ? "Checking email..." : emailMessage}
              </p>
            </div>

            <div className="auth-signup-field">
              <label
                className="auth-signup-label"
                htmlFor="auth-signup-password"
                aria-label="Password"
              >
                Password
              </label>

              <div className="auth-signup-input-wrap">
                <input
                  id="auth-signup-password"
                  name="password"
                  className="auth-signup-input auth-signup-password-input"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  required
                  autoComplete="new-password"
                  aria-describedby="auth-signup-password-rules"
                  aria-label={form.password ? "Password entered" : "Enter password"}
                />

                <button
                  type="button"
                  className="auth-signup-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>

              <ul id="auth-signup-password-rules" className="auth-signup-rules">
                {Object.entries(rules).map(([key, valid]) => {
                  const ruleText =
                    {
                      length: "At least 8 characters",
                      upper: "At least 1 uppercase letter",
                      lower: "At least 1 lowercase letter",
                      number: "At least 1 number",
                      special: "At least 1 special character",
                    }[key];

                  return (
                    <li
                      key={key}
                      className={`auth-signup-rule ${
                        valid
                          ? "auth-signup-rule-ok auth-signup-rule-show"
                          : form.password
                          ? "auth-signup-rule-show"
                          : ""
                      }`}
                      aria-label={`${ruleText}: ${
                        valid ? "correct" : "not yet correct"
                      }`}
                    >
                      <span
                        className="auth-signup-rule-dot"
                        aria-hidden="true"
                      ></span>

                      <span className="auth-signup-rule-text">{ruleText}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="auth-signup-field">
              <label
                className="auth-signup-label"
                htmlFor="auth-signup-confirm-password"
                aria-label="Confirm Password"
              >
                Confirm Password
              </label>

              <div className="auth-signup-input-wrap">
                <input
                  id="auth-signup-confirm-password"
                  name="confirm_password"
                  className="auth-signup-input auth-signup-password-input"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirm_password}
                  onChange={(e) =>
                    updateField("confirm_password", e.target.value)
                  }
                  required
                  autoComplete="new-password"
                  aria-describedby="auth-signup-password-match-message"
                  aria-label={
                    form.confirm_password
                      ? "Confirm password entered"
                      : "Enter confirm password"
                  }
                />

                <button
                  type="button"
                  className="auth-signup-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>

              <p
                ref={passwordMatchRef}
                id="auth-signup-password-match-message"
                className={`auth-signup-message ${
                  passwordsMatch ? "auth-signup-message-ok" : ""
                }`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                tabIndex={form.confirm_password ? "0" : undefined}
                aria-label={passwordMatchMessage || ""}
              >
                {form.confirm_password &&
                  (passwordsMatch
                    ? "Passwords match ✅"
                    : "Passwords do not match!")}
              </p>
            </div>

            <button
              className="auth-signup-btn"
              type="submit"
              disabled={!allValid || submitting}
              aria-label={submitting ? "Signing up" : "Sign up"}
            >
              {submitting ? "SIGNING UP..." : "SIGN UP"}
            </button>
          </form>

          <div className="auth-signup-footer">
            Already a user?{" "}
            <Link
              className="auth-signup-link"
              to="/login"
              aria-label="Log in"
            >
              LOG IN
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}