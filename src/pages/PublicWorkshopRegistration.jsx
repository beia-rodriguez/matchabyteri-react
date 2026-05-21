import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/public-workshop-registration.css";
import "../assets/css/universal.css";

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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .pwr-card, .pwr-alert, .pwr-meta, .pwr-package-pill, .pwr-back"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (
        tagName !== "button" &&
        tagName !== "a" &&
        tagName !== "input" &&
        tagName !== "textarea" &&
        tagName !== "select"
      ) {
        element.removeAttribute("tabindex");
      }

      if (!isVisible(element)) return;

      let textToRead = "";

      if (tagName === "img") {
        textToRead = element.getAttribute("alt") || "";
      } else if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        const parentDiv = element.closest("div");
        const label = parentDiv?.querySelector("label");

        textToRead =
          element.getAttribute("aria-label") ||
          label?.innerText ||
          element.placeholder ||
          element.value ||
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

      if (!textToRead.trim()) return;

      if (
        tagName !== "button" &&
        tagName !== "a" &&
        tagName !== "input" &&
        tagName !== "textarea" &&
        tagName !== "select"
      ) {
        element.setAttribute("tabindex", "0");
      }

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", textToRead.trim());
      }
    });
  }, [loading, submitting, err, data, form, packageType]);

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
        <div className="pwr-page" id="readable-content">
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
        <div className="pwr-page" id="readable-content">
          <div className="pwr-wrap">
            <div className="pwr-card">
              <div className="pwr-alert pwr-alert-bad">{err}</div>
              <button
                className="pwr-back"
                type="button"
                aria-label="Back to Workshops"
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

      <div className="pwr-page" id="readable-content">
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

                <div
                  className="pwr-package-pill"
                  aria-label={`Package: ${
                    packageType === "premium" ? "Premium" : "Standard"
                  }`}
                >
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
                  aria-label={
                    form.full_name.trim()
                      ? `Full Name: ${form.full_name}`
                      : "Enter Full Name"
                  }
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
                    aria-label={
                      form.email.trim()
                        ? `Email Address: ${form.email}`
                        : "Enter Email Address"
                    }
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
                    aria-label={
                      form.phone.trim()
                        ? `Phone Number: ${form.phone}`
                        : "Enter Phone Number"
                    }
                  />
                </div>
              </div>

              <input
                type="submit"
                value={submitting ? "REGISTERING..." : "REGISTER"}
                disabled={submitting}
                aria-label={submitting ? "Registering" : "Register"}
              />
            </form>

            <button
              className="pwr-back"
              type="button"
              aria-label="Back to Packages"
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