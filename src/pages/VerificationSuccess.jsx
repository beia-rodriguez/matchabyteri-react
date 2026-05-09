import { Link, useLocation } from "react-router-dom";
import "../assets/css/signup.css";

export default function VerificationSuccess() {
  const location = useLocation();

  return (
    <main className="signup-page">
      <section className="signup-card">
        <h1>Email Verified</h1>

        <p className="msg" role="status">
          {location.state?.message ||
            "Your email has been verified successfully."}
        </p>

        <Link className="btn" to="/login">
          GO TO LOGIN
        </Link>
      </section>
    </main>
  );
}