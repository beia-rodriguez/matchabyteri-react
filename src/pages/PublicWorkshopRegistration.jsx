import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/public-workshop-registration.css";

function posterSrc(path) {
  const fallback = "/pics/default-workshop.jpg";
  if (!path) return fallback;
  if (/^https?:\/\//i.test(path)) return path;

  const clean = String(path).trim().replace(/^\/+/, "");
  if (clean.startsWith("uploads/")) return `/api/${clean}`;
  return `/${clean}`;
}

export default function PublicWorkshopRegistration() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const id = Number(searchParams.get("id") || 0);
  const packageType = String(searchParams.get("package") || "").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (!id || !["standard", "premium"].includes(packageType)) {
      navigate("/public-workshops");
      return;
    }

    loadRegistrationInfo();
  }, [id, packageType, navigate]);

  const loadRegistrationInfo = async () => {
    setLoading(true);
    setErr("");

    try {
      const { data } = await API.get(
        "/bookings/public-workshop/register-public-workshop.php",
        {
          params: {
            id,
            package: packageType,
          },
        }
      );

      if (!data.success) {
        setErr(data.error || "Failed to load registration.");
        return;
      }

      setData(data);

      setForm({
        full_name: data.user?.name || "",
        email: data.user?.email || "",
        phone: data.user?.phone_number || "",
      });
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }

      setErr(error.response?.data?.error || "Failed to load registration.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;

    setErr("");

    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim()) {
      setErr("Please complete all fields.");
      return;
    }

    setSubmitting(true);

    try {
      const { data } = await API.post(
        "/bookings/public-workshop/register-public-workshop.php",
        {
          id,
          package: packageType,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        }
      );

      if (!data.success) {
        setErr(data.error || "Failed to submit registration.");
        return;
      }

      navigate(
        `/gcash-payment?purpose=workshop_public&registration_id=${data.registration_id}`
      );
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }

      setErr(error.response?.data?.error || "Failed to submit registration.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="pwr-page">
          <div className="pwr-wrap">
            <div className="pwr-card">Loading registration...</div>
          </div>
        </div>
      </>
    );
  }

  if (err && !data) {
    return (
      <>
        <Navbar />
        <div className="pwr-page">
          <div className="pwr-wrap">
            <div className="pwr-card">
              <div className="pwr-alert pwr-alert-bad">{err}</div>
              <button
                className="pwr-back"
                type="button"
                onClick={() => navigate("/public-workshops")}
              >
                ← Back to Workshops
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const workshop = data?.workshop;

  return (
    <>
      <Navbar />

      <div className="pwr-page">
        <div className="pwr-wrap">
          <div className="pwr-card">
            {err && <div className="pwr-alert pwr-alert-bad">{err}</div>}

            <div className="pwr-top">
              <div className="pwr-poster">
                <img
                  src={posterSrc(workshop?.poster_path)}
                  alt="Workshop Poster"
                  onError={(e) => {
                    e.currentTarget.src = "/pics/default-workshop.jpg";
                  }}
                />
              </div>

              <div className="pwr-title">
                <h1>Register Now</h1>

                <div className="pwr-meta">
                  {workshop?.title}
                  <br />
                  Date: {workshop?.dateText}
                  <br />
                  Time: {workshop?.timeText}
                  <br />
                  Location: {workshop?.location}
                  <br />
                  Price: ₱{Number(data?.price || 0).toFixed(2)}
                </div>

                <div className="pwr-package-pill">
                  Package: {packageType.toUpperCase()}
                </div>
              </div>
            </div>

            <form className="pwr-form" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="full_name">Full Name</label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="pwr-row">
                <div>
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="text"
                    id="phone"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <input
                type="submit"
                value={submitting ? "REGISTERING..." : "REGISTER"}
                disabled={submitting}
              />
            </form>

            <button
              className="pwr-back"
              type="button"
              onClick={() => navigate(`/public-workshops/${id}/register`)}
            >
              ← Back to Packages
            </button>
          </div>
        </div>
      </div>
    </>
  );
}