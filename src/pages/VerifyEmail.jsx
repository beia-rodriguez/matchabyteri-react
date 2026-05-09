import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../services/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const verify = async () => {
      const token = searchParams.get("token");

      if (!token) {
        navigate("/verification-invalid", {
          replace: true,
          state: { message: "Verification token is missing." },
        });
        return;
      }

      try {
        const res = await API.get(
          `/auth/verify-email.php?token=${encodeURIComponent(token)}`
        );

        if (res.data.status === "success") {
          navigate("/verification-success", {
            replace: true,
            state: { message: res.data.message },
          });
        } else {
          navigate("/verification-invalid", {
            replace: true,
            state: { message: res.data.message },
          });
        }
      } catch {
        navigate("/verification-invalid", {
          replace: true,
          state: { message: "Could not verify your email. Please try again." },
        });
      }
    };

    verify();
  }, [navigate, searchParams]);

  return (
    <main className="signup-page">
      <section className="signup-card" role="status" aria-live="polite">
        <h1>Email Verification</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}