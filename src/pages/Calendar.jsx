import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import API from "../services/api";
import "../assets/css/calendar.css";

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
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const pad = (n) => String(n).padStart(2, "0");

  const ymd = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;

  const startOfToday = () => {
    const t = new Date();
    t.setHours(0,0,0,0);
    return t;
  };

  useEffect(() => {
    API.get("/calendar/calendar_status.php", {
      params: {
        year: view.getFullYear(),
        month: view.getMonth() + 1,
        type: bookingType
      }
    })
      .then(res => setMonthStatus(res.data))
      .catch(err => {
        if (err.response?.status === 401) {
          navigate("/login?redirect=/calendar");
        }
      });
  }, [view, bookingType, navigate]);

  const renderCells = () => {
    const y = view.getFullYear();
    const m = view.getMonth();

    const first = new Date(y, m, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();

    const totalCells = 42;
    let dayNum = 1;
    const today0 = startOfToday();
    const cells = [];

    for(let i=0;i<totalCells;i++){

      if(i < startDay || dayNum > daysInMonth){
        cells.push(<div key={i} className="cell is-empty" />);
        continue;
      }

      const d = new Date(y, m, dayNum);
      d.setHours(0,0,0,0);
      const key = ymd(d);

      const isPast = d < today0;
      const info = monthStatus[key];

      let className = "cell";
      if(isPast) className += " is-past";
      if(info && (info.status === "BLOCKED" || info.status === "FULL"))
        className += " is-disabled";

      const handleClick = async () => {
        if (isPast) return;
        if (info && (info.status === "BLOCKED" || info.status === "FULL")) return;

        try {
          await API.get("/auth/check-auth.php");

          // ✅ If logged in → go to Day page
          navigate(`/day?date=${key}&type=${bookingType}`);

        } catch (err) {
          // ❌ If not logged in → go to Login
          navigate(
  `/login?redirect=${encodeURIComponent(`/day?date=${key}&type=${bookingType}`)}`
);
        }
      };

      cells.push(
        <div key={i} className={className} onClick={handleClick}>
          <div className="num">{dayNum}</div>

          {info?.status === "BLOCKED" && (
            <>
              {info.reason && <div className="reason">{info.reason}</div>}
              <div className="badge">UNAVAILABLE</div>
            </>
          )}

          {info?.status === "FULL" && (
            <>
              {info.reason && <div className="reason">{info.reason}</div>}
              <div className="badge">FULLY BOOKED</div>
            </>
          )}

          {info?.status === "OPEN" && info.count > 0 && (
            <div className="slots">
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

      <div className="cal-page">
        <div className="cal-top">
          <button
            className="nav-btn"
            onClick={() =>
              setView(new Date(view.getFullYear(), view.getMonth()-1, 1))
            }
          >
            <img src="/images/left-book.png" alt="Previous" />
          </button>

          <div className="month-title">
            {monthNames[view.getMonth()]}
          </div>

          <div className="year-title">
            {view.getFullYear()}
          </div>

          <button
            className="nav-btn"
            onClick={() =>
              setView(new Date(view.getFullYear(), view.getMonth()+1, 1))
            }
          >
            <img src="/images/right-book.png" alt="Next" />
          </button>
        </div>

        <div className="cal-wrap">
          <div className="cal">
            <div className="dow">
              <div>SUN</div><div>MON</div><div>TUE</div>
              <div>WED</div><div>THU</div><div>FRI</div><div>SAT</div>
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