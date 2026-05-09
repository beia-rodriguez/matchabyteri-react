import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import "../assets/css/login.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

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
    <div className="page">
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
            <div className="success" role="status" aria-live="polite">
              {notice}
            </div>
          )}

          {error && (
            <div className="alert" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="email">
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
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="password">
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
              <Link to="/forgot-password">Forgot Password?</Link>
            </div>

            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "LOGGING IN..." : "LOG IN"}
            </button>
          </form>

          <div className="login-footer">
            Need an account? <Link to="/sign-up">SIGN UP</Link>
          </div>
        </div>
      </div>
    </div>
  );
}