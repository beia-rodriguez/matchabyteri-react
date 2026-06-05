import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/calendar.css";
import "../assets/css/universal.css";


const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function formatDateOnly(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDayOnly(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  }).format(date);
}

function getCellLabel(date, isPast, info, isOutsideMonth = false) {
  const readableDate = formatDateOnly(date);
  const readableDay = formatDayOnly(date);

  if (isOutsideMonth) {
    return `${readableDate}. Outside current month. ${readableDay}.`;
  }

  if (isPast) {
    return `${readableDate}. Past day. ${readableDay}.`;
  }

  if (info?.status === "BLOCKED") {
    return `${readableDate}. Unavailable.${
      info.reason ? ` Reason: ${info.reason}.` : ""
    } ${readableDay}.`;
  }

  if (info?.status === "FULL") {
    return `${readableDate}. Fully booked.${
      info.reason ? ` Reason: ${info.reason}.` : ""
    } ${readableDay}.`;
  }

  if (info?.status === "OPEN" && Number(info.count) > 0) {
    return `${readableDate}. Available. ${info.count} out of ${info.max} booked. ${readableDay}.`;
  }

  return `${readableDate}. Available. ${readableDay}.`;
}

function CalendarCells({ view, monthStatus, bookingType, navigate }) {
  const year = view.getFullYear();
  const month = view.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const totalCells = 42;
  const today = startOfToday();
  const cells = [];

  let dayNum = 1;

  for (let index = 0; index < totalCells; index += 1) {
    if (index < startDay) {
      cells.push(
        <div
          key={`previous-${index}`}
          className="cal-cell cal-cell-empty"
          aria-hidden="true"
        />
      );

      continue;
    }

    if (dayNum > daysInMonth) {
      cells.push(
        <div
          key={`next-${index}`}
          className="cal-cell cal-cell-empty"
          aria-hidden="true"
        />
      );

      dayNum += 1;
      continue;
    }

    const date = new Date(year, month, dayNum);
    date.setHours(0, 0, 0, 0);

    const dateKey = ymd(date);
    const isPast = date < today;
    const info = monthStatus[dateKey];

    const isBlocked = info?.status === "BLOCKED";
    const isFull = info?.status === "FULL";
    const isDisabled = isPast || isBlocked || isFull;

    const hasMeta =
      isBlocked ||
      isFull ||
      (info?.status === "OPEN" && Number(info.count) > 0);

    let className = "cal-cell";

    if (isPast) className += " is-past";
    if (isBlocked || isFull) className += " is-disabled";
    if (!isDisabled) className += " is-open";
    if (hasMeta) className += " has-meta";

    const handleClick = async () => {
      if (isDisabled) return;

      try {
        await API.get("/auth/check-auth.php");
        navigate(`/day?date=${dateKey}&type=${bookingType}`);
      } catch (err) {
        navigate(
          `/login?redirect=${encodeURIComponent(
            `/day?date=${dateKey}&type=${bookingType}`
          )}`
        );
      }
    };

    cells.push(
      <button
        key={dateKey}
        type="button"
        className={className}
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={getCellLabel(date, isPast, info)}
      >
        <span className="cal-num">{dayNum}</span>

        <span className="cal-meta">
          {isBlocked && info?.reason && (
            <span className="cal-reason">{info.reason}</span>
          )}

          {isBlocked && <span className="cal-badge">Unavailable</span>}

          {isFull && info?.reason && (
            <span className="cal-reason">{info.reason}</span>
          )}

          {isFull && <span className="cal-badge">Fully Booked</span>}

          {info?.status === "OPEN" && Number(info.count) > 0 && (
            <span
              className="cal-slots"
              aria-label={`${info.count} out of ${info.max} booked`}
            >
              {info.count}/{info.max} booked
            </span>
          )}
        </span>
      </button>
    );

    dayNum += 1;
  }

  return cells;
}

