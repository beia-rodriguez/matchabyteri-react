import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../services/api";
import "../assets/css/login.css";
import { Link } from "react-router-dom";


export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const redirect = new URLSearchParams(location.search).get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await API.post("/auth/login.php", {
        email,
        password,
      });

      if (res.data.status === "success") {
        localStorage.setItem("user", JSON.stringify(res.data.user));

        if (res.data.user.role === "admin") {
          navigate("/admin/dashboard");
        } else {
          navigate(redirect || "/");
        }
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError("Server error.");
    }
  };

  const togglePassword = () => {
    const input = document.getElementById("password");
    const isPw = input.type === "password";
    input.type = isPw ? "text" : "password";
  };

  return (
    <div className="login-page">
      <div className="shell">

        <div className="brand">
          <img
            className="brand-logo"
            src="/images/MBT_white 1.png"
            alt="Matcha By Teri"
          />
        </div>

        <div className="card">
          <h1>Login</h1>

          {error && <div className="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
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
              <label className="label" htmlFor="password">Password</label>
              <div className="input-wrap">
                <input
                  className="input"
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle"
                  onClick={togglePassword}
                  aria-label="Show password"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M2 12C4.5 7 8 4.5 12 4.5C16 4.5 19.5 7 22 12C19.5 17 16 19.5 12 19.5C8 19.5 4.5 17 2 12Z" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5Z" stroke="currentColor" strokeWidth="1.8"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="forgot">
              <a href="/forgot-password">Forgot Password?</a>
            </div>

            <button className="btn" type="submit">
              LOG IN
            </button>
          </form>

          <div className="footer">
            Need an account? <Link to="/sign-up">SIGN UP</Link>
          </div>
        </div>

      </div>
    </div>
  );
}