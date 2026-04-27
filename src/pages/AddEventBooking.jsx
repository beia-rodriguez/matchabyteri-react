import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/add-booking.css";

const CONTACT_METHODS = ["Text", "Call", "Viber", "Whatsapp"];

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

function parseCupCount(label = "") {
  const match = String(label).match(/(\d+)\s*cups?/i);
  return match ? Number(match[1]) : 0;
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
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
  const [loadingForm, setLoadingForm] = useState(true);

  const [formSchema, setFormSchema] = useState(null);

  const [fixedInfo, setFixedInfo] = useState({
    full_name: "",
    phone_number: "",
    email: "",
    contact_methods: [],
    start_time: "",
    end_time: "",
    other_request: "",
  });

  const [answers, setAnswers] = useState({});
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    if (!date) {
      navigate("/calendar");
    }
  }, [date, navigate]);

  useEffect(() => {
    loadActiveForm();
  }, []);

  useEffect(() => {
  API.get("/user/current-user.php")
    .then(({ data }) => {
      if (data.success && data.user) {
        setFixedInfo((prev) => ({
          ...prev,
          full_name: data.user.name || prev.full_name,
          email: data.user.email || prev.email,
          phone_number: data.user.phone_number || prev.phone_number,
        }));
      }
    })
    .catch(() => {});
}, []);

  const loadActiveForm = async () => {
    setLoadingForm(true);
    setError("");

    try {
      const { data } = await API.get("/bookings/get-active-booking-form.php", {
        params: { type: "event" },
      });

      if (!data.form) {
        setError("No active event booking form found. Please ask admin to create one.");
        return;
      }

      setFormSchema(data.form);
    } catch (err) {
      console.error(err);
      setError("Failed to load event booking form.");
    } finally {
      setLoadingForm(false);
    }
  };

  const allFields = useMemo(() => {
    if (!formSchema?.sections) return [];
    return formSchema.sections.flatMap((section) => section.fields || []);
  }, [formSchema]);

  const selectedCupCount = useMemo(() => {
    for (const field of allFields) {
      const selected = answers[field.field_name];

      if (!selected) continue;

      const selectedValues = Array.isArray(selected) ? selected : [selected];

      for (const value of selectedValues) {
        const option = (field.options || []).find((opt) => String(opt.id) === String(value));
        const cups = parseCupCount(option?.label || "");
        if (cups > 0) return cups;
      }
    }

    return 0;
  }, [allFields, answers]);

  const selectedItems = useMemo(() => {
    const items = [];

    for (const field of allFields) {
      const value = answers[field.field_name];

      if (value === undefined || value === "" || value === null) continue;

      const selectedValues = Array.isArray(value) ? value : [value];

      for (const selectedValue of selectedValues) {
        const option = (field.options || []).find(
          (opt) => String(opt.id) === String(selectedValue)
        );

        if (!option) continue;

        const optionKey = `${field.id}_${option.id}`;
        const qty = field.allow_quantity ? Math.max(1, Number(quantities[optionKey] || 1)) : 1;
        const price = Number(option.price || 0);
        const priceType = option.price_type || "fixed";

        let lineTotal = price;

        if (priceType === "per_quantity") {
          lineTotal = price * qty;
        }

        if (priceType === "per_cup") {
          lineTotal = price * selectedCupCount;
        }

        items.push({
          field_id: field.id,
          field_label: field.label,
          field_name: field.field_name,
          option_id: option.id,
          option_label: option.label,
          price,
          price_type: priceType,
          quantity: qty,
          cups: priceType === "per_cup" ? selectedCupCount : null,
          line_total: lineTotal,
        });
      }
    }

    return items;
  }, [allFields, answers, quantities, selectedCupCount]);

  const totalAmount = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  }, [selectedItems]);

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

  const handleContactMethod = (e) => {
    const { value, checked } = e.target;

    setFixedInfo((prev) => ({
      ...prev,
      contact_methods: checked
        ? [...prev.contact_methods, value]
        : prev.contact_methods.filter((item) => item !== value),
    }));
  };

  const handleDynamicChange = (field, e) => {
    const { value, checked, type } = e.target;

    setAnswers((prev) => {
      if (field.field_type === "checkbox") {
        const current = Array.isArray(prev[field.field_name]) ? prev[field.field_name] : [];

        return {
          ...prev,
          [field.field_name]: checked
            ? [...current, value]
            : current.filter((item) => item !== value),
        };
      }

      if (type === "file") {
        return {
          ...prev,
          [field.field_name]: e.target.files?.[0]?.name || "",
        };
      }

      return {
        ...prev,
        [field.field_name]: value,
      };
    });
  };

  const handleQuantityChange = (fieldId, optionId, value) => {
    const key = `${fieldId}_${optionId}`;
    setQuantities((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const validateForm = () => {
    if (!fixedInfo.full_name.trim()) return "Full name is required.";
    if (!fixedInfo.phone_number.trim()) return "Phone number is required.";
    if (!fixedInfo.email.trim()) return "Email is required.";
    if (!fixedInfo.start_time || !fixedInfo.end_time) return "Start time is required.";

    for (const field of allFields) {
      if (!Number(field.is_required)) continue;

      const value = answers[field.field_name];

      if (
        value === undefined ||
        value === "" ||
        value === null ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return `${field.label} is required.`;
      }
    }

    if (totalAmount <= 0) {
      return "Please select at least one priced option.";
    }

    return "";
  };

  const handleReview = () => {
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setStep("review");
  };

  const buildDraft = () => ({
    ...fixedInfo,
    dynamic_answers: answers,
    selected_items: selectedItems,
    total_amount: totalAmount,
  });

  const handleConfirm = async () => {
    setError("");

    try {
      const draft = buildDraft();

      const res = await API.post("/bookings/event/create-event-booking.php", {
        date,
        start_time: fixedInfo.start_time,
        end_time: fixedInfo.end_time,
        draft,
        form_id: formSchema.id,
        form_snapshot: formSchema,
        total_amount: totalAmount,
      });

      if (res.data.success) {
        navigate(`/gcash-payment?purpose=event_booking&booking_id=${res.data.booking_id}`);
      } else {
        setError(res.data.error || "Booking failed.");
      }
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        setError("Please log in to confirm your booking.");
        navigate("/login");
      } else {
        setError(err.response?.data?.error || "Connection error. Please try again.");
      }
    }
  };

  const renderDynamicField = (field) => {
    const fieldValue = answers[field.field_name] || "";

    if (["text", "number", "email", "date", "time"].includes(field.field_type)) {
      return (
        <input
          type={field.field_type}
          value={fieldValue}
          onChange={(e) => handleDynamicChange(field, e)}
        />
      );
    }

    if (field.field_type === "textarea") {
      return (
        <textarea
          value={fieldValue}
          onChange={(e) => handleDynamicChange(field, e)}
        />
      );
    }

    if (field.field_type === "select") {
      return (
        <select value={fieldValue} onChange={(e) => handleDynamicChange(field, e)}>
          <option value=""></option>
          {(field.options || []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
              {Number(option.price) > 0 ? ` — ₱${money(option.price)}` : ""}
            </option>
          ))}
        </select>
      );
    }

    if (field.field_type === "radio" || field.field_type === "checkbox") {
      return (
        <div className="options">
          {(field.options || []).map((option) => {
            const optionKey = `${field.id}_${option.id}`;
            const checked =
              field.field_type === "checkbox"
                ? Array.isArray(fieldValue) && fieldValue.includes(String(option.id))
                : String(fieldValue) === String(option.id);

            return (
              <div key={option.id}>
                <label className="opt">
                  <input
                    type={field.field_type}
                    name={field.field_name}
                    value={option.id}
                    checked={checked}
                    onChange={(e) => handleDynamicChange(field, e)}
                  />
                  {option.label}
                  {Number(option.price) > 0 ? ` — ₱${money(option.price)}` : ""}
                  {option.price_type === "per_quantity" ? " each" : ""}
                  {option.price_type === "per_cup" ? " per cup" : ""}
                </label>

                {checked && Number(field.allow_quantity) === 1 && (
                  <input
                    type="number"
                    min="1"
                    value={quantities[optionKey] || 1}
                    onChange={(e) =>
                      handleQuantityChange(field.id, option.id, e.target.value)
                    }
                    placeholder="Quantity"
                    style={{ marginTop: 6 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (field.field_type === "file") {
      return <input type="file" onChange={(e) => handleDynamicChange(field, e)} />;
    }

    return null;
  };

  return (
    <>
      <Navbar />

      <div className="booking-page">
        <div className="wrap">
          <div className="top">
            <button
              className="back"
              onClick={() => navigate(`/day?date=${date}&type=event`)}
            >
              ← Back
            </button>

            <div className="date-title">{date}</div>
          </div>

          {error && <div className="error">{error}</div>}

          {loadingForm ? (
            <div className="title">Loading booking form...</div>
          ) : (
            <>
              {step === "form" && (
                <>
                  <div className="title">{formSchema?.title || "Book your event now!"}</div>

                  <div className="section-title">CONTACT INFORMATION</div>

                  <div className="field">
                    <label className="label">Full Name</label>
                    <input
                      name="full_name"
                      value={fixedInfo.full_name}
                      onChange={handleFixedChange}
                    />
                  </div>

                  <div className="field">
                    <label className="label">Phone Number</label>
                    <input
                      name="phone_number"
                      value={fixedInfo.phone_number}
                      onChange={handleFixedChange}
                    />
                  </div>

                  <div className="field">
                    <label className="label">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={fixedInfo.email}
                      readOnly
                    />
                  </div>

                  <div className="field">
                    <label className="label">
                      Are you available to contact in the following:
                    </label>

                    <div className="options">
                      {CONTACT_METHODS.map((method) => (
                        <label className="opt" key={method}>
                          <input
                            type="checkbox"
                            value={method}
                            checked={fixedInfo.contact_methods.includes(method)}
                            onChange={handleContactMethod}
                          />
                          {method}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="two-col">
                    <div className="field">
                      <label className="label">Work Hours</label>
                      <input
                        type="time"
                        name="start_time"
                        value={fixedInfo.start_time}
                        onChange={handleFixedChange}
                      />
                    </div>

                    <div className="field">
                      <label className="label">&nbsp;</label>
                      <input
                        type="time"
                        name="end_time"
                        value={fixedInfo.end_time}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="small-note">Up to 4 hours operation</div>

                  {(formSchema?.sections || []).map((section) => (
                    <div key={section.id}>
                      <div className="section-title">{section.title}</div>

                      {(section.fields || []).map((field) => (
                        <div className="field" key={field.id}>
                          <label className="label">
                            {field.label}
                            {Number(field.is_required) === 1 ? " *" : ""}
                          </label>

                          {renderDynamicField(field)}
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="field">
                    <label className="label">Other Request (Optional)</label>
                    <input
                      name="other_request"
                      value={fixedInfo.other_request}
                      onChange={handleFixedChange}
                    />
                  </div>

                  <div className="booking-summary">
                    <div className="booking-row">
                      <span className="booking-label">Total</span>
                      <span className="booking-value">₱{money(totalAmount)}</span>
                    </div>
                  </div>

                  <div className="actions">
                    <button
                      className="btn btn-cancel"
                      onClick={() => navigate(`/day?date=${date}&type=event`)}
                    >
                      CANCEL
                    </button>

                    <button className="btn btn-next" onClick={handleReview}>
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

                  <div className="booking-summary animate-fade-in">
                    {Object.entries(fixedInfo).map(([key, value]) => {
                      if (
                        value === "" ||
                        (Array.isArray(value) && value.length === 0)
                      ) {
                        return null;
                      }

                      const label = key
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase());

                      return (
                        <div className="booking-row" key={key}>
                          <span className="booking-label">{label}</span>
                          <span className="booking-value">
                            {Array.isArray(value) ? value.join(", ") : value}
                          </span>
                        </div>
                      );
                    })}

                    {selectedItems.map((item) => (
                      <div className="booking-row" key={`${item.field_id}_${item.option_id}`}>
                        <span className="booking-label">
                          {item.field_label}: {item.option_label}
                        </span>
                        <span className="booking-value">
                          ₱{money(item.line_total)}
                        </span>
                      </div>
                    ))}

                    <div className="booking-row">
                      <span className="booking-label">Total Amount</span>
                      <span className="booking-value">₱{money(totalAmount)}</span>
                    </div>
                  </div>

                  <div className="actions">
                    <button className="btn btn-edit" onClick={() => setStep("form")}>
                      EDIT
                    </button>

                    <button className="btn btn-confirm" onClick={handleConfirm}>
                      CONFIRM
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}