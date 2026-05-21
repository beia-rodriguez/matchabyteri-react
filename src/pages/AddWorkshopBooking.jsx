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

function readableText(text = "") {
  return String(text)
    .replace(/\bCUPS\b/gi, "cups")
    .replace(/\bCUP\b/gi, "cup")
    .replace(/\bCUPER\b/gi, "cups")
    .replace(/\bPER\b/gi, "per")
    .replace(/\bPERSON\b/gi, "person")
    .replace(/\bOATMILK\b/gi, "oatmilk")
    .replace(/\bOAT MILK\b/gi, "oatmilk")
    .replace(/\bOPTIONAL\b/gi, "Optional")
    .replace(/\bTEXT\b/gi, "Text")
    .replace(/\bCALL\b/gi, "Call")
    .replace(/\bVIBER\b/gi, "Viber")
    .replace(/\bWHATSAPP\b/gi, "WhatsApp")
    .replace(/\bNEXT\b/gi, "Next")
    .replace(/\bCANCEL\b/gi, "Cancel")
    .replace(/\bEDIT\b/gi, "Edit")
    .replace(/\bCONFIRM\b/gi, "Confirm")
    .replace(/\s+/g, " ")
    .trim();
}

function getOptionLabel(option) {
  const priceText =
    Number(option.price) > 0 ? `, price ${money(option.price)} pesos` : "";

  const priceTypeText =
    option.price_type === "per_quantity"
      ? " each"
      : option.price_type === "per_cup"
      ? " per cup"
      : "";

  return readableText(`${option.label}${priceText}${priceTypeText}`);
}

function getSelectAriaLabel(field, fieldValue) {
  const options = field.options || [];

  const selectedOption = options.find(
    (option) => String(option.id) === String(fieldValue)
  );

  const choices = options
    .map((option, index) => `Press ${index + 1} for ${getOptionLabel(option)}`)
    .join(", ");

  return selectedOption
    ? `${readableText(field.label)}. Selected ${getOptionLabel(
        selectedOption
      )}. Choices: ${choices}.`
    : `${readableText(field.label)}. Select one option. Choices: ${choices}.`;
}

