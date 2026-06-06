import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import "../assets/css/login.css";
import "../assets/css/universal.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const redirect = useMemo(() => {
    return new URLSearchParams(location.search).get("redirect");
  }, [location.search]);

  const safeRedirect =
    redirect && redirect.startsWith("/") && !redirect.startsWith("//")
      ? redirect
      : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [notice, setNotice] = useState(() => location.state?.message || "");
  const [error, setError] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const historyState = window.history.state;

    if (historyState?.usr?.message) {
      window.history.replaceState(
        {
          ...historyState,
          usr: {
            ...historyState.usr,
            message: undefined,
          },
        },
        document.title
      );
    }
  }, []);

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
        ".auth-login-success",
        ".auth-login-alert",
        ".auth-login-footer",
      ].join(", ")
    );

    readableElements.forEach((element) => {
      if (element.closest(".accessibility-bubble-wrapper")) return;

      const tagName = String(element.tagName || "").toLowerCase();

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

      element.setAttribute("aria-label", textToRead.trim());
      element.classList.add("voice-readable");
    });
  }, [notice, error, email, password, submitting, showPw]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setNotice("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await login({
        email: cleanEmail,
        password,
      });

      if (res?.status === "success" && res?.user) {
        const role = String(res.user.role || "user").toLowerCase();

        if (role === "admin") {
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate(safeRedirect, { replace: true });
        }

        return;
      }

      setError(res?.message || "Login failed.");
    } catch (err) {
      console.error("Login error:", err);
      setError("Server error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="auth-login-page"
      id="readable-content"
      aria-label="Login page"
      data-voice-page-name="Login"
    >
      <div className="auth-login-shell">
        <section className="auth-login-brand" aria-label="Matcha By Teri brand">
          <img
            className="auth-login-brand-logo"
            src="/images/MBT_white 1.png"
            alt="Matcha By Teri"
          />
        </section>

        <section className="auth-login-card" aria-label="Login form">
          <h1 className="auth-login-title">Login</h1>

          {notice && (
            <div
              className="auth-login-success"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              tabIndex="0"
              aria-label={notice}
            >
              {notice}
            </div>
          )}

          {error && (
            <div
              className="auth-login-alert"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              tabIndex="0"
              aria-label={error}
            >
              {error}
            </div>
          )}

          <form className="auth-login-form" onSubmit={handleSubmit}>
            <div className="auth-login-field">
              <label
                className="auth-login-label"
                htmlFor="auth-login-email"
                aria-label="Email"
              >
                Email
              </label>

              <input
                className="auth-login-input"
                id="auth-login-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-label={email.trim() ? `Email: ${email}` : "Enter email"}
              />
            </div>

            <div className="auth-login-field">
              <label
                className="auth-login-label"
                htmlFor="auth-login-password"
                aria-label="Password"
              >
                Password
              </label>

              <div className="auth-login-input-wrap">
                <input
                  className="auth-login-input auth-login-password-input"
                  id="auth-login-password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-label={password ? "Password entered" : "Enter password"}
                />

                <button
                  type="button"
                  className="auth-login-toggle"
                  onClick={() => setShowPw((prev) => !prev)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  aria-pressed={showPw}
                >
                  {showPw ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="auth-login-forgot">
              <Link
                className="auth-login-link"
                to="/forgot-password"
                aria-label="Forgot Password"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              className="auth-login-btn"
              type="submit"
              disabled={submitting}
              aria-label={submitting ? "Logging in" : "Log in"}
            >
              {submitting ? "LOGGING IN..." : "LOG IN"}
            </button>
          </form>

          <div className="auth-login-footer">
            Need an account?{" "}
            <Link
              className="auth-login-link auth-login-signup-link"
              to="/sign-up"
              aria-label="Sign up"
            >
              SIGN UP
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}