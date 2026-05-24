import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { CheckCircle2, Circle, Eye, EyeOff } from "lucide-react";
import API from "../services/api";
import "../assets/css/reset-password.css";
import "../assets/css/universal.css";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

function cleanReaderText(text = "") {
  return String(text).trim();
}


export default function ResetPasswordOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialEmail = location.state?.email || searchParams.get("email") || "";
  const initialCooldown = Math.max(
    0,
    Math.ceil(((location.state?.cooldownUntil || 0) - Date.now()) / 1000)
  );

  const [email, setEmail] = useState(initialEmail);
  const [otpValues, setOtpValues] = useState(Array(OTP_LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState(
    location.state?.justSent
      ? "If that email exists, a password reset code has been sent."
      : ""
  );
  const [error, setError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(initialCooldown);
  const [resending, setResending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const otpRefs = useRef([]);
  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const otp = useMemo(() => otpValues.join(""), [otpValues]);

  const rules = useMemo(() => {
    return {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[\W_]/.test(password),
    };
  }, [password]);

  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const passwordMatchMessage =
    confirmPassword &&
    (passwordsMatch ? "Passwords match" : "Passwords do not match");

  useEffect(() => {
    if (!resendSeconds) return;

    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendSeconds]);

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
        ".rp-helper-text",
        ".rp-login-footer",
        ".rp-otp-helper-text",
        ".rp-password-rules",
        ".rp-password-rule",
        ".rp-message",
      ].join(", ")
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

      textToRead = cleanReaderText(textToRead);

      if (!textToRead.trim()) return;

      if (tagName !== "button" && tagName !== "a" && tagName !== "input") {
        element.setAttribute("tabindex", "0");
      }

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", textToRead.trim());
      }
    });
  }, [
    message,
    error,
    resending,
    resetting,
    resendSeconds,
    otpValues,
    password,
    confirmPassword,
    showPassword,
    showConfirmPassword,
    passwordMatchMessage,
  ]);

  useEffect(() => {
    window.setTimeout(() => {
      otpRefs.current[0]?.focus();
    }, 80);
  }, []);

  const focusOtpIndex = (index) => {
    const safeIndex = Math.max(0, Math.min(index, OTP_LENGTH - 1));
    otpRefs.current[safeIndex]?.focus();
    otpRefs.current[safeIndex]?.select?.();
  };

  const setOtpFromDigits = (digits) => {
    const next = Array(OTP_LENGTH).fill("");

    digits.slice(0, OTP_LENGTH).forEach((digit, index) => {
      next[index] = digit;
    });

    setOtpValues(next);
  };

  const handleOtpInputChange = (index, rawValue) => {
    const digits = rawValue.replace(/\D/g, "");

    if (!digits) {
      setOtpValues((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    if (digits.length > 1) {
      const next = [...otpValues];
      let cursor = index;

      digits.split("").forEach((digit) => {
        if (cursor < OTP_LENGTH) {
          next[cursor] = digit;
          cursor += 1;
        }
      });

      setOtpValues(next);
      focusOtpIndex(Math.min(cursor, OTP_LENGTH - 1));
      return;
    }

    setOtpValues((prev) => {
      const next = [...prev];
      next[index] = digits;
      return next;
    });

    if (index < OTP_LENGTH - 1) {
      focusOtpIndex(index + 1);
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      event.preventDefault();

      if (otpValues[index]) {
        setOtpValues((prev) => {
          const next = [...prev];
          next[index] = "";
          return next;
        });
        return;
      }

      if (index > 0) {
        setOtpValues((prev) => {
          const next = [...prev];
          next[index - 1] = "";
          return next;
        });
        focusOtpIndex(index - 1);
      }

      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusOtpIndex(index - 1);
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusOtpIndex(index + 1);
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();

    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;

    setOtpFromDigits(pasted.split(""));
    focusOtpIndex(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  const validateBeforeSubmit = () => {
    if (!cleanEmail) return "Please enter your email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return "Please enter a valid email address.";
    }
    if (!/^\d{6}$/.test(otp)) {
      return "Please enter the complete 6-digit reset code.";
    }
    if (!password || !confirmPassword) {
      return "Please fill in the new password and confirm password.";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must include at least one uppercase letter.";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must include at least one lowercase letter.";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must include at least one number.";
    }
    if (!/[\W_]/.test(password)) {
      return "Password must include at least one special character.";
    }

    return "";
  };

  const handleResendCode = async () => {
    if (resendSeconds > 0 || resending) return;

    if (!cleanEmail) {
      setError("Please enter your email.");
      return;
    }

    try {
      setResending(true);
      setError("");
      setMessage("");

      const res = await API.post("/auth/forgot-password.php", {
        email: cleanEmail,
      });

      if (res.data.status === "success") {
        setOtpValues(Array(OTP_LENGTH).fill(""));
        setResendSeconds(RESEND_SECONDS);
        setMessage(
          res.data.message ||
            "If that email exists, a password reset code has been sent."
        );
        focusOtpIndex(0);
      } else {
        setError(res.data.message || "Could not resend reset code.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Server error. Please try again."
      );
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateBeforeSubmit();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setResetting(true);

      const res = await API.post("/auth/reset-password.php", {
        email: cleanEmail,
        otp,
        password,
        confirm_password: confirmPassword,
      });

      if (res.data.status === "success") {
        window.alert(
          res.data.message || "Password reset successfully. You may now log in."
        );
        navigate("/login");
      } else {
        setError(res.data.message || "Could not reset password.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Server error. Please try again."
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <main className="rp-page" id="readable-content">
      <div className="rp-shell">
        <section className="rp-brand" aria-label="Matcha By Teri brand">
          <img
            className="rp-brand-logo"
            src="/images/MBT_white 1.png"
            alt="Matcha By Teri"
          />
        </section>

        <section className="rp-card" aria-labelledby="rp-title">
          <h1 className="rp-title" id="rp-title">
            Reset Password
          </h1>

          <p className="rp-helper-text" id="rp-instructions">
            Enter the 6-digit code sent to your email and choose a new password.
          </p>

          {error && (
            <div
              className="rp-alert rp-alert--error"
              role="alert"
              aria-live="assertive"
              tabIndex={0}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              className="rp-alert rp-alert--success"
              role="status"
              aria-live="polite"
              tabIndex={0}
            >
              {message}
            </div>
          )}

          <form className="rp-form" onSubmit={handleResetPassword} noValidate>
            <div className="rp-field">
              <label className="rp-label" htmlFor="rp-reset-email">
                Email
              </label>

              <input
                id="rp-reset-email"
                className="rp-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                aria-label="Enter email address"
                aria-describedby="rp-instructions"
              />
            </div>

            <div className="rp-field">
              <label className="rp-label rp-otp-label" htmlFor="rp-otp-digit-0">
                Reset Code
              </label>

              <div
                className="rp-otp-group"
                onPaste={handleOtpPaste}
                role="group"
                aria-label="Six digit reset code"
              >
                {otpValues.map((digit, index) => (
                  <input
                    key={index}
                    id={`rp-otp-digit-${index}`}
                    ref={(element) => {
                      otpRefs.current[index] = element;
                    }}
                    className="rp-otp-slot"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    aria-label={`OTP digit ${index + 1}`}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                  />
                ))}
              </div>

              <p className="rp-otp-helper-text">
                The code expires in 10 minutes. You can paste the full code.
              </p>
            </div>

            <div className="rp-field">
              <label className="rp-label" htmlFor="rp-new-password">
                New Password
              </label>

              <div className="rp-input-wrap">
                <input
                  id="rp-new-password"
                  className="rp-input rp-password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-label={password ? "New password entered" : "Enter new password"}
                  aria-describedby="rp-password-rules"
                />

                <button
                  type="button"
                  className="rp-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide new password" : "Show new password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="rp-field">
              <label className="rp-label" htmlFor="rp-confirm-password">
                Confirm Password
              </label>

              <div className="rp-input-wrap">
                <input
                  id="rp-confirm-password"
                  className="rp-input rp-password-input"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-label={
                    confirmPassword
                      ? "Confirm password entered"
                      : "Enter confirm password"
                  }
                  aria-describedby="rp-password-match-message"
                />

                <button
                  type="button"
                  className="rp-password-toggle"
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
            </div>

            <ul id="rp-password-rules" className="rp-password-rules">
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
                    className={`rp-password-rule ${
                      valid
                        ? "rp-password-rule-ok rp-password-rule-show"
                        : password
                        ? "rp-password-rule-show"
                        : ""
                    }`}
                    aria-label={`${ruleText}: ${
                      valid ? "correct" : "not yet correct"
                    }`}
                  >
                    <span className="rp-password-rule-icon" aria-hidden="true">
                      {valid ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                    </span>
                    <span className="rp-password-rule-text">{ruleText}</span>
                  </li>
                );
              })}
            </ul>

            <p
              id="rp-password-match-message"
              className={`rp-message ${passwordsMatch ? "rp-message-ok" : ""}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              tabIndex={confirmPassword ? "0" : undefined}
              aria-label={passwordMatchMessage || ""}
            >
              {confirmPassword && (
                <>
                  <span className="rp-message-icon" aria-hidden="true">
                    {passwordsMatch ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <Circle size={15} />
                    )}
                  </span>
                  <span>
                    {passwordsMatch
                      ? "Passwords match"
                      : "Passwords do not match"}
                  </span>
                </>
              )}
            </p>

            <button
              className="rp-submit-button"
              type="submit"
              disabled={resetting}
              aria-label={resetting ? "Resetting password" : "Reset password"}
            >
              {resetting ? "RESETTING..." : "RESET PASSWORD"}
            </button>
          </form>

          <div className="rp-resend-row">
            <button
              className="rp-resend-button"
              type="button"
              disabled={resending || resendSeconds > 0}
              onClick={handleResendCode}
              aria-label={
                resendSeconds > 0
                  ? `Resend code available in ${resendSeconds} seconds`
                  : "Resend reset code"
              }
            >
              {resendSeconds > 0
                ? `RESEND CODE IN ${resendSeconds}s`
                : resending
                ? "SENDING..."
                : "RESEND CODE"}
            </button>
          </div>

          <p className="rp-login-footer">
            Wrong email?{" "}
            <Link className="rp-login-link" to="/forgot-password">
              GO BACK
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
