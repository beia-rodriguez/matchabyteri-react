import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import "../assets/css/signup.css";

export default function SignUp() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm_password: ""
  });

  const [error, setError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailAvailable, setEmailAvailable] = useState(false);

  const [rules, setRules] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  const [passwordsMatch, setPasswordsMatch] = useState(false);

  useEffect(() => {
    const pass = form.password;

    const updatedRules = {
      length: pass.length >= 8,
      upper: /[A-Z]/.test(pass),
      lower: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[\W_]/.test(pass)
    };

    setRules(updatedRules);
    setPasswordsMatch(pass && form.confirm_password === pass);
  }, [form.password, form.confirm_password]);

  useEffect(() => {
    if (!form.email) return;

    const timer = setTimeout(async () => {
      const res = await fetch(
        import.meta.env.VITE_API_BASE_URL + "/auth/check_email.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "email=" + encodeURIComponent(form.email)
        }
      );

      const text = await res.text();

      if (text.trim() === "taken") {
        setEmailMessage("Email already exists ❌");
        setEmailAvailable(false);
      } else {
        setEmailMessage("Email available ✅");
        setEmailAvailable(true);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [form.email]);

  const allValid =
    Object.values(rules).every(Boolean) &&
    passwordsMatch &&
    emailAvailable;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!allValid) return;

    const res = await API.post("/auth/sign-up.php", form);

    if (res.data.status === "success") {
      navigate("/login");
    } else {
      setError(res.data.message);
    }
  };

  const togglePassword = (id) => {
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
  };

  return (
    <div className="signup-page">
      <div className="shell">
        <div className="brand">
          <img className="brand-logo" src="/images/MBT_white 1.png" alt="Matcha By Teri" />
        </div>

        <div className="signup-card">
          <h1>Sign Up</h1>

          {error && <div className="alert">{error}</div>}

          <form onSubmit={handleSubmit}>

            <div className="field">
              <label className="label">Full Name</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                required
              />
            </div>

            <div className="field">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                required
              />
              <p className="msg">{emailMessage}</p>
            </div>

            <div className="field">
              <label className="label">Password</label>
              <div className="input-wrap">
                <input
                  id="password"
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  required
                />
                <button type="button" className="toggle" onClick={()=>togglePassword("password")}>
                  👁
                </button>
              </div>

              <ul className="rules">
                {Object.entries(rules).map(([key, val]) => (
                  <li key={key} className={`rule ${val ? "ok show" : form.password ? "show" : ""}`}>
                    <span className="dot"></span>
                    <span className="text">
                      {{
                        length:"At least 8 characters",
                        upper:"At least 1 uppercase letter",
                        lower:"At least 1 lowercase letter",
                        number:"At least 1 number",
                        special:"At least 1 special character"
                      }[key]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="field">
              <label className="label">Confirm Password</label>
              <div className="input-wrap">
                <input
                  id="confirm_password"
                  className="input"
                  type="password"
                  value={form.confirm_password}
                  onChange={e => setForm({...form, confirm_password: e.target.value})}
                  required
                />
                <button type="button" className="toggle" onClick={()=>togglePassword("confirm_password")}>
                  👁
                </button>
              </div>

              <p className="msg">
                {form.confirm_password &&
                  (passwordsMatch ? "Passwords match ✅" : "Passwords do not match!")}
              </p>
            </div>

            <button className="btn" disabled={!allValid}>
              SIGN UP
            </button>
          </form>

          <div className="signup-footer">
            Already a user? <a href="/login">LOG IN</a>
          </div>
        </div>
      </div>
    </div>
  );
}