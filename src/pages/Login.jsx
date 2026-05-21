import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import "../assets/css/login.css";
import "../assets/css/universal.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const noticeRef = useRef(null);
  const errorRef = useRef(null);

  const redirect = new URLSearchParams(location.search).get("redirect");

  const safeRedirect =
    redirect && redirect.startsWith("/") && !redirect.startsWith("//")
      ? redirect
      : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [notice, setNotice] = useState(location.state?.message || "");
  const [error, setError] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (location.state?.message) {
      setNotice(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (notice && noticeRef.current) {
      noticeRef.current.setAttribute("tabindex", "0");
      noticeRef.current.setAttribute("aria-label", notice);
    }

    if (error && errorRef.current) {
      errorRef.current.setAttribute("tabindex", "0");
      errorRef.current.setAttribute("aria-label", error);
    }
  }, [notice, error]);

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
      "h1, h2, h3, h4, h5, h6, p, label, input, button, img, a, li, .success, .alert"
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

      element.setAttribute("aria-label", textToRead.trim());
    });
  }, [notice, error, email, password, submitting, showPw]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setNotice("");

    if (!email.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await login({
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.status === "success") {
        if (res.user.role === "admin") {
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate(safeRedirect, { replace: true });
        }
      } else {
        setError(res.message || "Login failed.");
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
          <h1>Login</h1>

          {notice && (
            <div
              ref={noticeRef}
              className="success"
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
              ref={errorRef}
              className="alert"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              tabIndex="0"
              aria-label={error}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="email" aria-label="Email">
                Email
              </label>

              <input
                className="input"
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-label={
                  email.trim()
                    ? `Email: ${email}`
                    : "Enter email"
                }
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="password" aria-label="Password">
                Password
              </label>

              <div className="input-wrap">
                <input
                  className="input"
                  id="password"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-label={
                    password
                      ? "Password entered"
                      : "Enter password"
                  }
                />

                <button
                  type="button"
                  className="toggle"
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

            <div className="forgot">
              <Link to="/forgot-password" aria-label="Forgot Password">
                Forgot Password?
              </Link>
            </div>

            <button
              className="btn"
              type="submit"
              disabled={submitting}
              aria-label={submitting ? "Logging in" : "Log in"}
            >
              {submitting ? "LOGGING IN..." : "LOG IN"}
            </button>
          </form>

          <div className="login-footer">
            Need an account?{" "}
            <Link to="/sign-up" aria-label="Sign up">
              SIGN UP
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}