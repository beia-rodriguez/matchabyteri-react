import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/add-booking.css";
import { useEffect } from "react";


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

  const handleReview = async () => {
    setError("");

    try {
      const res = await API.post(
        "/bookings/event/validate-event-booking.php",
        {
          date,
          start_time: form.start_time,
          end_time: form.end_time,
        }
      );

      if (res.data.success) {
        setStep("review");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Validation failed.");
    }
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
          draft: form,
        }
      );

      if (res.data.success) {
        navigate(
          `/gcash-payment?purpose=event_booking&booking_id=${res.data.booking_id}`
        );
      }
    } catch (err) {
      setError(err.response?.data?.error || "Booking failed.");
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
              <h2>Book your event now!</h2>

              <div className="field">
                <label>Full Name</label>
                <input name="full_name" onChange={handleChange} />
              </div>

              <div className="field">
                <label>Phone Number</label>
                <input name="phone_number" onChange={handleChange} />
              </div>

              <div className="field">
                <label>Email</label>
                <input name="email" onChange={handleChange} />
              </div>

              <div className="field">
                <label>Event Type</label>
                <select name="event_type" onChange={handleChange}>
                  <option value=""></option>
                  <option>Birthday Party</option>
                  <option>Corporate Event</option>
                  <option>Product Launch</option>
                  <option>Bridal Shower</option>
                  <option>Baby Shower</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="field">
                <label>Event Name</label>
                <input name="event_name" onChange={handleChange} />
              </div>

              <div className="field">
                <label>Location</label>
                <input name="location" onChange={handleChange} />
              </div>

              <div className="field">
                <label>Guests</label>
                <select name="guests" onChange={handleChange}>
                  <option value=""></option>
                  <option>10 - 20</option>
                  <option>21 - 30</option>
                  <option>31 - 40</option>
                  <option>41 - 50</option>
                  <option>50+</option>
                </select>
              </div>

              <div className="two-col">
                <input
                  type="time"
                  name="start_time"
                  onChange={handleChange}
                />
                <input
                  type="time"
                  name="end_time"
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label>Cup Package</label>
                <input
                  type="radio"
                  name="cup_package"
                  value="50 cups = 13,000"
                  onChange={handleChange}
                /> 50 cups = 13,000
              </div>

              <button className="btn-next" onClick={handleReview}>
                NEXT
              </button>
            </>
          )}

          {step === "review" && (
            <>
              <h2>Review Your Booking</h2>

              <pre style={{ background: "#f5f5f5", padding: 15 }}>
                {JSON.stringify(form, null, 2)}
              </pre>

              <button
                className="btn-edit"
                onClick={() => setStep("form")}
              >
                EDIT
              </button>

              <button
                className="btn-confirm"
                onClick={handleConfirm}
              >
                CONFIRM
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}