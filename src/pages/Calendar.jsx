import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/calendar.css";
import "../assets/css/universal.css";

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

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const pad = (n) => String(n).padStart(2, "0");

  const ymd = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const startOfToday = () => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  };

  const formatDateOnly = (date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const formatDayOnly = (date) => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
    }).format(date);
  };

  const getCellLabel = (date, isPast, info, isOutsideMonth = false) => {
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

    if (info?.status === "OPEN" && info.count > 0) {
      return `${readableDate}. Available. ${info.count} out of ${info.max} booked. ${readableDay}.`;
    }

    return `${readableDate}. Available. ${readableDay}.`;
  };

  useEffect(() => {
    API.get("/calendar/calendar_status.php", {
      params: {
        year: view.getFullYear(),
        month: view.getMonth() + 1,
        type: bookingType,
      },
    })
      .then((res) => setMonthStatus(res.data))
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate("/login?redirect=/calendar");
        }
      });
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
      "button, img, .cell"
    );

    readableElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (tagName !== "button") {
        element.removeAttribute("tabindex");
      }

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

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", textToRead.trim());
      }
    });
  }, [view, monthStatus, bookingType]);

  const renderCells = () => {
    const y = view.getFullYear();
    const m = view.getMonth();

    const first = new Date(y, m, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const totalCells = 42;
    let dayNum = 1;
    const today0 = startOfToday();
    const cells = [];

    for (let i = 0; i < totalCells; i++) {
      if (i < startDay) {
        const prevMonthDate = new Date(y, m, 1 - (startDay - i));
        prevMonthDate.setHours(0, 0, 0, 0);

        const isPast = prevMonthDate < today0;

        cells.push(
          <div
            key={i}
            className="cell is-empty"
            role="button"
            aria-disabled="true"
            aria-label={getCellLabel(prevMonthDate, isPast, null, true)}
          />
        );

        continue;
      }

      if (dayNum > daysInMonth) {
        const nextMonthDay = dayNum - daysInMonth;
        const nextMonthDate = new Date(y, m + 1, nextMonthDay);
        nextMonthDate.setHours(0, 0, 0, 0);

        const isPast = nextMonthDate < today0;

        cells.push(
          <div
            key={i}
            className="cell is-empty"
            role="button"
            aria-disabled="true"
            aria-label={getCellLabel(nextMonthDate, isPast, null, true)}
          />
        );

        dayNum++;
        continue;
      }

      const d = new Date(y, m, dayNum);
      d.setHours(0, 0, 0, 0);
      const key = ymd(d);

      const isPast = d < today0;
      const info = monthStatus[key];

      let className = "cell";
      if (isPast) className += " is-past";
      if (info && (info.status === "BLOCKED" || info.status === "FULL")) {
        className += " is-disabled";
      }

      const handleClick = async () => {
        if (isPast) return;
        if (info && (info.status === "BLOCKED" || info.status === "FULL")) return;

        try {
          await API.get("/auth/check-auth.php");
          navigate(`/day?date=${key}&type=${bookingType}`);
        } catch (err) {
          navigate(
            `/login?redirect=${encodeURIComponent(
              `/day?date=${key}&type=${bookingType}`
            )}`
          );
        }
      };

      const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      };

      cells.push(
        <div
          key={i}
          className={className}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="button"
          aria-label={getCellLabel(d, isPast, info)}
          aria-disabled={
            isPast || (info && (info.status === "BLOCKED" || info.status === "FULL"))
              ? "true"
              : "false"
          }
        >
          <div className="num">{dayNum}</div>

          {info?.status === "BLOCKED" && (
            <>
              {info.reason && <div className="reason">{info.reason}</div>}
              <div className="badge" aria-label="Unavailable">
                UNAVAILABLE
              </div>
            </>
          )}

          {info?.status === "FULL" && (
            <>
              {info.reason && <div className="reason">{info.reason}</div>}
              <div className="badge" aria-label="Fully booked">
                FULLY BOOKED
              </div>
            </>
          )}

          {info?.status === "OPEN" && info.count > 0 && (
            <div
              className="slots"
              aria-label={`${info.count} out of ${info.max} booked`}
            >
              {info.count}/{info.max} booked
            </div>
          )}
        </div>
      );

      dayNum++;
    }

    return cells;
  };

  return (
    <>
      <Navbar />

      <div className="cal-page" id="readable-content">
        <div className="cal-top">
          <button
            className="nav-btn"
            aria-label="Previous month"
            onClick={() =>
              setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
            }
          >
            <img src="/images/left-book.png" alt="" aria-hidden="true" />
          </button>

          <div className="month-title">
            {monthNames[view.getMonth()]}
          </div>

          <div className="year-title">
            {view.getFullYear()}
          </div>

          <button
            className="nav-btn"
            aria-label="Next month"
            onClick={() =>
              setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
            }
          >
            <img src="/images/right-book.png" alt="" aria-hidden="true" />
          </button>
        </div>

        <div className="cal-wrap">
          <div className="cal">
            <div className="dow">
              <div>SUN</div>
              <div>MON</div>
              <div>TUE</div>
              <div>WED</div>
              <div>THU</div>
              <div>FRI</div>
              <div>SAT</div>
            </div>

            <div className="grid">
              {renderCells()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}