export default function Calendar() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const typeParam = searchParams.get("type");
  const bookingType =
    typeParam && ["event", "workshop", "both"].includes(typeParam)
      ? typeParam
      : "both";

  const [view, setView] = useState(new Date());
  const [monthStatus, setMonthStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const goToPreviousMonth = () => {
    setView((current) => {
      return new Date(current.getFullYear(), current.getMonth() - 1, 1);
    });
  };

  const goToNextMonth = () => {
    setView((current) => {
      return new Date(current.getFullYear(), current.getMonth() + 1, 1);
    });
  };

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError("");

    API.get("/calendar/calendar_status.php", {
      params: {
        year: view.getFullYear(),
        month: view.getMonth() + 1,
        type: bookingType,
      },
    })
      .then((res) => {
        if (!isMounted) return;
        setMonthStatus(res.data || {});
      })
      .catch((err) => {
        if (!isMounted) return;

        if (err.response?.status === 401) {
          navigate("/login?redirect=/calendar");
          return;
        }

        setMonthStatus({});
        setError("Sorry, calendar availability could not be loaded.");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [view, bookingType, navigate]);

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
      "button, img, .voice-readable"
    );

    readableElements.forEach((element) => {
      if (element.closest(".accessibility-bubble-wrapper")) return;

      const tagName = element.tagName.toLowerCase();

      if (!isVisible(element)) return;

      let textToRead = "";

      if (tagName === "img") {
        textToRead = element.getAttribute("alt") || "";
      } else {
        textToRead =
          element.getAttribute("aria-label") ||
          element.innerText ||
          element.textContent ||
          "";
      }

      if (!textToRead.trim()) return;

      if (tagName !== "button") {
        element.setAttribute("tabindex", "0");
      }

      element.classList.add("voice-readable");

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", textToRead.trim());
      }
    });
  }, [view, monthStatus, bookingType, loading, error]);


  return (
    <>
      <Navbar />

      <main
        className="cal-page"
        id="readable-content"
        aria-label="Booking calendar page"
      >
        <section className="cal-top" aria-label="Calendar month navigation">
          <button
            type="button"
            className="nav-btn cal-prev-btn"
            aria-label="Previous month"
            onClick={goToPreviousMonth}
          >
            <img src="/images/left-book.png" alt="" aria-hidden="true" />
          </button>

          <h1
            className="month-title voice-readable"
            tabIndex="0"
            aria-label={`Month ${MONTH_NAMES[view.getMonth()]}`}
          >
            {MONTH_NAMES[view.getMonth()]}
          </h1>

          <div
            className="year-title voice-readable"
            tabIndex="0"
            aria-label={`Year ${view.getFullYear()}`}
          >
            {view.getFullYear()}
          </div>

          <button
            type="button"
            className="nav-btn cal-next-btn"
            aria-label="Next month"
            onClick={goToNextMonth}
          >
            <img src="/images/right-book.png" alt="" aria-hidden="true" />
          </button>
        </section>

        {loading && (
          <div
            className="cal-alert voice-readable"
            role="status"
            tabIndex="0"
            aria-label="Loading calendar availability"
          >
            Loading calendar availability...
          </div>
        )}

        {error && (
          <div
            className="cal-alert cal-alert-error voice-readable"
            role="alert"
            tabIndex="0"
            aria-label={error}
          >
            {error}
          </div>
        )}

        <section className="cal-wrap" aria-label="Calendar">
          <div className="cal">
            <div className="cal-dow" aria-hidden="true">
              <div>SUN</div>
              <div>MON</div>
              <div>TUE</div>
              <div>WED</div>
              <div>THU</div>
              <div>FRI</div>
              <div>SAT</div>
            </div>

            <div className="cal-grid"><CalendarCells view={view} monthStatus={monthStatus} bookingType={bookingType} navigate={navigate} /></div>
          </div>
        </section>
      </main>
    </>
  );
}