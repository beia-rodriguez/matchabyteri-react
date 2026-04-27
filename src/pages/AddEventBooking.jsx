import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/add-booking.css";

export default function AddEventBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const date = searchParams.get("date");
  const type = "event";

  useEffect(() => {
    if (!date) {
      navigate("/calendar");
    }
  }, [date, navigate]);

  const [step, setStep] = useState("form");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    email: "",
    contact_methods: [],
    event_type: "",
    event_name: "",
    location: "",
    guests: "",
    start_time: "",
    end_time: "",
    other_request: "",
    cup_package: "",
    menu_option: "",
    milk_option: "",
    addons: [],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleCheckbox = (e, field) => {
    const value = e.target.value;

    if (e.target.checked) {
      setForm({ ...form, [field]: [...form[field], value] });
    } else {
      setForm({
        ...form,
        [field]: form[field].filter((v) => v !== value),
      });
    }
  };

  const handleStartTime = (e) => {
    const start = e.target.value;

    setForm({
      ...form,
      start_time: start,
      end_time: addHours(start, 4),
    });
  };

  const pad = (n) => String(n).padStart(2, "0");

  const addHours = (timeStr, hoursToAdd) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);

    const d = new Date(2000, 0, 1, h, m, 0);
    d.setHours(d.getHours() + hoursToAdd);

    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

 const handleReview = () => {
  setError("");

  // Optional: basic validation
  if (!form.full_name || !form.email || !form.start_time) {
    setError("Please fill out required fields: name, email, start time.");
    return;
  }

  // No API call here — just move to review step
  setStep("review");
};

