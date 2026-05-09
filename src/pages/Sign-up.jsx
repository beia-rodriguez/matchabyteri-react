import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import API from "../services/api";

import "../assets/css/signup.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const navigate = useNavigate();

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
    form.password.length > 0 &&
    form.confirm_password === form.password;

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

    const timer = setTimeout(async () => {
      try {
        setCheckingEmail(true);

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/auth/check_email.php`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },
            body: `email=${encodeURIComponent(email)}`,
          }
        );

        const data = await res.json();

        if (data.status === "taken") {
          setEmailMessage("Email already exists ❌");
          setEmailAvailable(false);
        } else if (data.status === "available") {
          setEmailMessage("Email available ✅");
          setEmailAvailable(true);
        } else {
          setEmailMessage(
            data.message || "Unable to check email."
          );
          setEmailAvailable(false);
        }
      } catch {
        setEmailMessage(
          "Unable to check email right now."
        );
        setEmailAvailable(false);
      } finally {
        setCheckingEmail(false);
      }
    }, 350);

    return () => clearTimeout(timer);
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
      setError(
        "Please complete all requirements before signing up."
      );
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
      };

      const res = await API.post(
        "/auth/sign-up.php",
        payload
      );

      if (res.data.status === "success") {
        navigate("/login", {
          replace: true,
          state: {
            message:
              res.data.message ||
              "Account created. Please check your email to verify your account before logging in.",
          },
        });
      } else {
        setError(
          res.data.message || "Sign up failed."
        );
      }
    } catch {
      setError(
        "Server error. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="shell">
        <div className="brand">
          <img
            className="brand-logo"
            src="/images/MBT_white 1.png"
            alt="Matcha By Teri"
          />
        </div>

        <div className="signup-card">
          <h1>Sign Up</h1>

          {error && (
            <div
              className="alert"
              role="alert"
              aria-live="assertive"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label
                className="label"
                htmlFor="name"
              >
                Full Name
              </label>

              <input
                id="name"
                className="input"
                type="text"
                value={form.name}
                onChange={(e) =>
                  updateField(
                    "name",
                    e.target.value
                  )
                }
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
              />
            </div>

            <div className="field">
              <label
                className="label"
                htmlFor="email"
              >
                Email
              </label>

              <input
                id="email"
                className="input"
                type="email"
                value={form.email}
                onChange={(e) =>
                  updateField(
                    "email",
                    e.target.value
                  )
                }
                required
                autoComplete="email"
                aria-describedby="email-message"
              />

              <p
                id="email-message"
                className="msg"
                aria-live="polite"
              >
                {checkingEmail
                  ? "Checking email..."
                  : emailMessage}
              </p>
            </div>

            <div className="field">
              <label
                className="label"
                htmlFor="password"
              >
                Password
              </label>

              <div className="input-wrap">
                <input
                  id="password"
                  className="input"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={form.password}
                  onChange={(e) =>
                    updateField(
                      "password",
                      e.target.value
                    )
                  }
                  required
                  autoComplete="new-password"
                  aria-describedby="password-rules"
                />

                <button
                  type="button"
                  className="toggle"
                  onClick={() =>
                    setShowPassword(
                      (prev) => !prev
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff
                      size={18}
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>

              <ul
                id="password-rules"
                className="rules"
              >
                {Object.entries(rules).map(
                  ([key, valid]) => (
                    <li
                      key={key}
                      className={`rule ${
                        valid
                          ? "ok show"
                          : form.password
                          ? "show"
                          : ""
                      }`}
                    >
                      <span
                        className="dot"
                        aria-hidden="true"
                      ></span>

                      <span className="text">
                        {
                          {
                            length:
                              "At least 8 characters",
                            upper:
                              "At least 1 uppercase letter",
                            lower:
                              "At least 1 lowercase letter",
                            number:
                              "At least 1 number",
                            special:
                              "At least 1 special character",
                          }[key]
                        }
                      </span>
                    </li>
                  )
                )}
              </ul>
            </div>

            <div className="field">
              <label
                className="label"
                htmlFor="confirm_password"
              >
                Confirm Password
              </label>

              <div className="input-wrap">
                <input
                  id="confirm_password"
                  className="input"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  value={form.confirm_password}
                  onChange={(e) =>
                    updateField(
                      "confirm_password",
                      e.target.value
                    )
                  }
                  required
                  autoComplete="new-password"
                  aria-describedby="password-match-message"
                />

                <button
                  type="button"
                  className="toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      (prev) => !prev
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  aria-pressed={
                    showConfirmPassword
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff
                      size={18}
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      size={18}
                      aria-hidden="true"
                    />
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

            <button
              className="btn"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "SIGNING UP..."
                : "SIGN UP"}
            </button>
          </form>

          <div className="signup-footer">
            Already a user?{" "}
            <Link to="/login">
              LOG IN
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}