import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/reminder.css";
import "../assets/css/universal.css";

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function readableText(text = "") {
  return String(text)
    .replace(/\s+/g, " ")
    .trim();
}

function getValidType(typeParam) {
  return ["event", "workshop", "both"].includes(typeParam) ? typeParam : "both";
}

function getFormTypeForNext(type) {
  return type === "workshop" ? "workshop" : "event";
}

export default function Reminder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const dateParam = searchParams.get("date");
  const typeParam = searchParams.get("type") || "both";
  const type = getValidType(typeParam);

  const [loadingForms, setLoadingForms] = useState(true);
  const [formInfo, setFormInfo] = useState({
    event: null,
    workshop: null,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!dateParam) {
      navigate("/calendar");
    }
  }, [dateParam, navigate]);

  useEffect(() => {
    if (!dateParam) return;

    let cancelled = false;

    const loadReminderFormInfo = async () => {
      setLoadingForms(true);
      setError("");

      const typesToLoad =
        type === "both" ? ["event", "workshop"] : [getFormTypeForNext(type)];

      try {
        const results = await Promise.all(
          typesToLoad.map(async (bookingType) => {
            try {
              const { data } = await API.get(
                "/bookings/get-active-booking-form.php",
                {
                  params: { type: bookingType },
                }
              );

              return [bookingType, data?.form || null];
            } catch {
              return [bookingType, null];
            }
          })
        );

        if (cancelled) return;

        setFormInfo((prev) => {
          const next = { ...prev };

          results.forEach(([bookingType, form]) => {
            next[bookingType] = form;
          });

          return next;
        });
      } catch {
        if (!cancelled) {
          setError("Failed to load booking reminder details.");
        }
      } finally {
        if (!cancelled) {
          setLoadingForms(false);
        }
      }
    };

    loadReminderFormInfo();

    return () => {
      cancelled = true;
    };
  }, [dateParam, type]);

  const activeForm = useMemo(() => {
    if (type === "workshop") return formInfo.workshop;
    if (type === "event") return formInfo.event;

    return formInfo.event || formInfo.workshop;
  }, [type, formInfo]);

  const downpaymentPercentage = useMemo(() => {
    const raw = Number(activeForm?.downpayment_percentage);

    if (Number.isFinite(raw) && raw > 0) {
      return raw;
    }

    return 50;
  }, [activeForm]);

  const baseRate = useMemo(() => {
    const raw = Number(activeForm?.base_rate);

    if (Number.isFinite(raw) && raw > 0) {
      return raw;
    }

    return 0;
  }, [activeForm]);

  useEffect(() => {
    const readableContent = document.getElementById("readable-content");

    if (!readableContent) return;

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
      "h1, h2, h3, h4, h5, h6, p, label, input, textarea, select, button, img, a, li, .reminder-title, .reminder-year, .reminder-note"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (
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
        textToRead =
          element.getAttribute("aria-label") ||
          element.placeholder ||
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
    dateParam,
    type,
    loadingForms,
    error,
    downpaymentPercentage,
    baseRate,
    activeForm,
  ]);

  if (!dateParam) return null;

  const dateObj = new Date(dateParam);
  const monthDay = dateObj.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const year = dateObj.getFullYear();

  const handleBack = () => {
    navigate(`/day?date=${dateParam}&type=${type}`);
  };

  const handleNext = () => {
    if (type === "workshop") {
      navigate(`/add-workshop-booking?date=${dateParam}&type=workshop`);
      return;
    }

    navigate(`/add-booking?date=${dateParam}&type=event`);
  };

  const bookingLabel =
    type === "workshop" ? "workshop booking" : type === "event" ? "event booking" : "booking";

  return (
    <>
      <Navbar />

      <div className="reminder-page" id="readable-content">
        <div className="reminder-top">
          <button type="button" className="back" aria-label="Back" onClick={handleBack}>
            <img src="/images/left-book.png" alt="" aria-hidden="true" />
          </button>

          <div className="reminder-title">{monthDay}</div>
          <div className="reminder-year">{year}</div>
        </div>

        <div className="panel">
          <div>
            <h2>Reminders!</h2>

            {error && (
              <p className="reminder-note" role="alert" aria-live="assertive">
                {error}
              </p>
            )}

            {loadingForms ? (
              <p className="reminder-note" role="status" aria-live="polite">
                Loading booking reminders…
              </p>
            ) : (
              <div className="bullets">
                <ul>
                  <li>Please book 2 weeks ahead of the {bookingLabel} date.</li>

                  <li>
                    The final quote will be provided after confirmation of the
                    venue and booking details.
                  </li>

                  {baseRate > 0 && (
                    <li>
                      This {bookingLabel} has a starting base booking rate of
                      ₱{money(baseRate)} before selected packages or add-ons.
                    </li>
                  )}

                  <li>
                    {money(downpaymentPercentage).replace(".00", "")}% deposit
                    is due upon booking confirmation. The remaining balance is
                    payable 2–3 days before the event.
                  </li>

                  <li>
                    Cancellations 7 days prior to the event are eligible for a
                    full deposit refund. Cancellations made less than 7 days
                    before the event will forfeit the deposit.
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="actions">
            <button type="button" className="btn-next" aria-label="Next" onClick={handleNext}>
              NEXT
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