const handleConfirm = async () => {
  setError("");
  try {
    const res = await API.post(
      "/bookings/event/create-event-booking.php",
      {
        date,
        start_time: form.start_time,
        end_time: form.end_time,
        draft: form, // sends all form fields
      }
    );

    console.log("API Response:", res); // DEBUG: log full response

    if (res.data.success) {
      const newId = res.data.booking_id;
      navigate(`/gcash-payment?purpose=event_booking&booking_id=${newId}`);
    } else {
      console.log("Booking error data:", res.data); // DEBUG: log error payload
      setError(res.data.error || "Booking failed.");
    }
  } catch (err) {
    console.error("Confirm error:", err); // DEBUG: log entire error object

    if (err.response) {
      // Server responded with status code != 2xx
      console.log("Error response data:", err.response.data);
      console.log("Error response status:", err.response.status);
      console.log("Error response headers:", err.response.headers);

      if (err.response.status === 401) {
        setError("Please log in to confirm your booking.");
        navigate("/login");
      } else {
        setError(err.response.data?.error || "Connection error. Please try again.");
      }
    } else if (err.request) {
      // Request made but no response
      console.log("No response received:", err.request);
      setError("No response from server. Check backend or network.");
    } else {
      // Something else caused the error
      console.log("Error message:", err.message);
      setError(err.message || "Something went wrong. Try again.");
    }
  }
};

  return (
    <>
      <Navbar />

      <div className="booking-page">
        <div className="wrap">

          <div className="top">
            <button
              className="back"
              onClick={() =>
                navigate(`/day?date=${date}&type=event`)
              }
            >
              ← Back
            </button>

            <div className="date-title">{date}</div>
          </div>

          {error && <div className="error">{error}</div>}

          {step === "form" && (
            <>
              <div className="title">Book your event now!</div>

              <div className="section-title">CONTACT INFORMATION</div>

              <div className="field">
                <label className="label">Full Name</label>
                <input
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label className="label">Phone Number</label>
                <input
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label className="label">Email Address</label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label className="label">
                  Are you available to contact in the following:
                </label>

                <div className="options">
                  {["Text", "Call", "Viber", "Whatsapp"].map((m) => (
                    <label className="opt" key={m}>
                      <input
                        type="checkbox"
                        value={m}
                        checked={form.contact_methods.includes(m)}
                        onChange={(e) =>
                          handleCheckbox(e, "contact_methods")
                        }
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <div className="section-title">EVENT INFORMATION</div>

              <div className="field">
                <label className="label">Type of Event</label>

                <select
                  name="event_type"
                  value={form.event_type}
                  onChange={handleChange}
                >
                  <option value=""></option>

                  {[
                    "Birthday Party",
                    "Corporate Event",
                    "Product Launch",
                    "Bridal Shower",
                    "Baby Shower",
                    "Other",
                  ].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label">Event Name</label>
                <input
                  name="event_name"
                  value={form.event_name}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label className="label">Location</label>
                <input
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label className="label">Estimate Number of Guest</label>

                <select
                  name="guests"
                  value={form.guests}
                  onChange={handleChange}
                >
                  <option value=""></option>

                  {[
                    "10 - 20",
                    "21 - 30",
                    "31 - 40",
                    "41 - 50",
                    "50+",
                  ].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="two-col">
                <div className="field">
                  <label className="label">Work Hours</label>

                  <input
                    type="time"
                    name="start_time"
                    value={form.start_time}
                    onChange={handleStartTime}
                  />
                </div>

                <div className="field">
                  <label className="label">&nbsp;</label>

                  <input
                    type="time"
                    name="end_time"
                    value={form.end_time}
                    readOnly
                  />
                </div>
              </div>

              <div className="small-note">
                Up to 4 hours operation
              </div>

              <div className="field">
                <label className="label">Other Request (Optional)</label>

                <input
                  name="other_request"
                  value={form.other_request}
                  onChange={handleChange}
                />
              </div>

              <div className="section-title">MODIFICATIONS</div>

              <div className="field">
                <label className="label">Cup Packages</label>

                <div className="options">
                  {[
                    "50 cups = 13,000",
                    "75 cups = 21,000",
                    "100 cups = 26,000",
                    "150 cups = 34,500",
                    "200 cups = 40,000",
                  ].map((c) => (
                    <label className="opt" key={c}>
                      <input
                        type="radio"
                        name="cup_package"
                        value={c}
                        checked={form.cup_package === c}
                        onChange={handleChange}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="label">Menu</label>

                <div className="options">
                  {[
                    "4 menu items (as is price as cup packages)",
                    "6 menu items (+1,500)",
                    "8 menu items (+3,000)",
                    "Customized cups logo (+12/cup)",
                  ].map((m) => (
                    <label className="opt" key={m}>
                      <input
                        type="radio"
                        name="menu_option"
                        value={m}
                        checked={form.menu_option === m}
                        onChange={handleChange}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="label">Milk Options</label>

                <div className="small-note">
                  we offer Oatmilk as default
                </div>

                <div className="options">
                  {[
                    "Dairy Milk (+1,500)",
                    "Non-fat Milk (+1,500)",
                  ].map((m) => (
                    <label className="opt" key={m}>
                      <input
                        type="radio"
                        name="milk_option"
                        value={m}
                        checked={form.milk_option === m}
                        onChange={handleChange}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="label">Add-ons</label>

                <div className="options">
                  {[
                    "Extra staff (+800/staff)",
                    "Sintra board sign",
                  ].map((a) => (
                    <label className="opt" key={a}>
                      <input
                        type="checkbox"
                        value={a}
                        checked={form.addons.includes(a)}
                        onChange={(e) => handleCheckbox(e, "addons")}
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </div>

              <div className="actions">
                <button
                  className="btn btn-cancel"
                  onClick={() =>
                    navigate(`/day?date=${date}&type=event`)
                  }
                >
                  CANCEL
                </button>

                <button
                  className="btn btn-next"
                  onClick={handleReview}
                >
                  NEXT
                </button>
              </div>
            </>
          )}

          {step === "review" && (
  <>
    <div className="title">
      Please review your details carefully, before confirmation.
    </div>

    {/* Booking Review Card */}
    <div className="booking-summary animate-fade-in">
      {Object.entries(form).map(([key, value]) => {
        // Skip empty fields
        if (value === "" || (Array.isArray(value) && value.length === 0)) return null;

        // Format key nicely
        const label = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        // Format arrays as comma-separated
        const displayValue = Array.isArray(value) ? value.join(", ") : value;

        return (
          <div className="booking-row" key={key}>
            <span className="booking-label">{label}</span>
            <span className="booking-value">{displayValue}</span>
          </div>
        );
      })}
    </div>

    <div className="actions">
      <button
        className="btn btn-edit"
        onClick={() => setStep("form")}
      >
        EDIT
      </button>

      <button
        className="btn btn-confirm"
        onClick={handleConfirm}
      >
        CONFIRM
      </button>
    </div>
  </>
)}
        </div>
      </div>
    </>
  );
}