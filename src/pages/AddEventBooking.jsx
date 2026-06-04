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

function pad(n) {
  return String(n).padStart(2, "0");
}

function addHours(timeStr, hoursToAdd) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);

  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return "";
  }

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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getActiveItems(items) {
  return safeArray(items)
    .filter((item) => Number(item.is_active ?? 1) === 1)
    .sort((a, b) => {
      const sortA = numberValue(a.sort_order);
      const sortB = numberValue(b.sort_order);

      if (sortA !== sortB) return sortA - sortB;

      return String(a.label || a.drink_name || a.quantity || "").localeCompare(
        String(b.label || b.drink_name || b.quantity || "")
      );
    });
}

export default function AddEventBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const date = searchParams.get("date");

  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    cup_packages: [],
    menu_packages: [],
    drinks: [],
    downpayment_percentage: 50,
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
    cup_package_id: "",
    menu_package_id: "",
    selected_drink_ids: [],
    custom_drinks: "",
    hojicha_options: "Matcha only",
  });

  const activeCupPackages = useMemo(
    () => getActiveItems(form.cup_packages),
    [form.cup_packages]
  );

  const activeMenuPackages = useMemo(
    () => getActiveItems(form.menu_packages),
    [form.menu_packages]
  );

  const activeDrinks = useMemo(() => getActiveItems(form.drinks), [form.drinks]);

  useEffect(() => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      navigate("/calendar");
    }
  }, [date, navigate]);

  useEffect(() => {
    loadBookingForm();
    loadCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBookingForm = async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await API.get("/bookings/get-active-booking-form.php", {
        params: { type: "event_booking" },
      });

      const responseForm = data.form || data.pricing || {};

      if (data.success && responseForm) {
        const cupPackages = getActiveItems(responseForm.cup_packages);
        const menuPackages = getActiveItems(responseForm.menu_packages);
        const drinks = getActiveItems(responseForm.drinks);

        const loadedForm = {
          cup_packages: cupPackages,
          menu_packages: menuPackages,
          drinks,
          downpayment_percentage: numberValue(
            responseForm.downpayment_percentage ||
              responseForm.event_booking_downpayment_percentage ||
              50
          ),
        };

        setForm(loadedForm);

        setEventInfo((prev) => ({
          ...prev,
          cup_package_id:
            cupPackages.length > 0 ? String(cupPackages[0].id) : "",
          menu_package_id:
            menuPackages.length > 0 ? String(menuPackages[0].id) : "",
        }));
      } else {
        setError(data.error || "Failed to load event options.");
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
      // Keep empty fields if not available.
    }
  };

  const selectedCupPackage = useMemo(() => {
    return (
      activeCupPackages.find(
        (item) => String(item.id) === String(eventInfo.cup_package_id)
      ) || null
    );
  }, [activeCupPackages, eventInfo.cup_package_id]);

  const selectedMenuPackage = useMemo(() => {
    return (
      activeMenuPackages.find(
        (item) => String(item.id) === String(eventInfo.menu_package_id)
      ) || null
    );
  }, [activeMenuPackages, eventInfo.menu_package_id]);

  const selectedDrinks = useMemo(() => {
    return activeDrinks.filter((drink) =>
      eventInfo.selected_drink_ids.includes(String(drink.id))
    );
  }, [activeDrinks, eventInfo.selected_drink_ids]);

  const totalAmount = useMemo(() => {
    const cupTotal =
      numberValue(selectedCupPackage?.quantity) *
      numberValue(selectedCupPackage?.price_per_cup);

    const addon = numberValue(selectedMenuPackage?.addon_price);

    return cupTotal + addon;
  }, [selectedCupPackage, selectedMenuPackage]);

  const dueNow = useMemo(() => {
    return totalAmount * (numberValue(form.downpayment_percentage || 50) / 100);
  }, [totalAmount, form.downpayment_percentage]);

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

  const handleDrinkSelection = (e) => {
    const { value, checked } = e.target;

    setEventInfo((prev) => ({
      ...prev,
      selected_drink_ids: checked
        ? [...prev.selected_drink_ids, value]
        : prev.selected_drink_ids.filter((id) => id !== value),
    }));
  };

  const validateForm = () => {
    if (!fixedInfo.full_name.trim()) return "Full name is required.";
    if (!fixedInfo.phone_number.trim()) return "Phone number is required.";
    if (!fixedInfo.email.trim()) return "Email is required.";

    if (!fixedInfo.start_time || !fixedInfo.end_time) {
      return "Start time is required.";
    }

    if (!fixedInfo.event_type.trim()) return "Type of event is required.";
    if (!fixedInfo.event_name.trim()) return "Event name is required.";
    if (!fixedInfo.event_location.trim()) return "Event location is required.";
    if (!selectedCupPackage) return "Cup package is required.";
    if (!selectedMenuPackage) return "Menu package is required.";
    if (totalAmount <= 0) return "Invalid total amount.";

    return "";
  };

  const handleReview = async () => {
    if (checking) return;

    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setChecking(true);

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
    } finally {
      setChecking(false);
    }
  };

  const buildDraft = () => ({
    ...fixedInfo,
    booking_type: "event_booking",

    cup_package_id: selectedCupPackage.id,
    cup_quantity: numberValue(selectedCupPackage.quantity),
    price_per_cup: numberValue(selectedCupPackage.price_per_cup),

    menu_package_id: selectedMenuPackage.id,
    menu_package_code: selectedMenuPackage.package_code,
    menu_package_label: selectedMenuPackage.label,
    menu_addon: numberValue(selectedMenuPackage.addon_price),

    selected_drink_ids: eventInfo.selected_drink_ids,
    selected_drinks: selectedDrinks.map((drink) => ({
      id: drink.id,
      drink_name: drink.drink_name,
      category: drink.category,
      is_signature: drink.is_signature,
    })),

    custom_drinks: eventInfo.custom_drinks,
    hojicha_options: eventInfo.hojicha_options,

    downpayment_percentage: numberValue(form.downpayment_percentage),
    total_amount: totalAmount,
    due_now: dueNow,

    form_snapshot: {
      cup_package: selectedCupPackage,
      menu_package: selectedMenuPackage,
      selected_drinks: selectedDrinks,
      downpayment_percentage: numberValue(form.downpayment_percentage),
      total_amount: totalAmount,
      due_now: dueNow,
    },
  });

  const handleConfirm = async () => {
    if (creating) return;

    setError("");
    setCreating(true);

    try {
      const res = await API.post("/bookings/event/create-event-booking.php", {
        date,
        start_time: fixedInfo.start_time,
        end_time: fixedInfo.end_time,
        draft: buildDraft(),
      });

      if (res.data.success) {
        navigate(
          `/gcash-payment?purpose=event_booking&booking_id=${res.data.booking_id}`
        );
      } else {
        setError(res.data.error || "Booking failed.");
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Please log in to confirm your booking.");
        navigate("/login");
      } else {
        setError(
          err.response?.data?.error || "Connection error. Please try again."
        );
      }
    } finally {
      setCreating(false);
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
                <ReviewRow
                  label="Contact Methods"
                  value={fixedInfo.contact_methods.join(", ")}
                />

                <div className="section-title">BOOKING INFORMATION</div>
                <ReviewRow label="Date" value={date} />
                <ReviewRow label="Start Time" value={fixedInfo.start_time} />
                <ReviewRow label="End Time" value={fixedInfo.end_time} />
                <ReviewRow label="Type of Event" value={fixedInfo.event_type} />
                <ReviewRow label="Event Name" value={fixedInfo.event_name} />
                <ReviewRow label="Location" value={fixedInfo.event_location} />

                <div className="section-title">PACKAGE DETAILS</div>
                <ReviewRow
                  label="Cup Package"
                  value={`${selectedCupPackage?.quantity} cups`}
                />
                <ReviewRow
                  label="Price per Cup"
                  value={`₱${money(selectedCupPackage?.price_per_cup)}`}
                />
                <ReviewRow
                  label="Menu Package"
                  value={selectedMenuPackage?.label}
                />
                <ReviewRow
                  label="Menu Add-on"
                  value={`₱${money(selectedMenuPackage?.addon_price)}`}
                />
                <ReviewRow
                  label="Selected Drinks"
                  value={
                    selectedDrinks.length > 0
                      ? selectedDrinks.map((drink) => drink.drink_name).join(", ")
                      : "None"
                  }
                />
                <ReviewRow
                  label="Other Preferred Drinks"
                  value={eventInfo.custom_drinks || "None"}
                />
                <ReviewRow
                  label="Hojicha Option"
                  value={eventInfo.hojicha_options}
                />
                <ReviewRow
                  label="Other Request"
                  value={fixedInfo.other_request || "None"}
                />

                <div className="booking-summary">
                  <div className="booking-row">
                    <span className="booking-label">
                      {selectedCupPackage?.quantity} cups × ₱
                      {money(selectedCupPackage?.price_per_cup)}
                    </span>
                    <span className="booking-value">
                      ₱
                      {money(
                        numberValue(selectedCupPackage?.quantity) *
                          numberValue(selectedCupPackage?.price_per_cup)
                      )}
                    </span>
                  </div>

                  <div className="booking-row">
                    <span className="booking-label">
                      {selectedMenuPackage?.label} add-on
                    </span>
                    <span className="booking-value">
                      ₱{money(selectedMenuPackage?.addon_price)}
                    </span>
                  </div>

                  <div className="booking-row total">
                    <span className="booking-label">Total Amount</span>
                    <span className="booking-value">₱{money(totalAmount)}</span>
                  </div>

                  <div className="booking-row">
                    <span className="booking-label">
                      Due Now ({form.downpayment_percentage}%)
                    </span>
                    <span className="booking-value">₱{money(dueNow)}</span>
                  </div>
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setStep("form")}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="btn btn-confirm"
                    onClick={handleConfirm}
                    disabled={creating}
                  >
                    {creating ? "Creating booking..." : "Confirm and Pay"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="title">Book your event now!</div>

                <div className="section-title">CONTACT INFORMATION</div>

                <TextField
                  label="Full Name"
                  name="full_name"
                  value={fixedInfo.full_name}
                  onChange={handleFixedChange}
                />

                <TextField
                  label="Phone Number"
                  name="phone_number"
                  value={fixedInfo.phone_number}
                  onChange={handleFixedChange}
                />

                <TextField
                  label="Email Address"
                  name="email"
                  value={fixedInfo.email}
                  onChange={handleFixedChange}
                  readOnly
                  type="email"
                />

                <div className="field">
                  <label className="label">
                    Are you available to contact in the following:
                  </label>

                  <div className="options">
                    {CONTACT_METHODS.map((method) => (
                      <label className="opt" key={method.value}>
                        <input
                          type="checkbox"
                          value={method.value}
                          checked={fixedInfo.contact_methods.includes(
                            method.value
                          )}
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

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <input
                      type="time"
                      name="start_time"
                      value={fixedInfo.start_time}
                      onChange={handleFixedChange}
                    />

                    <input
                      type="time"
                      name="end_time"
                      value={fixedInfo.end_time}
                      onChange={handleFixedChange}
                    />
                  </div>

                  <div className="small-note">up to 4 hours operation</div>
                </div>

                <div className="field">
                  <label className="label">Type of Event</label>

                  <select
                    name="event_type"
                    value={fixedInfo.event_type}
                    onChange={handleFixedChange}
                  >
                    <option value=""></option>
                    <option value="Birthday Party">Birthday Party</option>
                    <option value="Corporate Event">Corporate Event</option>
                    <option value="Product Launch">Product Launch</option>
                    <option value="Bridal Shower">Bridal Shower</option>
                    <option value="Baby Shower">Baby Shower</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <TextField
                  label="Event Name"
                  name="event_name"
                  value={fixedInfo.event_name}
                  onChange={handleFixedChange}
                />

                <TextField
                  label="Location"
                  name="event_location"
                  value={fixedInfo.event_location}
                  onChange={handleFixedChange}
                />

                <div className="section-title">CUP PACKAGE</div>

                <div className="field">
                  <label className="label">Cup Package</label>

                  <div className="options">
                    {activeCupPackages.length === 0 ? (
                      <div className="small-note">
                        No active cup packages available.
                      </div>
                    ) : (
                      activeCupPackages.map((pkg) => (
                        <label className="opt" key={pkg.id}>
                          <input
                            type="radio"
                            name="cup_package_id"
                            value={pkg.id}
                            checked={
                              String(eventInfo.cup_package_id) === String(pkg.id)
                            }
                            onChange={handleEventChange}
                          />
                          {pkg.quantity} cups — ₱{money(pkg.price_per_cup)}/cup
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="section-title">MENU PACKAGE</div>

                <div className="field">
                  <label className="label">Menu Package</label>

                  <div className="options">
                    {activeMenuPackages.length === 0 ? (
                      <div className="small-note">
                        No active menu packages available.
                      </div>
                    ) : (
                      activeMenuPackages.map((pkg) => (
                        <label className="opt" key={pkg.id}>
                          <input
                            type="radio"
                            name="menu_package_id"
                            value={pkg.id}
                            checked={
                              String(eventInfo.menu_package_id) ===
                              String(pkg.id)
                            }
                            onChange={handleEventChange}
                          />

                          <span>
                            {pkg.label} — {pkg.description}
                            {numberValue(pkg.addon_price) > 0
                              ? ` (+₱${money(pkg.addon_price)})`
                              : ""}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="section-title">DRINK OPTIONS</div>

                <div className="field">
                  <label className="label">Preferred Drinks</label>

                  <div className="options">
                    {activeDrinks.length === 0 ? (
                      <div className="small-note">No active drinks available.</div>
                    ) : (
                      activeDrinks.map((drink) => (
                        <label className="opt" key={drink.id}>
                          <input
                            type="checkbox"
                            value={drink.id}
                            checked={eventInfo.selected_drink_ids.includes(
                              String(drink.id)
                            )}
                            onChange={handleDrinkSelection}
                          />
                          {drink.drink_name}
                          {Number(drink.is_signature) === 1
                            ? " — Signature"
                            : ""}
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="field">
                  <label className="label">Other Preferred Drinks</label>
                  <textarea
                    name="custom_drinks"
                    value={eventInfo.custom_drinks}
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
                    <option value="Mix of Matcha and Hojicha">
                      Mix of Matcha and Hojicha
                    </option>
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
                      Due Now ({form.downpayment_percentage}%)
                    </span>
                    <span className="booking-value">₱{money(dueNow)}</span>
                  </div>
                </div>

                <div className="actions">
                  <button
                    className="btn btn-confirm"
                    type="button"
                    onClick={handleReview}
                    disabled={checking}
                  >
                    {checking ? "Checking..." : "Next"}
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

function TextField({
  label,
  name,
  value,
  onChange,
  type = "text",
  readOnly = false,
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
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
