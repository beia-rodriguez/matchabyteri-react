import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/add-workshop-booking.css";

const CONTACT_METHODS = ["Text", "Call", "Viber", "Whatsapp"];
const WORKSHOP_TYPES = [
  "Matcha Workshop",
  "Private Workshop",
  "Corporate Workshop",
  "Other"
];
const ATTENDEE_OPTIONS = ["10 - 20", "21 - 30", "31 - 40", "41 - 50", "50+"];
const COUNT_OPTIONS = ["2", "3", "5"];
const MILK_OPTIONS = ["Dairy Milk (+30/cup)", "Sparkling water (+40/cup)"];
const REQUIRED_FIELDS = [
  "full_name",
  "phone_number",
  "email",
  "workshop_type",
  "location_choice",
  "attendees",
  "start_time",
  "cup_drink_option",
  "drinks_per_person",
  "milk_option"
];

function isChecked(arr, val) {
  return Array.isArray(arr) && arr.includes(val);
}

export default function AddWorkshopBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const dateParam = searchParams.get("date");
  const type = searchParams.get("type") || "workshop";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (type !== "workshop") {
      navigate(`/day?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`, {
        replace: true
      });
    }
  }, [type, date, navigate]);

  const dt = new Date(date);
  const monthDay = dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric"
  });
  const year = dt.getFullYear();

  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [draft, setDraft] = useState({
    contact_methods: [],
    milk_option: [],
    custom_logo: "no"
  });

  useEffect(() => {
    API.get("bookings/private-workshop/check-blocked.php", { params: { date } })
      .then(res => {
        if (res.data.blocked) {
          setBlocked(true);
          setBlockReason(res.data.reason || "");
        } else {
          setBlocked(false);
          setBlockReason("");
        }
      })
      .catch(() => {
        setError("Failed to check blocked date.");
      });
  }, [date]);

  useEffect(() => {
    if (!draft.start_time) {
      setDraft(prev => ({ ...prev, end_time: "" }));
      return;
    }

    const [h, m] = draft.start_time.split(":").map(Number);
    const d = new Date(2000, 0, 1, h, m, 0);
    d.setHours(d.getHours() + 4);

    const pad = n => String(n).padStart(2, "0");
    const endTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setDraft(prev => ({ ...prev, end_time: endTime }));
  }, [draft.start_time]);

  useEffect(() => {
    if (draft.location_choice !== "custom" && draft.custom_location) {
      setDraft(prev => ({ ...prev, custom_location: "" }));
    }
  }, [draft.location_choice, draft.custom_location]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox" && name === "contact_methods") {
      let arr = [...(draft.contact_methods || [])];

      if (checked) {
        if (!arr.includes(value)) arr.push(value);
      } else {
        arr = arr.filter(v => v !== value);
      }

      setDraft(prev => ({ ...prev, contact_methods: arr }));
      return;
    }

    if (type === "checkbox" && name === "milk_option") {
      let arr = [...(draft.milk_option || [])];

      if (checked) {
        if (!arr.includes(value)) arr.push(value);
      } else {
        arr = arr.filter(v => v !== value);
      }

      setDraft(prev => ({ ...prev, milk_option: arr }));
      return;
    }

    if (type === "checkbox") {
      setDraft(prev => ({
        ...prev,
        [name]: checked ? "yes" : "no"
      }));
      return;
    }

    setDraft(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = async e => {
    e.preventDefault();
    setError("");

    const location =
      draft.location_choice === "custom"
        ? (draft.custom_location || "").trim()
        : draft.location_choice;

    const mergedDraft = {
      ...draft,
      location
    };

    for (const field of REQUIRED_FIELDS) {
      if (
        field === "milk_option"
          ? !Array.isArray(mergedDraft.milk_option) || mergedDraft.milk_option.length === 0
          : !mergedDraft[field]
      ) {
        setError("Please fill in all required fields.");
        return;
      }
    }

    if (!mergedDraft.location) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mergedDraft.email)) {
      setError("Invalid email format.");
      return;
    }

    const st = mergedDraft.start_time;
    const et = mergedDraft.end_time;

    if (!st || !et) {
      setError("Please fill in all required fields.");
      return;
    }

    const startTs = new Date(`${date}T${st}:00`).getTime();
    const endTs = new Date(`${date}T${et}:00`).getTime();

    if (endTs <= startTs) {
      setError("End time must be after start time.");
      return;
    }

    if (endTs - startTs > 4 * 60 * 60 * 1000) {
      setError("Workshop time must be up to 4 hours only.");
      return;
    }

    try {
      const res = await API.post("bookings/private-workshop/check-blocked.php", {
        date,
        start_time: mergedDraft.start_time,
        end_time: mergedDraft.end_time
      });

      if (res.data.blocked) {
        setError("That time slot is not available. Please choose another time.");
        return;
      }

      setDraft(mergedDraft);
      setStep("review");
    } catch {
      setError("Failed to validate booking.");
    }
  };

  const handleConfirm = async e => {
    if (e) e.preventDefault();
    setError("");

    const location =
      draft.location_choice === "custom"
        ? (draft.custom_location || "").trim()
        : draft.location_choice;

    const finalDraft = {
      ...draft,
      location,
      date,
      booking_type: "workshop"
    };

    const st = finalDraft.start_time;
    const et = finalDraft.end_time;

    const startTs = new Date(`${date}T${st}:00`).getTime();
    const endTs = new Date(`${date}T${et}:00`).getTime();

    if (endTs <= startTs || endTs - startTs > 4 * 60 * 60 * 1000) {
      setError("Workshop time must be up to 4 hours only.");
      setStep("review");
      return;
    }

    try {
      const res = await API.post("bookings/private-workshop/confirm-booking.php", {
        date,
        draft: finalDraft,
        booking_type: "workshop"
      });

      if (res.data.booking_id) {
        navigate(
          `/gcash-payment?purpose=workshop_booking&booking_id=${res.data.booking_id}`
        );
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

      <div className="workshop-booking-page">
        <div className="workshop-booking-wrap">
          <div className="workshop-booking-top">
            <button
              className="workshop-booking-back"
              type="button"
              onClick={() => navigate(`/day?date=${date}&type=workshop`)}
            >
              <img src="/images/left-book.png" alt="Back" />
            </button>

            <div className="workshop-booking-date-title">{monthDay}</div>
            <div className="workshop-booking-year-title">{year}</div>
          </div>

          <div
            className={`workshop-booking-card ${
              step === "review" ? "workshop-booking-review" : ""
            }`}
          >
            {blocked && (
              <>
                <div className="workshop-booking-blocked">
                  This date is not available.
                </div>
                {blockReason && (
                  <div className="workshop-booking-small-note workshop-booking-center">
                    {blockReason}
                  </div>
                )}
              </>
            )}

            {error && <div className="workshop-booking-error">{error}</div>}

            {step === "review" ? (
              <>
                <div className="workshop-booking-title">
                  Please review your details carefully, before confirmation.
                </div>

                <form onSubmit={handleConfirm}>
                  <div className="workshop-booking-section-title">
                    CONTACT INFORMATION
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Full Name</label>
                    <input
                      type="text"
                      name="full_name"
                      value={draft.full_name || ""}
                      readOnly
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Phone Number</label>
                    <input
                      type="text"
                      name="phone_number"
                      value={draft.phone_number || ""}
                      readOnly
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={draft.email || ""}
                      readOnly
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Are you available to contact in the following:
                    </label>
                    <div className="workshop-booking-options">
                      {CONTACT_METHODS.map(method => (
                        <label key={method} className="workshop-booking-opt">
                          <input
                            type="checkbox"
                            checked={isChecked(draft.contact_methods, method)}
                            disabled
                          />
                          {method}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="workshop-booking-section-title">
                    WORKSHOP INFORMATION
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Type of Event</label>
                    <input
                      type="text"
                      name="workshop_type"
                      value={draft.workshop_type || ""}
                      readOnly
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Date</label>
                    <input
                      type="text"
                      value={`${monthDay}, ${year}`}
                      readOnly
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={
                        draft.location_choice === "custom"
                          ? draft.custom_location || ""
                          : draft.location_choice || ""
                      }
                      readOnly
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Number of Attendees
                    </label>
                    <input
                      type="text"
                      name="attendees"
                      value={draft.attendees || ""}
                      readOnly
                    />
                  </div>

                  <div className="workshop-booking-two-col">
                    <div className="workshop-booking-field workshop-booking-field-no-margin">
                      <label className="workshop-booking-label">
                        Event Time of Workshop
                      </label>
                      <input
                        type="time"
                        name="start_time"
                        value={draft.start_time || ""}
                        readOnly
                      />
                    </div>
                    <div className="workshop-booking-field workshop-booking-field-no-margin">
                      <label className="workshop-booking-label">&nbsp;</label>
                      <input
                        type="time"
                        name="end_time"
                        value={draft.end_time || ""}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="workshop-booking-small-note">
                    up to 4 hours operation
                  </div>

                  <div className="workshop-booking-section-title">
                    MODIFICATIONS
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Cup Drink/Options
                    </label>
                    <div className="workshop-booking-options">
                      {COUNT_OPTIONS.map(value => (
                        <label key={value} className="workshop-booking-opt">
                          <input
                            type="radio"
                            checked={draft.cup_drink_option === value}
                            disabled
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Drink Allowed per person
                    </label>
                    <div className="workshop-booking-options">
                      {COUNT_OPTIONS.map(value => (
                        <label key={value} className="workshop-booking-opt">
                          <input
                            type="radio"
                            checked={draft.drinks_per_person === value}
                            disabled
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="workshop-booking-field">
                    <label
                      className="workshop-booking-opt workshop-booking-opt-center"
                    >
                      <input
                        type="checkbox"
                        checked={(draft.custom_logo || "no") === "yes"}
                        disabled
                      />
                      Customized cups logo (+12/cup)
                    </label>
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Milk Options</label>
                    <div className="workshop-booking-small-note workshop-booking-small-note-spacing">
                      we use Oatmilk as default
                    </div>
                    <div className="workshop-booking-options">
                      {MILK_OPTIONS.map(option => (
                        <label key={option} className="workshop-booking-opt">
                          <input
                            type="checkbox"
                            checked={isChecked(draft.milk_option, option)}
                            disabled
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Other Request (Optional)
                    </label>
                    <input
                      type="text"
                      name="other_request"
                      value={draft.other_request || ""}
                      readOnly
                    />
                  </div>

                  <div className="workshop-booking-actions">
                    <button
                      type="button"
                      className="workshop-booking-btn workshop-booking-btn-edit"
                      onClick={() => setStep("form")}
                    >
                      EDIT
                    </button>

                    <button
                      type="submit"
                      className="workshop-booking-btn workshop-booking-btn-confirm"
                      disabled={blocked}
                    >
                      CONFIRM
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="workshop-booking-title">
                  Book your workshop now!
                </div>

                <form onSubmit={handleNext}>
                  <div className="workshop-booking-section-title">
                    CONTACT INFORMATION
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Full Name</label>
                    <input
                      type="text"
                      name="full_name"
                      required
                      value={draft.full_name || ""}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Phone Number</label>
                    <input
                      type="text"
                      name="phone_number"
                      required
                      value={draft.phone_number || ""}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={draft.email || ""}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Are you available to contact in the following:
                    </label>
                    <div className="workshop-booking-options">
                      {CONTACT_METHODS.map(method => (
                        <label key={method} className="workshop-booking-opt">
                          <input
                            type="checkbox"
                            name="contact_methods"
                            value={method}
                            checked={isChecked(draft.contact_methods, method)}
                            onChange={handleChange}
                          />
                          {method}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="workshop-booking-section-title">
                    WORKSHOP INFORMATION
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Type of Event</label>
                    <select
                      name="workshop_type"
                      required
                      value={draft.workshop_type || ""}
                      onChange={handleChange}
                    >
                      <option value=""></option>
                      {WORKSHOP_TYPES.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Date</label>
                    <select disabled>
                      <option>{`${monthDay}, ${year}`}</option>
                    </select>
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Location</label>
                    <div className="workshop-booking-options workshop-booking-options-single">
                      <label className="workshop-booking-opt">
                        <input
                          type="radio"
                          name="location_choice"
                          value="Makati"
                          required
                          checked={draft.location_choice === "Makati"}
                          onChange={handleChange}
                        />
                        Makati
                      </label>

                      <label className="workshop-booking-opt">
                        <input
                          type="radio"
                          name="location_choice"
                          value="Greenhills, San Juan"
                          required
                          checked={draft.location_choice === "Greenhills, San Juan"}
                          onChange={handleChange}
                        />
                        Greenhills, San Juan
                      </label>

                      <label className="workshop-booking-opt workshop-booking-opt-top">
                        <input
                          type="radio"
                          name="location_choice"
                          value="custom"
                          required
                          checked={draft.location_choice === "custom"}
                          onChange={handleChange}
                        />
                        <span>I have a set location:</span>
                      </label>

                      <div className="workshop-booking-custom-location-wrap">
                        <input
                          type="text"
                          id="custom_location"
                          name="custom_location"
                          placeholder="Enter your location"
                          value={draft.custom_location || ""}
                          onChange={handleChange}
                          disabled={draft.location_choice !== "custom"}
                          className="workshop-booking-custom-location-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Number of Attendees
                    </label>
                    <select
                      name="attendees"
                      required
                      value={draft.attendees || ""}
                      onChange={handleChange}
                    >
                      <option value=""></option>
                      {ATTENDEE_OPTIONS.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="workshop-booking-two-col">
                    <div className="workshop-booking-field workshop-booking-field-no-margin">
                      <label className="workshop-booking-label">
                        Event Time of Workshop
                      </label>
                      <input
                        type="time"
                        id="start_time"
                        name="start_time"
                        required
                        value={draft.start_time || ""}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="workshop-booking-field workshop-booking-field-no-margin">
                      <label className="workshop-booking-label">&nbsp;</label>
                      <input
                        type="time"
                        id="end_time"
                        name="end_time"
                        required
                        readOnly
                        value={draft.end_time || ""}
                      />
                    </div>
                  </div>
                  <div className="workshop-booking-small-note">
                    up to 4 hours operation
                  </div>

                  <div className="workshop-booking-section-title">
                    MODIFICATIONS
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Cup Drink/Options
                    </label>
                    <div className="workshop-booking-options">
                      {COUNT_OPTIONS.map(value => (
                        <label key={value} className="workshop-booking-opt">
                          <input
                            type="radio"
                            name="cup_drink_option"
                            value={value}
                            required
                            checked={draft.cup_drink_option === value}
                            onChange={handleChange}
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Drink Allowed per person
                    </label>
                    <div className="workshop-booking-options">
                      {COUNT_OPTIONS.map(value => (
                        <label key={value} className="workshop-booking-opt">
                          <input
                            type="radio"
                            name="drinks_per_person"
                            value={value}
                            required
                            checked={draft.drinks_per_person === value}
                            onChange={handleChange}
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                    <div className="workshop-booking-small-note">
                      for bringing your own drinks
                    </div>
                  </div>

                  <div className="workshop-booking-field">
                    <label
                      className="workshop-booking-opt workshop-booking-opt-center"
                    >
                      <input
                        type="checkbox"
                        name="custom_logo"
                        checked={(draft.custom_logo || "no") === "yes"}
                        onChange={handleChange}
                      />
                      Customized cups logo (+12/cup)
                    </label>
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Milk Options</label>
                    <div className="workshop-booking-small-note workshop-booking-small-note-spacing">
                      we use Oatmilk as default
                    </div>
                    <div className="workshop-booking-options">
                      {MILK_OPTIONS.map(option => (
                        <label key={option} className="workshop-booking-opt">
                          <input
                            type="checkbox"
                            name="milk_option"
                            value={option}
                            checked={isChecked(draft.milk_option, option)}
                            onChange={handleChange}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Other Request (Optional)
                    </label>
                    <input
                      type="text"
                      name="other_request"
                      value={draft.other_request || ""}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="workshop-booking-actions">
                    <button
                      type="button"
                      className="workshop-booking-btn workshop-booking-btn-cancel"
                      onClick={() => navigate(`/day?date=${date}&type=workshop`)}
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      className="workshop-booking-btn workshop-booking-btn-next"
                      disabled={blocked}
                    >
                      NEXT
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}