export default function AddWorkshopBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const dateParam = searchParams.get("date");
  const type = searchParams.get("type") || "workshop";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : new Date().toISOString().split("T")[0];

  const dt = new Date(`${date}T00:00:00`);
  const monthDay = dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const year = dt.getFullYear();

  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
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
    if (type !== "workshop") {
      navigate(
        `/day?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`,
        { replace: true }
      );
    }
  }, [type, date, navigate]);

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

  useEffect(() => {
    API.post("/bookings/private-workshop/check-blocked.php", { date })
      .then((res) => {
        if (res.data.blocked) {
          setBlocked(true);
          setBlockReason(res.data.reason || "");
        } else if (res.data.day_full) {
          setBlocked(true);
          setBlockReason("This day is fully booked.");
        } else {
          setBlocked(false);
          setBlockReason("");
        }
      })
      .catch(() => {
        setError("Failed to check blocked date.");
      });
  }, [date]);

  const loadActiveForm = async () => {
    setLoadingForm(true);
    setError("");

    try {
      const { data } = await API.get("/bookings/get-active-booking-form.php", {
        params: { type: "workshop" },
      });

      if (!data.form) {
        setError("No active private workshop booking form found. Please ask admin to create one.");
        return;
      }

      setFormSchema(data.form);
    } catch (err) {
      console.error(err);
      setError("Failed to load workshop booking form.");
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
        const option = (field.options || []).find(
          (opt) => String(opt.id) === String(value)
        );

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
        const qty =
          Number(field.allow_quantity) === 1
            ? Math.max(1, Number(quantities[optionKey] || 1))
            : 1;

        const price = Number(option.price || 0);
        const priceType = option.price_type || "fixed";

        let lineTotal = price;

        if (priceType === "per_quantity") lineTotal = price * qty;
        if (priceType === "per_cup") lineTotal = price * selectedCupCount;

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
    return selectedItems.reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0
    );
  }, [selectedItems]);

  useEffect(() => {
    const readableContent = document.getElementById("readable-content");
    if (!readableContent) return;

    readableContent
      .querySelectorAll("label, .workshop-booking-label")
      .forEach((element) => {
        if (!element.classList.contains("workshop-booking-opt")) {
          element.removeAttribute("tabindex");
        }
      });

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
      "h1, h2, h3, h4, h5, h6, p, input, textarea, select, button, img, a, li, .workshop-booking-opt, .workshop-booking-date-title, .workshop-booking-year-title, .workshop-booking-title, .workshop-booking-section-title, .workshop-booking-small-note, .workshop-booking-blocked, .workshop-booking-error, .booking-label, .booking-value"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (
        !element.classList.contains("workshop-booking-opt") &&
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
        const parentDiv =
          element.closest(".workshop-booking-field") || element.closest("div");
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
        !element.classList.contains("workshop-booking-opt") &&
        tagName !== "button" &&
        tagName !== "a" &&
        tagName !== "input" &&
        tagName !== "textarea" &&
        tagName !== "select"
      ) {
        element.setAttribute("tabindex", "0");
      }

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", readableText(textToRead));
      }
    });
  }, [
    step,
    error,
    blocked,
    blockReason,
    loadingForm,
    formSchema,
    fixedInfo,
    answers,
    quantities,
    selectedItems,
    totalAmount,
  ]);

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

  const handleContactMethodKeyDown = (method, e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();

      setFixedInfo((prev) => ({
        ...prev,
        contact_methods: prev.contact_methods.includes(method.value)
          ? prev.contact_methods.filter((item) => item !== method.value)
          : [...prev.contact_methods, method.value],
      }));
    }
  };

  const handleOptionKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();

      const input = e.currentTarget.querySelector("input");

      if (input && !input.disabled) {
        input.click();
      }
    }
  };

  const handleSelectKeyDown = (field, e) => {
    const options = field.options || [];
    const pressedNumber = Number(e.key);

    if (!pressedNumber || pressedNumber < 1 || pressedNumber > options.length) {
      return;
    }

    e.preventDefault();

    const selectedOption = options[pressedNumber - 1];

    if (!selectedOption) return;

    setAnswers((prev) => ({
      ...prev,
      [field.field_name]: String(selectedOption.id),
    }));
  };

  const handleDynamicChange = (field, e) => {
    const { value, checked, type } = e.target;

    setAnswers((prev) => {
      if (field.field_type === "checkbox") {
        const current = Array.isArray(prev[field.field_name])
          ? prev[field.field_name]
          : [];

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
    if (blocked) return blockReason || "This date is not available.";
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

  const handleNext = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const st = fixedInfo.start_time;
    const et = fixedInfo.end_time;

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
    date,
    booking_type: "workshop",
    dynamic_answers: answers,
    selected_items: selectedItems,
    total_amount: totalAmount,
  });

  const handleConfirm = async (e) => {
    if (e) e.preventDefault();

    setError("");

    try {
      const draft = buildDraft();

      const res = await API.post("/bookings/private-workshop/confirm-booking.php", {
        date,
        draft,
        booking_type: "workshop",
        form_id: formSchema.id,
        form_snapshot: formSchema,
        total_amount: totalAmount,
      });

      if (res.data.success || res.data.booking_id) {
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

  const renderDynamicField = (field, readOnly = false) => {
    const fieldValue = answers[field.field_name] || "";

    if (["text", "number", "email", "date", "time"].includes(field.field_type)) {
      return (
        <input
          type={field.field_type}
          value={fieldValue}
          readOnly={readOnly}
          aria-label={
            String(fieldValue).trim()
              ? `${readableText(field.label)}: ${readableText(fieldValue)}`
              : `Enter ${readableText(field.label)}`
          }
          onChange={(e) => handleDynamicChange(field, e)}
        />
      );
    }

    if (field.field_type === "textarea") {
      return (
        <textarea
          value={fieldValue}
          readOnly={readOnly}
          aria-label={
            String(fieldValue).trim()
              ? `${readableText(field.label)}: ${readableText(fieldValue)}`
              : `Enter ${readableText(field.label)}`
          }
          onChange={(e) => handleDynamicChange(field, e)}
        />
      );
    }

    if (field.field_type === "select") {
      const selectedOption = (field.options || []).find(
        (option) => String(option.id) === String(fieldValue)
      );

      return (
        <select
          value={fieldValue}
          disabled={readOnly}
          aria-label={
            readOnly
              ? selectedOption
                ? `${readableText(field.label)}: ${getOptionLabel(selectedOption)}`
                : `Select ${readableText(field.label)}`
              : getSelectAriaLabel(field, fieldValue)
          }
          onKeyDown={(e) => handleSelectKeyDown(field, e)}
          onChange={(e) => handleDynamicChange(field, e)}
        >
          <option value=""></option>
          {(field.options || []).map((option) => (
            <option
              key={option.id}
              value={option.id}
              aria-label={getOptionLabel(option)}
            >
              {option.label}
              {Number(option.price) > 0 ? ` — ₱${money(option.price)}` : ""}
            </option>
          ))}
        </select>
      );
    }

    if (field.field_type === "radio" || field.field_type === "checkbox") {
      return (
        <div className="workshop-booking-options">
          {(field.options || []).map((option) => {
            const optionKey = `${field.id}_${option.id}`;

            const checked =
              field.field_type === "checkbox"
                ? Array.isArray(fieldValue) && fieldValue.includes(String(option.id))
                : String(fieldValue) === String(option.id);

            const readableField = readableText(field.label);
            const readableOption = getOptionLabel(option);

            return (
              <div key={option.id}>
                <label
                  className="workshop-booking-opt"
                  tabIndex={readOnly ? -1 : 0}
                  role={field.field_type === "radio" ? "radio" : "checkbox"}
                  aria-checked={checked}
                  aria-label={`${readableField}: ${readableOption}. ${
                    checked ? "Selected" : "Not selected"
                  }. Press Enter to ${checked ? "unselect" : "select"}.`}
                  onKeyDown={handleOptionKeyDown}
                >
                  <input
                    type={field.field_type}
                    name={field.field_name}
                    value={option.id}
                    checked={checked}
                    disabled={readOnly}
                    tabIndex={-1}
                    aria-hidden="true"
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
                    readOnly={readOnly}
                    value={quantities[optionKey] || 1}
                    aria-label={`Quantity for ${readableOption}: ${
                      quantities[optionKey] || 1
                    }`}
                    onChange={(e) =>
                      handleQuantityChange(field.id, option.id, e.target.value)
                    }
                    placeholder="Quantity"
                    className="workshop-booking-custom-location-input"
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (field.field_type === "file") {
      return (
        <input
          type="file"
          disabled={readOnly}
          aria-label={`Upload ${readableText(field.label)}`}
          onChange={(e) => handleDynamicChange(field, e)}
        />
      );
    }

    return null;
  };

  return (
    <>
      <Navbar />

      <div className="workshop-booking-page" id="readable-content">
        <div className="workshop-booking-wrap">
          <div className="workshop-booking-top">
            <button
              className="workshop-booking-back"
              type="button"
              aria-label="Back"
              onClick={() => navigate(`/day?date=${date}&type=workshop`)}
            >
              <img src="/images/left-book.png" alt="" aria-hidden="true" />
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

            {loadingForm ? (
              <div className="workshop-booking-title">Loading booking form...</div>
            ) : step === "review" ? (
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
                      value={fixedInfo.full_name}
                      readOnly
                      aria-label={
                        fixedInfo.full_name.trim()
                          ? `Full Name: ${fixedInfo.full_name}`
                          : "Enter Full Name"
                      }
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Phone Number</label>
                    <input
                      value={fixedInfo.phone_number}
                      readOnly
                      aria-label={
                        fixedInfo.phone_number.trim()
                          ? `Phone Number: ${fixedInfo.phone_number}`
                          : "Enter Phone Number"
                      }
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Email Address</label>
                    <input
                      value={fixedInfo.email}
                      readOnly
                      aria-label={
                        fixedInfo.email.trim()
                          ? `Email Address: ${fixedInfo.email}`
                          : "Enter Email Address"
                      }
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Contact Methods
                    </label>
                    <input
                      value={fixedInfo.contact_methods.join(", ")}
                      readOnly
                      aria-label={
                        fixedInfo.contact_methods.length > 0
                          ? `Contact Methods: ${fixedInfo.contact_methods.join(", ")}`
                          : "Enter Contact Methods"
                      }
                    />
                  </div>

                  <div className="workshop-booking-section-title">
                    BOOKING INFORMATION
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Date</label>
                    <input
                      value={`${monthDay}, ${year}`}
                      readOnly
                      aria-label={`Date: ${monthDay}, ${year}`}
                    />
                  </div>

                  <div className="workshop-booking-two-col">
                    <div className="workshop-booking-field workshop-booking-field-no-margin">
                      <label className="workshop-booking-label">
                        Event Time of Workshop
                      </label>
                      <input
                        type="time"
                        value={fixedInfo.start_time}
                        readOnly
                        aria-label={
                          fixedInfo.start_time
                            ? `Start Time: ${fixedInfo.start_time}`
                            : "Enter Start Time"
                        }
                      />
                    </div>

                    <div className="workshop-booking-field workshop-booking-field-no-margin">
                      <label className="workshop-booking-label">&nbsp;</label>
                      <input
                        type="time"
                        value={fixedInfo.end_time}
                        readOnly
                        aria-label={
                          fixedInfo.end_time
                            ? `End Time: ${fixedInfo.end_time}`
                            : "End Time"
                        }
                      />
                    </div>
                  </div>

                  <div className="workshop-booking-small-note">
                    up to 4 hours operation
                  </div>

                  {(formSchema?.sections || []).map((section) => (
                    <div key={section.id}>
                      <div className="workshop-booking-section-title">
                        {section.title}
                      </div>

                      {(section.fields || []).map((field) => (
                        <div className="workshop-booking-field" key={field.id}>
                          <label className="workshop-booking-label">
                            {field.label}
                          </label>
                          {renderDynamicField(field, true)}
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Other Request
                    </label>
                    <input
                      value={fixedInfo.other_request || ""}
                      readOnly
                      aria-label={
                        fixedInfo.other_request.trim()
                          ? `Other Request: ${fixedInfo.other_request}`
                          : "Enter Other Request"
                      }
                    />
                  </div>

                  <div className="booking-summary">
                    {selectedItems.map((item) => (
                      <div
                        className="booking-row"
                        key={`${item.field_id}_${item.option_id}`}
                      >
                        <span className="booking-label">
                          {readableText(item.field_label)}:{" "}
                          {readableText(item.option_label)}
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

                  <div className="workshop-booking-actions">
                    <button
                      type="button"
                      className="workshop-booking-btn workshop-booking-btn-edit"
                      aria-label="Edit"
                      onClick={() => setStep("form")}
                    >
                      EDIT
                    </button>

                    <button
                      type="submit"
                      className="workshop-booking-btn workshop-booking-btn-confirm"
                      aria-label="Confirm"
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
                  {formSchema?.title || "Book your workshop now!"}
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
                      value={fixedInfo.full_name}
                      aria-label={
                        fixedInfo.full_name.trim()
                          ? `Full Name: ${fixedInfo.full_name}`
                          : "Enter Full Name"
                      }
                      onChange={handleFixedChange}
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Phone Number</label>
                    <input
                      type="text"
                      name="phone_number"
                      required
                      value={fixedInfo.phone_number}
                      aria-label={
                        fixedInfo.phone_number.trim()
                          ? `Phone Number: ${fixedInfo.phone_number}`
                          : "Enter Phone Number"
                      }
                      onChange={handleFixedChange}
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Email Address</label>
                    <input
                      name="email"
                      value={fixedInfo.email}
                      readOnly
                      aria-label={
                        fixedInfo.email.trim()
                          ? `Email Address: ${fixedInfo.email}`
                          : "Enter Email Address"
                      }
                    />
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Are you available to contact in the following:
                    </label>

                    <div className="workshop-booking-options">
                      {CONTACT_METHODS.map((method) => {
                        const checked = fixedInfo.contact_methods.includes(
                          method.value
                        );

                        return (
                          <label
                            key={method.value}
                            className="workshop-booking-opt"
                            tabIndex="0"
                            role="checkbox"
                            aria-checked={checked}
                            aria-label={`Contact method: ${method.label}. ${
                              checked ? "Selected" : "Not selected"
                            }. Press Enter to ${
                              checked ? "unselect" : "select"
                            }.`}
                            onKeyDown={(e) =>
                              handleContactMethodKeyDown(method, e)
                            }
                          >
                            <input
                              type="checkbox"
                              value={method.value}
                              checked={checked}
                              tabIndex={-1}
                              aria-hidden="true"
                              onChange={handleContactMethod}
                            />
                            {method.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="workshop-booking-section-title">
                    BOOKING INFORMATION
                  </div>

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">Date</label>
                    <input
                      value={`${monthDay}, ${year}`}
                      readOnly
                      aria-label={`Date: ${monthDay}, ${year}`}
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
                        required
                        value={fixedInfo.start_time}
                        aria-label={
                          fixedInfo.start_time
                            ? `Start Time: ${fixedInfo.start_time}`
                            : "Enter Start Time"
                        }
                        onChange={handleFixedChange}
                      />
                    </div>

                    <div className="workshop-booking-field workshop-booking-field-no-margin">
                      <label className="workshop-booking-label">&nbsp;</label>
                      <input
                        type="time"
                        name="end_time"
                        required
                        readOnly
                        value={fixedInfo.end_time}
                        aria-label={
                          fixedInfo.end_time
                            ? `End Time: ${fixedInfo.end_time}`
                            : "End Time"
                        }
                      />
                    </div>
                  </div>

                  <div className="workshop-booking-small-note">
                    up to 4 hours operation
                  </div>

                  {(formSchema?.sections || []).map((section) => (
                    <div key={section.id}>
                      <div className="workshop-booking-section-title">
                        {section.title}
                      </div>

                      {(section.fields || []).map((field) => (
                        <div className="workshop-booking-field" key={field.id}>
                          <label className="workshop-booking-label">
                            {field.label}
                            {Number(field.is_required) === 1 ? " *" : ""}
                          </label>

                          {renderDynamicField(field)}
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="workshop-booking-field">
                    <label className="workshop-booking-label">
                      Other Request (Optional)
                    </label>
                    <input
                      type="text"
                      name="other_request"
                      value={fixedInfo.other_request}
                      aria-label={
                        fixedInfo.other_request.trim()
                          ? `Other Request: ${fixedInfo.other_request}`
                          : "Enter Other Request Optional"
                      }
                      onChange={handleFixedChange}
                    />
                  </div>

                  <div className="booking-summary">
                    <div className="booking-row">
                      <span className="booking-label">Total</span>
                      <span className="booking-value">₱{money(totalAmount)}</span>
                    </div>
                  </div>

                  <div className="workshop-booking-actions">
                    <button
                      type="button"
                      className="workshop-booking-btn workshop-booking-btn-cancel"
                      aria-label="Cancel"
                      onClick={() => navigate(`/day?date=${date}&type=workshop`)}
                    >
                      CANCEL
                    </button>

                    <button
                      type="submit"
                      className="workshop-booking-btn workshop-booking-btn-next"
                      aria-label="Next"
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