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

  const headerDate = date;

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
  const [otherAnswers, setOtherAnswers] = useState({});

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
        setError(
          "No active private workshop booking form found. Please ask admin to create one."
        );
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

  const baseRate = useMemo(() => {
    return Math.max(0, Number(formSchema?.base_rate || 0));
  }, [formSchema]);

  const isOtherOption = (option) => Number(option?.is_other || 0) === 1;

  const otherAnswerKey = (fieldId, optionId) => `${fieldId}_${optionId}`;

  const getOtherAnswer = (fieldId, optionId) => {
    return otherAnswers[otherAnswerKey(fieldId, optionId)] || "";
  };

  const selectedOptionNeedsOtherText = (field, value) => {
    const selectedValues = Array.isArray(value) ? value : [value];

    return selectedValues.some((selectedValue) => {
      const option = (field.options || []).find(
        (opt) => String(opt.id) === String(selectedValue)
      );

      return isOtherOption(option);
    });
  };

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

        const optionIsOther = isOtherOption(option);
        const otherValue = optionIsOther
          ? getOtherAnswer(field.id, option.id).trim()
          : "";

        items.push({
          field_id: field.id,
          field_label: field.label,
          field_name: field.field_name,
          option_id: option.id,
          option_label: optionIsOther && otherValue ? `Other: ${otherValue}` : option.label,
          option_is_other: optionIsOther ? 1 : 0,
          other_value: otherValue,
          price,
          price_type: priceType,
          quantity: qty,
          cups: priceType === "per_cup" ? selectedCupCount : null,
          line_total: lineTotal,
        });
      }
    }

    return items;
  }, [allFields, answers, quantities, selectedCupCount, otherAnswers]);

  const totalAmount = useMemo(() => {
    const optionTotal = selectedItems.reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0
    );

    return baseRate + optionTotal;
  }, [baseRate, selectedItems]);

  useEffect(() => {
    const readableContent = document.getElementById("readable-content");
    if (!readableContent) return;

    readableContent.querySelectorAll("label, .awb-label").forEach((element) => {
      if (!element.classList.contains("awb-option")) {
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
      "h1, h2, h3, h4, h5, h6, p, input, textarea, select, button, img, a, li, .awb-option, .awb-date-title, .awb-year-title, .awb-title, .awb-section-title, .awb-small-note, .awb-blocked, .awb-error, .awb-summary-label, .awb-summary-value"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (
        !element.classList.contains("awb-option") &&
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
        const parentDiv = element.closest(".awb-field") || element.closest("div");
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
        !element.classList.contains("awb-option") &&
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
    otherAnswers,
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

    if (field.field_type === "checkbox" && !checked) {
      clearOtherAnswer(field.id, value);
    }

    if (field.field_type === "radio" || field.field_type === "select") {
      clearOtherAnswersForField(field);
    }

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

  const handleOtherAnswerChange = (fieldId, optionId, value) => {
    setOtherAnswers((prev) => ({
      ...prev,
      [otherAnswerKey(fieldId, optionId)]: value,
    }));
  };

  const clearOtherAnswer = (fieldId, optionId) => {
    setOtherAnswers((prev) => {
      const next = { ...prev };
      delete next[otherAnswerKey(fieldId, optionId)];
      return next;
    });
  };

  const clearOtherAnswersForField = (field) => {
    setOtherAnswers((prev) => {
      const next = { ...prev };

      (field.options || []).forEach((option) => {
        delete next[otherAnswerKey(field.id, option.id)];
      });

      return next;
    });
  };

  const validateForm = () => {
    if (blocked) return blockReason || "This date is not available.";
    if (!fixedInfo.full_name.trim()) return "Full name is required.";
    if (!fixedInfo.phone_number.trim()) return "Phone number is required.";
    if (!fixedInfo.email.trim()) return "Email is required.";
    if (!fixedInfo.start_time || !fixedInfo.end_time)
      return "Start time is required.";

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

    for (const field of allFields) {
      const value = answers[field.field_name];

      if (!selectedOptionNeedsOtherText(field, value)) continue;

      const selectedValues = Array.isArray(value) ? value : [value];
      const missingOtherText = selectedValues.some((selectedValue) => {
        const option = (field.options || []).find(
          (opt) => String(opt.id) === String(selectedValue)
        );

        return isOtherOption(option) && !getOtherAnswer(field.id, option.id).trim();
      });

      if (missingOtherText) {
        return `Please specify your answer for "${field.label} - Other".`;
      }
    }

    if (totalAmount <= 0) {
      return "Please select at least one priced option or ask admin to set a base booking rate.";
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
    other_answers: otherAnswers,
    selected_items: selectedItems,
    base_rate: baseRate,
    total_amount: totalAmount,
  });

  const handleConfirm = async (e) => {
    if (e) e.preventDefault();

    setError("");

    try {
      const draft = buildDraft();

      const res = await API.post(
        "/bookings/private-workshop/confirm-booking.php",
        {
          date,
          draft,
          booking_type: "workshop",
          form_id: formSchema.id,
          form_snapshot: formSchema,
          total_amount: totalAmount,
        }
      );

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
        <>
          <select
            value={fieldValue}
            disabled={readOnly}
            aria-label={
              readOnly
                ? selectedOption
                  ? `${readableText(field.label)}: ${getOptionLabel(
                      selectedOption
                    )}`
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

          {selectedOption && isOtherOption(selectedOption) && (
            <input
              className="awb-other-input"
              type="text"
              readOnly={readOnly}
              value={getOtherAnswer(field.id, selectedOption.id)}
              placeholder="Please specify"
              aria-label={`Please specify other answer for ${readableText(field.label)}`}
              onChange={(e) =>
                handleOtherAnswerChange(field.id, selectedOption.id, e.target.value)
              }
            />
          )}
        </>
      );
    }

    if (field.field_type === "radio" || field.field_type === "checkbox") {
      return (
        <div className="awb-options">
          {(field.options || []).map((option) => {
            const optionKey = `${field.id}_${option.id}`;

            const checked =
              field.field_type === "checkbox"
                ? Array.isArray(fieldValue) &&
                  fieldValue.includes(String(option.id))
                : String(fieldValue) === String(option.id);

            const readableField = readableText(field.label);
            const readableOption = getOptionLabel(option);

            return (
              <div key={option.id}>
                <label
                  className="awb-option"
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

                {checked && isOtherOption(option) && (
                  <input
                    className="awb-other-input"
                    type="text"
                    readOnly={readOnly}
                    value={getOtherAnswer(field.id, option.id)}
                    placeholder="Please specify"
                    aria-label={`Please specify other answer for ${readableField}`}
                    onChange={(e) =>
                      handleOtherAnswerChange(field.id, option.id, e.target.value)
                    }
                  />
                )}

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
                    className="awb-quantity-input"
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

            <div className="awb-date-title">{headerDate}</div>
          </div>

          <div className={`awb-card ${step === "review" ? "awb-review" : ""}`}>
            {blocked && (
              <>
                <div className="awb-blocked">This date is not available.</div>
                {blockReason && (
                  <div className="awb-small-note awb-center">
                    {blockReason}
                  </div>
                )}
              </>
            )}

            {error && <div className="awb-error">{error}</div>}

            {loadingForm ? (
              <div className="awb-title">Loading booking form...</div>
            ) : step === "review" ? (
              <>
                <div className="awb-title">
                  Please review your details carefully, before confirmation.
                </div>

                <form onSubmit={handleConfirm}>
                  <div className="awb-section-title">CONTACT INFORMATION</div>

                  <div className="awb-field">
                    <label className="awb-label">Full Name</label>
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

                  <div className="awb-field">
                    <label className="awb-label">Phone Number</label>
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

                  <div className="awb-field">
                    <label className="awb-label">Email Address</label>
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

                  <div className="awb-field">
                    <label className="awb-label">Contact Methods</label>
                    <input
                      value={fixedInfo.contact_methods.join(", ")}
                      readOnly
                      aria-label={
                        fixedInfo.contact_methods.length > 0
                          ? `Contact Methods: ${fixedInfo.contact_methods.join(
                              ", "
                            )}`
                          : "Enter Contact Methods"
                      }
                    />
                  </div>

                  <div className="awb-section-title">BOOKING INFORMATION</div>

                  <div className="awb-field">
                    <label className="awb-label">Date</label>
                    <input
                      value={headerDate}
                      readOnly
                      aria-label={`Date: ${headerDate}`}
                    />
                  </div>

                  <div className="awb-two-col">
                    <div className="awb-field awb-field-no-margin">
                      <label className="awb-label">Event Time of Workshop</label>
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

                    <div className="awb-field awb-field-no-margin">
                      <label className="awb-label">&nbsp;</label>
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

                  <div className="awb-small-note">up to 4 hours operation</div>

                  {(formSchema?.sections || []).map((section) => (
                    <div key={section.id}>
                      <div className="awb-section-title">{section.title}</div>

                      {(section.fields || []).map((field) => (
                        <div className="awb-field" key={field.id}>
                          <label className="awb-label">{field.label}</label>
                          {renderDynamicField(field, true)}
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="awb-field">
                    <label className="awb-label">Other Request</label>
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

                  <div className="awb-summary">
                    {baseRate > 0 && (
                      <div className="awb-summary-row">
                        <span className="awb-summary-label">Base Booking Rate</span>
                        <span className="awb-summary-value">
                          ₱{money(baseRate)}
                        </span>
                      </div>
                    )}

                    {selectedItems.map((item) => (
                      <div
                        className="awb-summary-row"
                        key={`${item.field_id}_${item.option_id}`}
                      >
                        <span className="awb-summary-label">
                          {readableText(item.field_label)}:{" "}
                          {readableText(item.option_label)}
                        </span>
                        <span className="awb-summary-value">
                          ₱{money(item.line_total)}
                        </span>
                      </div>
                    ))}

                    <div className="awb-summary-row">
                      <span className="awb-summary-label">Total Amount</span>
                      <span className="awb-summary-value">
                        ₱{money(totalAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="awb-actions">
                    <button
                      type="button"
                      className="awb-btn awb-btn-edit"
                      aria-label="Edit"
                      onClick={() => setStep("form")}
                    >
                      EDIT
                    </button>

                    <button
                      type="submit"
                      className="awb-btn awb-btn-confirm"
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
                <div className="awb-title">
                  {formSchema?.title || "Book your workshop now!"}
                </div>

                <form onSubmit={handleNext}>
                  <div className="awb-section-title">CONTACT INFORMATION</div>

                  <div className="awb-field">
                    <label className="awb-label">Full Name</label>
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

                  <div className="awb-field">
                    <label className="awb-label">Phone Number</label>
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

                  <div className="awb-field">
                    <label className="awb-label">Email Address</label>
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

                  <div className="awb-field">
                    <label className="awb-label">
                      Are you available to contact in the following:
                    </label>

                    <div className="awb-options">
                      {CONTACT_METHODS.map((method) => {
                        const checked = fixedInfo.contact_methods.includes(
                          method.value
                        );

                        return (
                          <label
                            key={method.value}
                            className="awb-option"
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

                  <div className="awb-section-title">BOOKING INFORMATION</div>

                  <div className="awb-field">
                    <label className="awb-label">Date</label>
                    <input
                      value={headerDate}
                      readOnly
                      aria-label={`Date: ${headerDate}`}
                    />
                  </div>

                  <div className="awb-two-col">
                    <div className="awb-field awb-field-no-margin">
                      <label className="awb-label">Event Time of Workshop</label>
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

                    <div className="awb-field awb-field-no-margin">
                      <label className="awb-label">&nbsp;</label>
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

                  <div className="awb-small-note">up to 4 hours operation</div>

                  {(formSchema?.sections || []).map((section) => (
                    <div key={section.id}>
                      <div className="awb-section-title">{section.title}</div>

                      {(section.fields || []).map((field) => (
                        <div className="awb-field" key={field.id}>
                          <label className="awb-label">
                            {field.label}
                            {Number(field.is_required) === 1 ? " *" : ""}
                          </label>

                          {renderDynamicField(field)}
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="awb-field">
                    <label className="awb-label">
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

                  <div className="awb-summary">
                    {baseRate > 0 && (
                      <div className="awb-summary-row">
                        <span className="awb-summary-label">Base Booking Rate</span>
                        <span className="awb-summary-value">
                          ₱{money(baseRate)}
                        </span>
                      </div>
                    )}

                    <div className="awb-summary-row">
                      <span className="awb-summary-label">Total</span>
                      <span className="awb-summary-value">
                        ₱{money(totalAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="awb-actions">
                    <button
                      type="button"
                      className="awb-btn awb-btn-cancel"
                      aria-label="Cancel"
                      onClick={() => navigate(`/day?date=${date}&type=workshop`)}
                    >
                      CANCEL
                    </button>

                    <button
                      type="submit"
                      className="awb-btn awb-btn-next"
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