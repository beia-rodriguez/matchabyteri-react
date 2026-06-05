import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
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

const DEFAULT_PRIVATE_PACKAGES = [
  {
    id: "STANDARD",
    package_code: "STANDARD",
    label: "Standard Package",
    price_per_person: 3000,
    description: "Private workshop standard package",
    is_active: 1,
    sort_order: 1,
  },
  {
    id: "PREMIUM",
    package_code: "PREMIUM",
    label: "Premium Package",
    price_per_person: 3800,
    description: "Private workshop premium package",
    is_active: 1,
    sort_order: 2,
  },
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

function integerValue(value) {
  const text = String(value ?? "").replace(/[^\d]/g, "");
  return text === "" ? "" : text;
}

function packageKey(pkg) {
  return String(pkg.id || pkg.package_code || pkg.label || "");
}

function packageCode(pkg) {
  return String(pkg.package_code || pkg.id || "").toUpperCase();
}



const fixedInfoInitialState = {
  full_name: "",
  phone_number: "",
  email: "",
  contact_methods: [],
  start_time: "",
  end_time: "",
  workshop_location: "",
  other_request: "",
};

function fixedInfoReducer(state, action) {
  switch (action.type) {
    case "patch": {
      const patch =
        typeof action.updater === "function"
          ? action.updater(state)
          : action.updater || action.patch || {};

      return { ...state, ...patch };
    }

    case "current_user_success":
      return {
        ...state,
        full_name: action.user?.name || state.full_name,
        email: action.user?.email || state.email,
        phone_number: action.user?.phone_number || state.phone_number,
      };

    default:
      return state;
  }
}

const availabilityInitialState = {
  blocked: false,
  blockReason: "",
};

function availabilityReducer(state, action) {
  switch (action.type) {
    case "blocked":
      return {
        blocked: true,
        blockReason: action.reason || "This date is not available.",
      };

    case "available":
      return availabilityInitialState;

    default:
      return state;
  }
}

const pricingResponseInitialState = {
  response: null,
};

function pricingResponseReducer(state, action) {
  switch (action.type) {
    case "reset":
      return pricingResponseInitialState;

    case "success":
      return { response: action.response };

    default:
      return state;
  }
}

function normalizePackages(packages) {
  const activePackages = safeArray(packages)
    .filter((pkg) => Number(pkg.is_active ?? 1) === 1)
    .sort((a, b) => {
      const sortA = numberValue(a.sort_order);
      const sortB = numberValue(b.sort_order);

      if (sortA !== sortB) return sortA - sortB;

      return String(a.label || a.package_code || "").localeCompare(
        String(b.label || b.package_code || "")
      );
    });

  return activePackages.length > 0 ? activePackages : DEFAULT_PRIVATE_PACKAGES;
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
  const [availabilityState, dispatchAvailability] = useReducer(
    availabilityReducer,
    availabilityInitialState
  );
  const { blocked, blockReason } = availabilityState;

  const [pricingResponseState, dispatchPricingResponse] = useReducer(
    pricingResponseReducer,
    pricingResponseInitialState
  );

  const pricingResponse = pricingResponseState.response;
  const loading = pricingResponse === null && !error;

  const [fixedInfo, dispatchFixedInfo] = useReducer(
    fixedInfoReducer,
    fixedInfoInitialState
  );

  const setFixedInfo = useCallback((updater) => {
    dispatchFixedInfo({ type: "patch", updater });
  }, []);

  const [workshopInfo, setWorkshopInfo] = useState({
    total_attendees: "",
    package_attendees: {},
  });

  const packages = useMemo(() => {
    const pricingForm = pricingResponse?.form || {};
    const pricingSettings = pricingResponse?.pricing || {};
    let loadedPackages = [];

    if (Array.isArray(pricingForm.packages)) {
      loadedPackages = pricingForm.packages;
    } else if (Array.isArray(pricingSettings.packages)) {
      loadedPackages = pricingSettings.packages;
    } else if (
      pricingSettings.private_workshop_standard_price ||
      pricingSettings.private_workshop_premium_price
    ) {
      loadedPackages = [
        {
          ...DEFAULT_PRIVATE_PACKAGES[0],
          price_per_person:
            pricingSettings.private_workshop_standard_price ||
            DEFAULT_PRIVATE_PACKAGES[0].price_per_person,
        },
        {
          ...DEFAULT_PRIVATE_PACKAGES[1],
          price_per_person:
            pricingSettings.private_workshop_premium_price ||
            DEFAULT_PRIVATE_PACKAGES[1].price_per_person,
        },
      ];
    }

    return normalizePackages(loadedPackages);
  }, [pricingResponse]);

  const downpaymentPercentage = useMemo(() => {
    const pricingForm = pricingResponse?.form || {};
    const pricingSettings = pricingResponse?.pricing || {};

    return numberValue(
      pricingForm.downpayment_percentage ||
        pricingSettings.private_workshop_downpayment_percentage ||
        50
    );
  }, [pricingResponse]);

  useEffect(() => {
    if (type !== "workshop" && type !== "private_workshop") {
      navigate(
        `/day?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`,
        {
          replace: true,
        }
      );
    }
  }, [type, date, navigate]);

  const loadPricing = useCallback(async () => {
    dispatchPricingResponse({ type: "reset" });
    setError("");

    try {
      const { data } = await API.get("/bookings/get-active-booking-form.php", {
        params: { type: "private_workshop" },
      });

      dispatchPricingResponse({ type: "success", response: data });
    } catch (err) {
      console.error(err);
      dispatchPricingResponse({
        type: "success",
        response: {
          form: {
            packages: DEFAULT_PRIVATE_PACKAGES,
            downpayment_percentage: 50,
          },
        },
      });
      setError("Failed to load private workshop pricing.");
    }
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const { data } = await API.get("/user/current-user.php");

      if (data.success && data.user) {
        dispatchFixedInfo({
          type: "current_user_success",
          user: data.user,
        });
      }
    } catch {
      // Keep empty fields.
    }
  }, []);

  const checkBlockedDate = useCallback(async () => {
    try {
      const res = await API.post("/bookings/private-workshop/check-blocked.php", {
        date,
      });

      if (res.data.blocked) {
        dispatchAvailability({
          type: "blocked",
          reason: res.data.reason || "This date is not available.",
        });
      } else if (res.data.day_full) {
        dispatchAvailability({
          type: "blocked",
          reason: "This day is fully booked.",
        });
      } else {
        dispatchAvailability({ type: "available" });
      }
    } catch {
      setError("Failed to check blocked date.");
    }
  }, [date]);

  useEffect(() => {
    loadPricing();
    loadCurrentUser();
    checkBlockedDate();
  }, [loadPricing, loadCurrentUser, checkBlockedDate]);

  const packageBreakdown = useMemo(() => {
    return safeArray(packages).map((pkg) => {
      const key = packageKey(pkg);
      const attendees = numberValue(workshopInfo.package_attendees?.[key] || 0);
      const price = numberValue(pkg.price_per_person);
      const subtotal = attendees * price;

      return {
        key,
        package_id: pkg.id,
        package_code: pkg.package_code,
        label: pkg.label,
        price_per_person: price,
        attendees,
        subtotal,
      };
    });
  }, [packages, workshopInfo.package_attendees]);

  const packageAttendeesTotal = useMemo(() => {
    return packageBreakdown.reduce((sum, item) => sum + item.attendees, 0);
  }, [packageBreakdown]);

  const totalAmount = useMemo(() => {
    return packageBreakdown.reduce((sum, item) => sum + item.subtotal, 0);
  }, [packageBreakdown]);

  const dueNow = useMemo(() => {
    return totalAmount * (numberValue(downpaymentPercentage || 50) / 100);
  }, [totalAmount, downpaymentPercentage]);

  const standardPackage = useMemo(() => {
    return packageBreakdown.find((item) => packageCode(item) === "STANDARD");
  }, [packageBreakdown]);

  const premiumPackage = useMemo(() => {
    return packageBreakdown.find((item) => packageCode(item) === "PREMIUM");
  }, [packageBreakdown]);

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

  const handleTotalAttendeesChange = (e) => {
    const value = integerValue(e.target.value);

    setWorkshopInfo((prev) => ({
      ...prev,
      total_attendees: value,
    }));
  };

  const handlePackageAttendeesChange = (key, value) => {
    setWorkshopInfo((prev) => ({
      ...prev,
      package_attendees: {
        ...(prev.package_attendees || {}),
        [key]: integerValue(value),
      },
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
    const totalAttendees = numberValue(workshopInfo.total_attendees || 0);

    if (blocked) return blockReason || "This date is not available.";
    if (!fixedInfo.full_name.trim()) return "Full name is required.";
    if (!fixedInfo.phone_number.trim()) return "Phone number is required.";
    if (!fixedInfo.email.trim()) return "Email is required.";

    if (!fixedInfo.start_time || !fixedInfo.end_time) {
      return "Start time is required.";
    }

    if (!fixedInfo.workshop_location.trim()) {
      return "Workshop location is required.";
    }

    if (totalAttendees <= 0) return "Total attendees is required.";

    if (!Number.isInteger(totalAttendees)) {
      return "Total attendees must be a whole number.";
    }

    for (const item of packageBreakdown) {
      if (!Number.isInteger(item.attendees)) {
        return `${item.label} attendees must be a whole number.`;
      }

      if (item.attendees < 0) {
        return "Attendee counts cannot be negative.";
      }
    }

    if (packageAttendeesTotal !== totalAttendees) {
      return "Package attendees must equal Total attendees.";
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
    booking_type: "private_workshop",

    total_attendees: numberValue(workshopInfo.total_attendees || 0),

    standard_attendees: numberValue(standardPackage?.attendees || 0),
    premium_attendees: numberValue(premiumPackage?.attendees || 0),
    standard_price: numberValue(
      standardPackage?.price_per_person ||
        DEFAULT_PRIVATE_PACKAGES[0].price_per_person
    ),
    premium_price: numberValue(
      premiumPackage?.price_per_person ||
        DEFAULT_PRIVATE_PACKAGES[1].price_per_person
    ),

    package_attendees: packageBreakdown.map((item) => ({
      package_id: item.package_id,
      package_code: item.package_code,
      label: item.label,
      attendees: item.attendees,
      price_per_person: item.price_per_person,
      subtotal: item.subtotal,
    })),

    downpayment_percentage: numberValue(downpaymentPercentage),
    total_amount: totalAmount,
    due_now: dueNow,

    form_snapshot: {
      packages: safeArray(packages),
      package_attendees: packageBreakdown,
      downpayment_percentage: numberValue(downpaymentPercentage),
      total_amount: totalAmount,
      due_now: dueNow,
    },
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
                {blockReason && (
                  <div className="awb-small-note awb-center">{blockReason}</div>
                )}
              </>
            )}

            {error && <div className="awb-error">{error}</div>}

            {loading ? (
              <div className="awb-title">Loading private workshop booking…</div>
            ) : step === "review" ? (
              <>
                <div className="awb-title">
                  Please review your details carefully before confirmation.
                </div>

                <div className="awb-section-title">CONTACT INFORMATION</div>

                <ReviewRow label="Full Name" value={fixedInfo.full_name} />
                <ReviewRow label="Phone Number" value={fixedInfo.phone_number} />
                <ReviewRow label="Email Address" value={fixedInfo.email} />
                <ReviewRow
                  label="Contact Methods"
                  value={fixedInfo.contact_methods.join(", ")}
                />

                <div className="awb-section-title">BOOKING INFORMATION</div>

                <ReviewRow label="Date" value={date} />
                <ReviewRow label="Start Time" value={fixedInfo.start_time} />
                <ReviewRow label="End Time" value={fixedInfo.end_time} />
                <ReviewRow
                  label="Workshop Location"
                  value={fixedInfo.workshop_location}
                />
                <ReviewRow
                  label="Total Attendees"
                  value={workshopInfo.total_attendees}
                />

                {packageBreakdown.map((item) => (
                  <ReviewRow
                    key={item.key}
                    label={`${item.label} Attendees`}
                    value={item.attendees}
                  />
                ))}

                <ReviewRow
                  label="Other Request"
                  value={fixedInfo.other_request || "None"}
                />

                <div className="awb-summary">
                  {packageBreakdown.map((item) => (
                    <div className="awb-summary-row" key={item.key}>
                      <span className="awb-summary-label">
                        {item.attendees} {item.label} × ₱
                        {money(item.price_per_person)}
                      </span>
                      <span className="awb-summary-value">
                        ₱{money(item.subtotal)}
                      </span>
                    </div>
                  ))}

                  <div className="awb-summary-row awb-summary-total">
                    <span className="awb-summary-label">Total Amount</span>
                    <span className="awb-summary-value">₱{money(totalAmount)}</span>
                  </div>

                  <div className="awb-summary-row">
                    <span className="awb-summary-label">
                      Due Now ({downpaymentPercentage}%)
                    </span>
                    <span className="awb-summary-value">₱{money(dueNow)}</span>
                  </div>
                </div>

                <div className="awb-actions">
                  <button
                    type="button"
                    className="awb-btn awb-btn-secondary"
                    onClick={() => setStep("form")}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="awb-btn awb-btn-confirm"
                    onClick={handleConfirm}
                  >
                    Confirm and Pay
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="awb-title">Book your private workshop</div>

                <div className="awb-section-title">CONTACT INFORMATION</div>

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

                <div className="awb-field">
                  <div className="awb-label" id="awb-contact-methods-label">
                    Are you available to contact in the following:
                  </div>

                  <div className="awb-options" role="group" aria-labelledby="awb-contact-methods-label">
                    {CONTACT_METHODS.map((method) => (
                      <label className="awb-option" key={method.value}>
                        <input
                          type="checkbox"
                          aria-label={method.label}
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

                <div className="awb-section-title">BOOKING INFORMATION</div>

                <div className="awb-field">
                  <div className="awb-label" id="awb-workshop-time-label">
                    Event Time of Workshop
                  </div>

                  <div className="awb-two-col" role="group" aria-labelledby="awb-workshop-time-label">
                    <input
                      type="time"
                      aria-label="Workshop start time"
                      name="start_time"
                      value={fixedInfo.start_time}
                      onChange={handleFixedChange}
                    />

                    <input
                      type="time"
                      aria-label="Workshop end time"
                      name="end_time"
                      value={fixedInfo.end_time}
                      onChange={handleFixedChange}
                    />
                  </div>

                  <div className="awb-small-note">up to 4 hours operation</div>
                </div>

                <TextField
                  label="Workshop Location"
                  name="workshop_location"
                  value={fixedInfo.workshop_location}
                  onChange={handleFixedChange}
                />

                <div className="awb-section-title">ATTENDEES AND PACKAGES</div>

                <IntegerField
                  label="Total Number of Attendees"
                  name="total_attendees"
                  value={workshopInfo.total_attendees}
                  onChange={handleTotalAttendeesChange}
                />

                {packages.map((pkg) => {
                  const key = packageKey(pkg);

                  return (
                    <IntegerField
                      key={key}
                      label={`${pkg.label} Attendees — ₱${money(
                        pkg.price_per_person
                      )} each`}
                      name={`package_${key}`}
                      value={workshopInfo.package_attendees?.[key] || ""}
                      onChange={(e) =>
                        handlePackageAttendeesChange(key, e.target.value)
                      }
                    />
                  );
                })}

                <div className="awb-field">
                  <label className="awb-label" htmlFor="awb-other-request">Other Request</label>
                  <textarea
                    id="awb-other-request"
                    name="other_request"
                    aria-label="Other request"
                    value={fixedInfo.other_request}
                    onChange={handleFixedChange}
                  />
                </div>

                <div className="awb-summary">
                  {packageBreakdown.map((item) => (
                    <div className="awb-summary-row" key={item.key}>
                      <span className="awb-summary-label">
                        {item.attendees} {item.label} × ₱
                        {money(item.price_per_person)}
                      </span>
                      <span className="awb-summary-value">
                        ₱{money(item.subtotal)}
                      </span>
                    </div>
                  ))}

                  <div className="awb-summary-row awb-summary-total">
                    <span className="awb-summary-label">
                      Total Private Workshop Price
                    </span>
                    <span className="awb-summary-value">₱{money(totalAmount)}</span>
                  </div>

                  <div className="awb-summary-row">
                    <span className="awb-summary-label">
                      Due Now ({downpaymentPercentage}%)
                    </span>
                    <span className="awb-summary-value">₱{money(dueNow)}</span>
                  </div>

                  <div className="awb-small-note">
                    Package attendees entered: {packageAttendeesTotal} /{" "}
                    {numberValue(workshopInfo.total_attendees || 0)}
                  </div>
                </div>

                <div className="awb-actions">
                  <button
                    className="awb-btn awb-btn-confirm"
                    type="button"
                    onClick={handleNext}
                  >
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

function TextField({
  label,
  name,
  value,
  onChange,
  type = "text",
  readOnly = false,
}) {
  const inputId = `awb-${name}`;

  return (
    <div className="awb-field">
      <label className="awb-label" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type={type}
        aria-label={label}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    </div>
  );
}

function IntegerField({ label, name, value, onChange, readOnly = false }) {
  const inputId = `awb-${name}`;

  return (
    <div className="awb-field">
      <label className="awb-label" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="number"
        aria-label={label}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        min="0"
        step="1"
        inputMode="numeric"
        onKeyDown={(e) => {
          if ([".", ",", "e", "E", "-", "+"].includes(e.key)) {
            e.preventDefault();
          }
        }}
        onPaste={(e) => {
          const pastedText = e.clipboardData.getData("text");

          if (!/^\d+$/.test(pastedText)) {
            e.preventDefault();
          }
        }}
      />
    </div>
  );
}

function ReviewRow({ label, value }) {
  const inputId = `awb-review-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="awb-field">
      <label className="awb-label" htmlFor={inputId}>{label}</label>
      <input id={inputId} aria-label={label} value={value || ""} readOnly />
    </div>
  );
}