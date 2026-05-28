import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/add-booking.css";
import "../assets/css/universal.css";

const CONTACT_METHODS = [
  { value: "Text", label: "Text" },
  { value: "Call", label: "Call" },
  { value: "Viber", label: "Viber" },
  { value: "Whatsapp", label: "WhatsApp" },
];

const CUP_PACKAGES = [50, 100, 150, 200];

const MENU_PACKAGES = [
  {
    value: "SIGNATURE",
    label: "Signature",
    description:
      "4 signature drinks: Basic Matcha Latte, Earl Grey Matcha Latte, Peach Mango Matcha Latte, AM Matcha ’Ricano",
  },
  {
    value: "PLUS",
    label: "Plus",
    description: "Signature drinks + 2 additional drinks of choice",
  },
  {
    value: "PREMIUM",
    label: "Premium",
    description: "Signature drinks + 4 additional drinks of choice",
  },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function addHours(timeStr, hoursToAdd) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m, 0);
  d.setHours(d.getHours() + hoursToAdd);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AddEventBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const date = searchParams.get("date");

  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [pricing, setPricing] = useState({
    event_50_cups_price_per_cup: 230,
    event_100_cups_price_per_cup: 220,
    event_150_cups_price_per_cup: 210,
    event_200_cups_price_per_cup: 200,
    event_signature_addon: 0,
    event_plus_addon: 1000,
    event_premium_addon: 2000,
    event_booking_downpayment_percentage: 50,
  });

  const [fixedInfo, setFixedInfo] = useState({
    full_name: "",
    phone_number: "",
    email: "",
    contact_methods: [],
    start_time: "",
    end_time: "",
    event_type: "",
    event_name: "",
    event_location: "",
    other_request: "",
  });

  const [eventInfo, setEventInfo] = useState({
    cup_quantity: 100,
    menu_package: "SIGNATURE",
    selected_drinks: "",
    hojicha_options: "Matcha only",
  });

  useEffect(() => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      navigate("/calendar");
    }
  }, [date, navigate]);

  useEffect(() => {
    loadPricing();
    loadCurrentUser();
  }, []);

  const loadPricing = async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await API.get("/bookings/get-active-booking-form.php", {
        params: { type: "event_booking" },
      });

      if (data.pricing) {
        setPricing((prev) => ({ ...prev, ...data.pricing }));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load event pricing.");
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const { data } = await API.get("/user/current-user.php");

      if (data.success && data.user) {
        setFixedInfo((prev) => ({
          ...prev,
          full_name: data.user.name || prev.full_name,
          email: data.user.email || prev.email,
          phone_number: data.user.phone_number || prev.phone_number,
        }));
      }
    } catch {
      // keep empty fields
    }
  };

  const cupPriceKey = `event_${eventInfo.cup_quantity}_cups_price_per_cup`;

  const menuAddonKey = {
    SIGNATURE: "event_signature_addon",
    PLUS: "event_plus_addon",
    PREMIUM: "event_premium_addon",
  }[eventInfo.menu_package];

  const totalAmount = useMemo(() => {
    const cupTotal =
      Number(eventInfo.cup_quantity || 0) * Number(pricing[cupPriceKey] || 0);
    const addon = Number(pricing[menuAddonKey] || 0);
    return cupTotal + addon;
  }, [eventInfo.cup_quantity, eventInfo.menu_package, pricing, cupPriceKey, menuAddonKey]);

  const dueNow = useMemo(() => {
    return (
      totalAmount *
      (Number(pricing.event_booking_downpayment_percentage || 50) / 100)
    );
  }, [totalAmount, pricing.event_booking_downpayment_percentage]);

  const handleFixedChange = (e) => {
    const { name, value } = e.target;

    if (name === "start_time") {
      setFixedInfo((prev) => ({
        ...prev,
        start_time: value,
        end_time: addHours(value, 4),
      }));
      return;
    }

    setFixedInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleEventChange = (e) => {
    const { name, value } = e.target;

    setEventInfo((prev) => ({
      ...prev,
      [name]: name === "cup_quantity" ? Number(value) : value,
    }));
  };

  const handleContactMethod = (e) => {
    const { value, checked } = e.target;

    setFixedInfo((prev) => ({
      ...prev,
      contact_methods: checked
        ? [...prev.contact_methods, value]
        : prev.contact_methods.filter((item) => item !== value),
    }));
  };

  const validateForm = () => {
    if (!fixedInfo.full_name.trim()) return "Full name is required.";
    if (!fixedInfo.phone_number.trim()) return "Phone number is required.";
    if (!fixedInfo.email.trim()) return "Email is required.";
    if (!fixedInfo.start_time || !fixedInfo.end_time) return "Start time is required.";
    if (!fixedInfo.event_type.trim()) return "Type of event is required.";
    if (!fixedInfo.event_name.trim()) return "Event name is required.";
    if (!fixedInfo.event_location.trim()) return "Event location is required.";
    if (!eventInfo.cup_quantity) return "Cup package is required.";
    if (!eventInfo.menu_package) return "Menu package is required.";
    if (totalAmount <= 0) return "Invalid total amount.";
    return "";
  };

  const handleReview = async () => {
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const res = await API.post("/bookings/event/validate-event-booking.php", {
        date,
        start_time: fixedInfo.start_time,
        end_time: fixedInfo.end_time,
      });

      if (res.data.success) {
        setStep("review");
      } else {
        setError(res.data.error || "Booking is not available.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to validate booking.");
    }
  };

  const buildDraft = () => ({
    ...fixedInfo,
    ...eventInfo,
    booking_type: "event_booking",
    price_per_cup: Number(pricing[cupPriceKey] || 0),
    menu_addon: Number(pricing[menuAddonKey] || 0),
    total_amount: totalAmount,
  });

  const handleConfirm = async () => {
    setError("");

    try {
      const res = await API.post("/bookings/event/create-event-booking.php", {
        date,
        start_time: fixedInfo.start_time,
        end_time: fixedInfo.end_time,
        draft: buildDraft(),
      });

      if (res.data.success) {
        navigate(`/gcash-payment?purpose=event_booking&booking_id=${res.data.booking_id}`);
      } else {
        setError(res.data.error || "Booking failed.");
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Please log in to confirm your booking.");
        navigate("/login");
      } else {
        setError(err.response?.data?.error || "Connection error. Please try again.");
      }
    }
  };

  return (
    <>
      <Navbar />

      <div className="booking-page" id="readable-content">
        <div className="wrap">
          <div className="top">
            <button
              className="back"
              type="button"
              aria-label="Back"
              onClick={() => navigate(`/day?date=${date}&type=event`)}
            >
              <img src="/images/left-book.png" alt="" aria-hidden="true" />
            </button>

            <div className="date-title">{date}</div>
          </div>

          <div className="card">
            {error && <div className="error">{error}</div>}

            {loading ? (
              <div className="title">Loading event booking...</div>
            ) : step === "review" ? (
              <>
                <div className="title">Please review your event booking</div>

                <div className="section-title">CONTACT INFORMATION</div>
                <ReviewRow label="Full Name" value={fixedInfo.full_name} />
                <ReviewRow label="Phone Number" value={fixedInfo.phone_number} />
                <ReviewRow label="Email Address" value={fixedInfo.email} />
                <ReviewRow label="Contact Methods" value={fixedInfo.contact_methods.join(", ")} />

                <div className="section-title">BOOKING INFORMATION</div>
                <ReviewRow label="Date" value={date} />
                <ReviewRow label="Start Time" value={fixedInfo.start_time} />
                <ReviewRow label="End Time" value={fixedInfo.end_time} />
                <ReviewRow label="Type of Event" value={fixedInfo.event_type} />
                <ReviewRow label="Event Name" value={fixedInfo.event_name} />
                <ReviewRow label="Location" value={fixedInfo.event_location} />

                <div className="section-title">PACKAGE DETAILS</div>
                <ReviewRow label="Cup Package" value={`${eventInfo.cup_quantity} cups`} />
                <ReviewRow
                  label="Price per Cup"
                  value={`₱${money(pricing[cupPriceKey])}`}
                />
                <ReviewRow label="Menu Package" value={eventInfo.menu_package} />
                <ReviewRow
                  label="Menu Add-on"
                  value={`₱${money(pricing[menuAddonKey])}`}
                />
                <ReviewRow label="Additional Drinks" value={eventInfo.selected_drinks || "None"} />
                <ReviewRow label="Hojicha Option" value={eventInfo.hojicha_options} />
                <ReviewRow label="Other Request" value={fixedInfo.other_request || "None"} />

                <div className="booking-summary">
                  <div className="booking-row">
                    <span className="booking-label">
                      {eventInfo.cup_quantity} cups × ₱{money(pricing[cupPriceKey])}
                    </span>
                    <span className="booking-value">
                      ₱{money(Number(eventInfo.cup_quantity) * Number(pricing[cupPriceKey]))}
                    </span>
                  </div>

                  <div className="booking-row">
                    <span className="booking-label">{eventInfo.menu_package} add-on</span>
                    <span className="booking-value">₱{money(pricing[menuAddonKey])}</span>
                  </div>

                  <div className="booking-row total">
                    <span className="booking-label">Total Amount</span>
                    <span className="booking-value">₱{money(totalAmount)}</span>
                  </div>

                  <div className="booking-row">
                    <span className="booking-label">
                      Due Now ({pricing.event_booking_downpayment_percentage}%)
                    </span>
                    <span className="booking-value">₱{money(dueNow)}</span>
                  </div>
                </div>

                <div className="actions">
                  <button type="button" className="btn" onClick={() => setStep("form")}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-confirm" onClick={handleConfirm}>
                    Confirm and Pay
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="title">Book your event now!</div>

                <div className="section-title">CONTACT INFORMATION</div>

                <TextField label="Full Name" name="full_name" value={fixedInfo.full_name} onChange={handleFixedChange} />
                <TextField label="Phone Number" name="phone_number" value={fixedInfo.phone_number} onChange={handleFixedChange} />
                <TextField label="Email Address" name="email" value={fixedInfo.email} onChange={handleFixedChange} readOnly type="email" />

                <div className="field">
                  <label className="label">Are you available to contact in the following:</label>
                  <div className="options">
                    {CONTACT_METHODS.map((method) => (
                      <label className="opt" key={method.value}>
                        <input
                          type="checkbox"
                          value={method.value}
                          checked={fixedInfo.contact_methods.includes(method.value)}
                          onChange={handleContactMethod}
                        />
                        {method.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="section-title">BOOKING INFORMATION</div>

                <div className="field">
                  <label className="label">Event Time</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <input type="time" name="start_time" value={fixedInfo.start_time} onChange={handleFixedChange} />
                    <input type="time" name="end_time" value={fixedInfo.end_time} onChange={handleFixedChange} />
                  </div>
                  <div className="small-note">up to 4 hours operation</div>
                </div>

                <div className="field">
                  <label className="label">Type of Event</label>
                  <select name="event_type" value={fixedInfo.event_type} onChange={handleFixedChange}>
                    <option value=""></option>
                    <option value="Birthday Party">Birthday Party</option>
                    <option value="Corporate Event">Corporate Event</option>
                    <option value="Product Launch">Product Launch</option>
                    <option value="Bridal Shower">Bridal Shower</option>
                    <option value="Baby Shower">Baby Shower</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <TextField label="Event Name" name="event_name" value={fixedInfo.event_name} onChange={handleFixedChange} />
                <TextField label="Location" name="event_location" value={fixedInfo.event_location} onChange={handleFixedChange} />

                <div className="section-title">CUP PACKAGE</div>

                <div className="field">
                  <label className="label">Cup Package</label>
                  <div className="options">
                    {CUP_PACKAGES.map((qty) => {
                      const key = `event_${qty}_cups_price_per_cup`;
                      return (
                        <label className="opt" key={qty}>
                          <input
                            type="radio"
                            name="cup_quantity"
                            value={qty}
                            checked={Number(eventInfo.cup_quantity) === qty}
                            onChange={handleEventChange}
                          />
                          {qty} cups — ₱{money(pricing[key])}/cup
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="section-title">MENU PACKAGE</div>

                <div className="field">
                  <label className="label">Menu Package</label>
                  <div className="options">
                    {MENU_PACKAGES.map((pkg) => {
                      const key = {
                        SIGNATURE: "event_signature_addon",
                        PLUS: "event_plus_addon",
                        PREMIUM: "event_premium_addon",
                      }[pkg.value];

                      return (
                        <label className="opt" key={pkg.value}>
                          <input
                            type="radio"
                            name="menu_package"
                            value={pkg.value}
                            checked={eventInfo.menu_package === pkg.value}
                            onChange={handleEventChange}
                          />
                          <span>
                            {pkg.label} — {pkg.description}
                            {Number(pricing[key]) > 0 ? ` (+₱${money(pricing[key])})` : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="field">
                  <label className="label">Preferred Additional Drinks</label>
                  <textarea
                    name="selected_drinks"
                    value={eventInfo.selected_drinks}
                    placeholder="Example: Strawberry Matcha Latte, Hojicha Latte"
                    onChange={handleEventChange}
                  />
                </div>

                <div className="field">
                  <label className="label">Hojicha Versions</label>
                  <select
                    name="hojicha_options"
                    value={eventInfo.hojicha_options}
                    onChange={handleEventChange}
                  >
                    <option value="Matcha only">Matcha only</option>
                    <option value="Hojicha only">Hojicha only</option>
                    <option value="Mix of Matcha and Hojicha">Mix of Matcha and Hojicha</option>
                  </select>
                </div>

                <div className="field">
                  <label className="label">Other Request</label>
                  <textarea
                    name="other_request"
                    value={fixedInfo.other_request}
                    onChange={handleFixedChange}
                  />
                </div>

                <div className="booking-summary">
                  <div className="booking-row total">
                    <span className="booking-label">Total Event Price</span>
                    <span className="booking-value">₱{money(totalAmount)}</span>
                  </div>
                  <div className="booking-row">
                    <span className="booking-label">
                      Due Now ({pricing.event_booking_downpayment_percentage}%)
                    </span>
                    <span className="booking-value">₱{money(dueNow)}</span>
                  </div>
                </div>

                <div className="actions">
                  <button className="btn btn-confirm" type="button" onClick={handleReview}>
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TextField({ label, name, value, onChange, type = "text", readOnly = false }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange} readOnly={readOnly} />
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input value={value || ""} readOnly />
    </div>
  );
}
