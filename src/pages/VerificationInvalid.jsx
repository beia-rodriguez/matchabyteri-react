import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import API from "../services/api";
import "../assets/css/signup.css";

export default function VerificationInvalid() {
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(
    location.state?.message || "Invalid or expired verification link."
  );
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const handleResend = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    try {
      setSending(true);

      const res = await API.post("/auth/resend-verification.php", {
        email: email.trim().toLowerCase(),
      });

      if (res.data.status === "success") {
        setMessage(res.data.message);
      } else {
        setError(res.data.message || "Could not resend verification email.");
      }
    } catch {
      setError("Server error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="signup-page">
      <section className="signup-card">
        <h1>Verification Failed</h1>

        {message && (
          <p className="msg" role="status" aria-live="polite">
            {message}
          </p>
        )}

        {error && (
          <div className="alert" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <form onSubmit={handleResend}>
          <div className="field">
            <label className="label" htmlFor="resend-email">
              Email
            </label>

            <input
              id="resend-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <button className="btn" type="submit" disabled={sending}>
            {sending ? "SENDING..." : "RESEND VERIFICATION EMAIL"}
          </button>
        </form>

        <div className="signup-footer">
          <Link to="/login">Back to Login</Link>
        </div>
      </section>
    </main>
  );
}