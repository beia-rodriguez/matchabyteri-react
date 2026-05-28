import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/add-workshop-booking.css";
import "../assets/css/universal.css";

const CONTACT_METHODS = [
  { value: "Text", label: "Text" },
  { value: "Call", label: "Call" },
  { value: "Viber", label: "Viber" },
  { value: "Whatsapp", label: "WhatsApp" },
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

export default function AddWorkshopBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const dateParam = searchParams.get("date");
  const type = searchParams.get("type") || "workshop";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : new Date().toISOString().split("T")[0];

  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [loading, setLoading] = useState(true);

  const [pricing, setPricing] = useState({
    private_workshop_standard_price: 3000,
    private_workshop_premium_price: 3800,
    private_workshop_downpayment_percentage: 50,
  });

  const [fixedInfo, setFixedInfo] = useState({
    full_name: "",
    phone_number: "",
    email: "",
    contact_methods: [],
    start_time: "",
    end_time: "",
    workshop_location: "",
    other_request: "",
  });

  const [workshopInfo, setWorkshopInfo] = useState({
    total_attendees: "",
    standard_attendees: "",
    premium_attendees: "",
  });

  useEffect(() => {
    if (type !== "workshop" && type !== "private_workshop") {
      navigate(`/day?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`, {
        replace: true,
      });
    }
  }, [type, date, navigate]);

  useEffect(() => {
    loadPricing();
    loadCurrentUser();
    checkBlockedDate();
  }, []);

  const loadPricing = async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await API.get("/bookings/get-active-booking-form.php", {
        params: { type: "private_workshop" },
      });

      if (data.pricing) {
        setPricing((prev) => ({ ...prev, ...data.pricing }));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load private workshop pricing.");
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

  const checkBlockedDate = async () => {
    try {
      const res = await API.post("/bookings/private-workshop/check-blocked.php", {
        date,
      });

      if (res.data.blocked) {
        setBlocked(true);
        setBlockReason(res.data.reason || "This date is not available.");
      } else if (res.data.day_full) {
        setBlocked(true);
        setBlockReason("This day is fully booked.");
      } else {
        setBlocked(false);
        setBlockReason("");
      }
    } catch {
      setError("Failed to check blocked date.");
    }
  };

  const standardTotal = useMemo(() => {
    return (
      Number(workshopInfo.standard_attendees || 0) *
      Number(pricing.private_workshop_standard_price || 0)
    );
  }, [workshopInfo.standard_attendees, pricing.private_workshop_standard_price]);

  const premiumTotal = useMemo(() => {
    return (
      Number(workshopInfo.premium_attendees || 0) *
      Number(pricing.private_workshop_premium_price || 0)
    );
  }, [workshopInfo.premium_attendees, pricing.private_workshop_premium_price]);

  const totalAmount = useMemo(() => {
    return standardTotal + premiumTotal;
  }, [standardTotal, premiumTotal]);

  const dueNow = useMemo(() => {
    return (
      totalAmount *
      (Number(pricing.private_workshop_downpayment_percentage || 50) / 100)
    );
  }, [totalAmount, pricing.private_workshop_downpayment_percentage]);

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

  const handleWorkshopChange = (e) => {
    const { name, value } = e.target;

    setWorkshopInfo((prev) => ({
      ...prev,
      [name]: value,
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
    const totalAttendees = Number(workshopInfo.total_attendees || 0);
    const standardAttendees = Number(workshopInfo.standard_attendees || 0);
    const premiumAttendees = Number(workshopInfo.premium_attendees || 0);

    if (blocked) return blockReason || "This date is not available.";
    if (!fixedInfo.full_name.trim()) return "Full name is required.";
    if (!fixedInfo.phone_number.trim()) return "Phone number is required.";
    if (!fixedInfo.email.trim()) return "Email is required.";
    if (!fixedInfo.start_time || !fixedInfo.end_time) return "Start time is required.";
    if (!fixedInfo.workshop_location.trim()) return "Workshop location is required.";
    if (totalAttendees <= 0) return "Total attendees is required.";
    if (standardAttendees < 0 || premiumAttendees < 0) return "Attendee counts cannot be negative.";
    if (standardAttendees + premiumAttendees !== totalAttendees) {
      return "Standard attendees plus Premium attendees must equal Total attendees.";
    }
    if (totalAmount <= 0) return "Invalid total amount.";
    return "";
  };

  const handleNext = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const startTs = new Date(`${date}T${fixedInfo.start_time}:00`).getTime();
    const endTs = new Date(`${date}T${fixedInfo.end_time}:00`).getTime();

    if (endTs <= startTs) {
      setError("End time must be after start time.");
      return;
    }

    if (endTs - startTs > 4 * 60 * 60 * 1000) {
      setError("Workshop time must be up to 4 hours only.");
      return;
    }

    try {
      const res = await API.post("/bookings/private-workshop/check-blocked.php", {
        date,
        start_time: fixedInfo.start_time,
        end_time: fixedInfo.end_time,
      });

      if (res.data.blocked) {
        setError(res.data.reason || "This date is not available.");
        return;
      }

      if (res.data.day_full) {
        setError("This day is fully booked.");
        return;
      }

      if (res.data.conflict) {
        setError("That time slot is already booked.");
        return;
      }

      setStep("review");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to validate booking.");
    }
  };

  const buildDraft = () => ({
    ...fixedInfo,
    ...workshopInfo,
    booking_type: "private_workshop",
    total_attendees: Number(workshopInfo.total_attendees || 0),
    standard_attendees: Number(workshopInfo.standard_attendees || 0),
    premium_attendees: Number(workshopInfo.premium_attendees || 0),
    standard_price: Number(pricing.private_workshop_standard_price || 0),
    premium_price: Number(pricing.private_workshop_premium_price || 0),
    total_amount: totalAmount,
  });

  const handleConfirm = async (e) => {
    if (e) e.preventDefault();

    setError("");

    try {
      const res = await API.post("/bookings/private-workshop/confirm-booking.php", {
        date,
        draft: buildDraft(),
        booking_type: "private_workshop",
      });

      if (res.data.success || res.data.booking_id) {
        navigate(`/gcash-payment?purpose=workshop_booking&booking_id=${res.data.booking_id}`);
      } else {
        setError(res.data.error || "Something went wrong. Please try again.");
        setStep("review");
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Something went wrong while confirming booking."
      );
      setStep("review");
    }
  };

  return (
    <>
      <Navbar />

      <div className="awb-page" id="readable-content">
        <div className="awb-wrap">
          <div className="awb-top">
            <button
              className="awb-back"
              type="button"
              aria-label="Back"
              onClick={() => navigate(`/day?date=${date}&type=workshop`)}
            >
              <img src="/images/left-book.png" alt="" aria-hidden="true" />
            </button>

            <div className="awb-date-title">{date}</div>
          </div>

          <div className={`awb-card ${step === "review" ? "awb-review" : ""}`}>
            {blocked && (
              <>
                <div className="awb-blocked">This date is not available.</div>
                {blockReason && <div className="awb-small-note awb-center">{blockReason}</div>}
              </>
            )}

            {error && <div className="awb-error">{error}</div>}

            {loading ? (
              <div className="awb-title">Loading private workshop booking...</div>
            ) : step === "review" ? (
              <>
                <div className="awb-title">
                  Please review your details carefully before confirmation.
                </div>

                <div className="awb-section-title">CONTACT INFORMATION</div>
                <ReviewRow label="Full Name" value={fixedInfo.full_name} />
                <ReviewRow label="Phone Number" value={fixedInfo.phone_number} />
                <ReviewRow label="Email Address" value={fixedInfo.email} />
                <ReviewRow label="Contact Methods" value={fixedInfo.contact_methods.join(", ")} />

                <div className="awb-section-title">BOOKING INFORMATION</div>
                <ReviewRow label="Date" value={date} />
                <ReviewRow label="Start Time" value={fixedInfo.start_time} />
                <ReviewRow label="End Time" value={fixedInfo.end_time} />
                <ReviewRow label="Workshop Location" value={fixedInfo.workshop_location} />
                <ReviewRow label="Total Attendees" value={workshopInfo.total_attendees} />
                <ReviewRow label="Standard Attendees" value={workshopInfo.standard_attendees} />
                <ReviewRow label="Premium Attendees" value={workshopInfo.premium_attendees} />
                <ReviewRow label="Other Request" value={fixedInfo.other_request || "None"} />

                <div className="awb-summary">
                  <div className="awb-summary-row">
                    <span className="awb-summary-label">
                      {workshopInfo.standard_attendees} Standard × ₱{money(pricing.private_workshop_standard_price)}
                    </span>
                    <span className="awb-summary-value">₱{money(standardTotal)}</span>
                  </div>

                  <div className="awb-summary-row">
                    <span className="awb-summary-label">
                      {workshopInfo.premium_attendees} Premium × ₱{money(pricing.private_workshop_premium_price)}
                    </span>
                    <span className="awb-summary-value">₱{money(premiumTotal)}</span>
                  </div>

                  <div className="awb-summary-row awb-summary-total">
                    <span className="awb-summary-label">Total Amount</span>
                    <span className="awb-summary-value">₱{money(totalAmount)}</span>
                  </div>

                  <div className="awb-summary-row">
                    <span className="awb-summary-label">
                      Due Now ({pricing.private_workshop_downpayment_percentage}%)
                    </span>
                    <span className="awb-summary-value">₱{money(dueNow)}</span>
                  </div>
                </div>

                <div className="awb-actions">
                  <button type="button" className="awb-btn awb-btn-secondary" onClick={() => setStep("form")}>
                    Edit
                  </button>
                  <button type="button" className="awb-btn awb-btn-confirm" onClick={handleConfirm}>
                    Confirm and Pay
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="awb-title">Book your private workshop</div>

                <div className="awb-section-title">CONTACT INFORMATION</div>

                <TextField label="Full Name" name="full_name" value={fixedInfo.full_name} onChange={handleFixedChange} />
                <TextField label="Phone Number" name="phone_number" value={fixedInfo.phone_number} onChange={handleFixedChange} />
                <TextField label="Email Address" name="email" value={fixedInfo.email} onChange={handleFixedChange} readOnly type="email" />

                <div className="awb-field">
                  <label className="awb-label">Are you available to contact in the following:</label>
                  <div className="awb-options">
                    {CONTACT_METHODS.map((method) => (
                      <label className="awb-option" key={method.value}>
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

                <div className="awb-section-title">BOOKING INFORMATION</div>

                <div className="awb-field">
                  <label className="awb-label">Event Time of Workshop</label>
                  <div className="awb-two-col">
                    <input type="time" name="start_time" value={fixedInfo.start_time} onChange={handleFixedChange} />
                    <input type="time" name="end_time" value={fixedInfo.end_time} onChange={handleFixedChange} />
                  </div>
                  <div className="awb-small-note">up to 4 hours operation</div>
                </div>

                <TextField label="Workshop Location" name="workshop_location" value={fixedInfo.workshop_location} onChange={handleFixedChange} />

                <div className="awb-section-title">ATTENDEES AND PACKAGES</div>

                <TextField
                  label="Total Number of Attendees"
                  name="total_attendees"
                  value={workshopInfo.total_attendees}
                  onChange={handleWorkshopChange}
                  type="number"
                />

                <TextField
                  label={`Number of Standard Package Attendees — ₱${money(pricing.private_workshop_standard_price)} each`}
                  name="standard_attendees"
                  value={workshopInfo.standard_attendees}
                  onChange={handleWorkshopChange}
                  type="number"
                />

                <TextField
                  label={`Number of Premium Package Attendees — ₱${money(pricing.private_workshop_premium_price)} each`}
                  name="premium_attendees"
                  value={workshopInfo.premium_attendees}
                  onChange={handleWorkshopChange}
                  type="number"
                />

                <div className="awb-field">
                  <label className="awb-label">Other Request</label>
                  <textarea
                    name="other_request"
                    value={fixedInfo.other_request}
                    onChange={handleFixedChange}
                  />
                </div>

                <div className="awb-summary">
                  <div className="awb-summary-row awb-summary-total">
                    <span className="awb-summary-label">Total Private Workshop Price</span>
                    <span className="awb-summary-value">₱{money(totalAmount)}</span>
                  </div>

                  <div className="awb-summary-row">
                    <span className="awb-summary-label">
                      Due Now ({pricing.private_workshop_downpayment_percentage}%)
                    </span>
                    <span className="awb-summary-value">₱{money(dueNow)}</span>
                  </div>
                </div>

                <div className="awb-actions">
                  <button className="awb-btn awb-btn-confirm" type="button" onClick={handleNext}>
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
    <div className="awb-field">
      <label className="awb-label">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange} readOnly={readOnly} min={type === "number" ? "0" : undefined} />
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="awb-field">
      <label className="awb-label">{label}</label>
      <input value={value || ""} readOnly />
    </div>
  );
}
