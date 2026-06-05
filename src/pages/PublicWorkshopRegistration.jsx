import { useEffect, useReducer } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/public-workshop-registration.css";
import "../assets/css/universal.css";

const initialState = {
  loading: true,
  submitting: false,
  err: "",
  data: null,
  form: {
    full_name: "",
    email: "",
    phone: "",
  },
};

function posterSrc(path) {
  const fallback = "/pics/default-workshop.jpg";
  if (!path) return fallback;

  const rawPath = String(path).trim();
  if (!rawPath) return fallback;

  if (/^https?:\/\//i.test(rawPath)) return rawPath;

  const clean = rawPath.replace(/^\/+/, "");

  if (clean.startsWith("backend/api/")) {
    return `/${clean}`;
  }

  if (clean.startsWith("uploads/")) {
    return `/backend/api/${clean}`;
  }

  return `/backend/api/uploads/${clean}`;
}

function formatPrice(value) {
  return `₱${Number(value || 0).toFixed(2)}`;
}

function registrationReducer(state, action) {
  switch (action.type) {
    case "LOAD_STARTED":
      return {
        ...state,
        loading: true,
        err: "",
      };

    case "LOAD_SUCCEEDED":
      return {
        ...state,
        loading: false,
        data: action.payload,
        form: {
          full_name: action.payload.user?.name || "",
          email: action.payload.user?.email || "",
          phone: action.payload.user?.phone_number || "",
        },
      };

    case "LOAD_FAILED":
      return {
        ...state,
        loading: false,
        err: action.payload,
      };

    case "FIELD_CHANGED":
      return {
        ...state,
        form: {
          ...state.form,
          [action.name]: action.value,
        },
      };

    case "SUBMIT_STARTED":
      return {
        ...state,
        submitting: true,
        err: "",
      };

    case "SUBMIT_FAILED":
      return {
        ...state,
        submitting: false,
        err: action.payload,
      };

    case "SUBMIT_FINISHED":
      return {
        ...state,
        submitting: false,
      };

    case "SET_ERROR":
      return {
        ...state,
        err: action.payload,
      };

    default:
      return state;
  }
}

function useReadableRegistrationContent({
  loading,
  submitting,
  err,
  data,
  form,
  packageType,
}) {
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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .pwr-card, .pwr-alert, .pwr-meta, .pwr-package-pill, .pwr-back, .pwr-price, .pwr-helper"
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
}

function PageShell({ children }) {
  return (
    <>
      <Navbar />
      <div className="pwr-page" id="readable-content">
        <main className="pwr-wrap">{children}</main>
      </div>
    </>
  );
}

function LoadingCard() {
  return (
    <div className="pwr-card">
      <div className="pwr-meta">Loading registration...</div>
    </div>
  );
}

function ErrorCard({ err, onBack }) {
  return (
    <div className="pwr-card">
      <div className="pwr-alert pwr-alert-bad">{err}</div>

      <button
        className="pwr-back"
        type="button"
        aria-label="Back to Workshops"
        onClick={onBack}
      >
        Back to Workshops
      </button>
    </div>
  );
}

function WorkshopSummary({ workshop, price, packageType }) {
  const packageLabel = packageType === "premium" ? "Premium" : "Standard";

  return (
    <div className="pwr-top">
      <div className="pwr-poster">
        <img
          src={posterSrc(workshop?.poster_path)}
          alt={workshop?.title || "Workshop poster"}
          onError={(e) => {
            e.currentTarget.src = "/pics/default-workshop.jpg";
          }}
        />
      </div>

      <div className="pwr-title">
        <div className="pwr-kicker">Workshop Registration</div>

        <h1>Register Now</h1>

        <div className="pwr-workshop-name">{workshop?.title}</div>

        <div
          className="pwr-package-pill"
          aria-label={`Package: ${packageLabel}`}
        >
          {packageLabel} Package
        </div>

        <div className="pwr-price">
          <span>Price</span>
          {formatPrice(price)}
        </div>

        <div className="pwr-meta">
          {workshop?.dateText && (
            <>
              Date: {workshop.dateText}
              <br />
            </>
          )}
          {workshop?.timeText && (
            <>
              Time: {workshop.timeText}
              <br />
            </>
          )}
          {workshop?.location && <>Location: {workshop.location}</>}
        </div>
      </div>
    </div>
  );
}

function RegistrationForm({ form, submitting, onChange, onSubmit }) {
  return (
    <form className="pwr-form" onSubmit={onSubmit}>
      <div className="pwr-form-heading">
        <h2>Your Details</h2>
        <p className="pwr-helper">
          Please review your information before continuing to payment.
        </p>
      </div>

      <div className="pwr-field">
        <label htmlFor="full_name">Full Name</label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          value={form.full_name}
          onChange={onChange}
          required
          aria-label={
            form.full_name.trim()
              ? `Full Name: ${form.full_name}`
              : "Enter Full Name"
          }
        />
      </div>

      <div className="pwr-row">
        <div className="pwr-field">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={form.email}
            onChange={onChange}
            required
            aria-label={
              form.email.trim()
                ? `Email Address: ${form.email}`
                : "Enter Email Address"
            }
          />
        </div>

        <div className="pwr-field">
          <label htmlFor="phone">Phone Number</label>
          <input
            type="text"
            id="phone"
            name="phone"
            value={form.phone}
            onChange={onChange}
            required
            aria-label={
              form.phone.trim()
                ? `Phone Number: ${form.phone}`
                : "Enter Phone Number"
            }
          />
        </div>
      </div>

      <button
        className="pwr-submit"
        type="submit"
        disabled={submitting}
        aria-label={submitting ? "Registering" : "Register"}
      >
        {submitting ? "Registering..." : "Register"}
      </button>
    </form>
  );
}

function RegistrationCard({
  err,
  workshop,
  price,
  packageType,
  form,
  submitting,
  onChange,
  onSubmit,
  onBackToPackages,
}) {
  return (
    <div className="pwr-card">
      {err && <div className="pwr-alert pwr-alert-bad">{err}</div>}

      <WorkshopSummary
        workshop={workshop}
        price={price}
        packageType={packageType}
      />

      <RegistrationForm
        form={form}
        submitting={submitting}
        onChange={onChange}
        onSubmit={onSubmit}
      />

      <button
        className="pwr-back"
        type="button"
        aria-label="Back to Packages"
        onClick={onBackToPackages}
      >
        Back to Packages
      </button>
    </div>
  );
}

export default function PublicWorkshopRegistration() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = Number(searchParams.get("id") || 0);
  const packageType = String(searchParams.get("package") || "").toLowerCase();
  const [state, dispatch] = useReducer(registrationReducer, initialState);
  const { loading, submitting, err, data, form } = state;

  useReadableRegistrationContent({
    loading,
    submitting,
    err,
    data,
    form,
    packageType,
  });

  useEffect(() => {
    const loadRegistrationInfo = async () => {
      dispatch({ type: "LOAD_STARTED" });

      try {
        const response = await API.get(
          "/bookings/public-workshop/register-public-workshop.php",
          {
            params: {
              id,
              package: packageType,
            },
          }
        );

        if (!response.data.success) {
          dispatch({
            type: "LOAD_FAILED",
            payload: response.data.error || "Failed to load registration.",
          });
          return;
        }

        dispatch({ type: "LOAD_SUCCEEDED", payload: response.data });
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        dispatch({
          type: "LOAD_FAILED",
          payload: error.response?.data?.error || "Failed to load registration.",
        });
      }
    };

    if (!id || !["standard", "premium"].includes(packageType)) {
      navigate("/public-workshops");
      return;
    }

    loadRegistrationInfo();
  }, [id, packageType, navigate]);

  const updateRegistrationField = (e) => {
    const { name, value } = e.target;
    dispatch({ type: "FIELD_CHANGED", name, value });
  };

  const submitRegistration = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim()) {
      dispatch({ type: "SET_ERROR", payload: "Please complete all fields." });
      return;
    }

    dispatch({ type: "SUBMIT_STARTED" });

    try {
      const response = await API.post(
        "/bookings/public-workshop/register-public-workshop.php",
        {
          id,
          package: packageType,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        }
      );

      if (!response.data.success) {
        dispatch({
          type: "SUBMIT_FAILED",
          payload: response.data.error || "Failed to submit registration.",
        });
        return;
      }

      navigate(
        `/gcash-payment?purpose=workshop_public&registration_id=${response.data.registration_id}`
      );
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }

      dispatch({
        type: "SUBMIT_FAILED",
        payload: error.response?.data?.error || "Failed to submit registration.",
      });
    } finally {
      dispatch({ type: "SUBMIT_FINISHED" });
    }
  };

  if (loading) {
    return (
      <PageShell>
        <LoadingCard />
      </PageShell>
    );
  }

  if (err && !data) {
    return (
      <PageShell>
        <ErrorCard err={err} onBack={() => navigate("/public-workshops")} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <RegistrationCard
        err={err}
        workshop={data?.workshop}
        price={data?.price}
        packageType={packageType}
        form={form}
        submitting={submitting}
        onChange={updateRegistrationField}
        onSubmit={submitRegistration}
        onBackToPackages={() => navigate(`/public-workshops/${id}/register`)}
      />
    </PageShell>
  );
}