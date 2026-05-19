import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
// ADDED: Import the icons to prevent 'undefined' crash
import { Eye, EyeOff } from "lucide-react"; 
import API from "../services/api";
import "../assets/css/forgot-password.css";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";

  const [form, setForm] = useState({
    password: "",
    confirm_password: "",
  });

  const [error, setError] = useState("");
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

  const allValid =
    token &&
    Object.values(rules).every(Boolean) &&
    passwordsMatch &&
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

    if (!token) {
      setError("Reset token is missing.");
      return;
    }

    if (!allValid) {
      setError("Please complete all password requirements.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await API.post("/auth/reset-password.php", {
        token,
        password: form.password,
        confirm_password: form.confirm_password,
      });

      if (res.data.status === "success") {
        navigate("/login", {
          replace: true,
          state: {
            message:
              res.data.message ||
              "Password reset successfully. You may now log in.",
          },
        });
      } else {
        setError(res.data.message || "Could not reset password.");
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
          <h1>Reset Password</h1>

          {!token && (
            <div className="alert" role="alert" aria-live="assertive">
              Reset token is missing. Please request a new password reset link.
            </div>
          )}

          {error && (
            <div className="alert" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="password">
                New Password
              </label>

              <div className="input-wrap">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  required
                  autoComplete="new-password"
                  aria-describedby="password-rules"
                />

                {/* FIXED: Changed showPw to showPassword */}
                <button
                  type="button"
                  className="toggle"
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

              <ul id="password-rules" className="rules">
                {Object.entries(rules).map(([key, valid]) => (
                  <li
                    key={key}
                    className={`rule ${
                      valid ? "ok show" : form.password ? "show" : ""
                    }`}
                  >
                    <span className="dot" aria-hidden="true"></span>
                    <span className="text">
                      {
                        {
                          length: "At least 8 characters",
                          upper: "At least 1 uppercase letter",
                          lower: "At least 1 lowercase letter",
                          number: "At least 1 number",
                          special: "At least 1 special character",
                        }[key]
                      }
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="field">
              <label className="label" htmlFor="confirm_password">
                Confirm New Password
              </label>

              <div className="input-wrap">
                <input
                  id="confirm_password"
                  className="input"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirm_password}
                  onChange={(e) =>
                    updateField("confirm_password", e.target.value)
                  }
                  required
                  autoComplete="new-password"
                  aria-describedby="password-match-message"
                />

                {/* FIXED: Changed showPw to showConfirmPassword */}
                <button
                  type="button"
                  className="toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
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
                id="password-match-message"
                className="msg"
                aria-live="polite"
              >
                {form.confirm_password &&
                  (passwordsMatch
                    ? "Passwords match ✅"
                    : "Passwords do not match!")}
              </p>
            </div>

            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "RESETTING..." : "RESET PASSWORD"}
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