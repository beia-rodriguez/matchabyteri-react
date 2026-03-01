import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../assets/css/reminder.css";
import { useEffect } from "react";

export default function Reminder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const dateParam = searchParams.get("date");
  const typeParam = searchParams.get("type") || "both";

  useEffect(() => {
  if (!dateParam) {
    navigate("/calendar");
  }
}, [dateParam, navigate]);

if (!dateParam) return null;


  const type = ["event", "workshop", "both"].includes(typeParam)
    ? typeParam
    : "both";

  const dateObj = new Date(dateParam);
  const monthDay = dateObj.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric"
  });
  const year = dateObj.getFullYear();

  const handleBack = () => {
    navigate(`/day?date=${dateParam}&type=${type}`);
  };

  const handleNext = () => {
    if (type === "workshop") {
      navigate(`/add-workshop-booking?date=${dateParam}&type=workshop`);
    } else {
      navigate(`/add-booking?date=${dateParam}&type=event`);
    }
  };

  return (
    <>
      <Navbar />

      <div className="reminder-page">
        <div className="reminder-top">
          <button className="back" onClick={handleBack}>
            <img src="/images/left-book.png" alt="Back" />
          </button>

          <div className="reminder-title">{monthDay}</div>
          <div className="reminder-year">{year}</div>
        </div>

        <div className="panel">
          <div>
            <h2>Reminders!</h2>

            <div className="bullets">
              <ul>
                <li>Please book 2 weeks ahead of the event date</li>
                <li>
                  The final quote will be provided after confirmation of the
                  venue
                </li>
                <li>
                  50% deposit is due upon booking confirmation. Remaining
                  balance is payable 2–3 days before the event
                </li>
                <li>
                  Cancellations 7 days prior the event are eligible for a full
                  deposit refund. Cancellations in less than 7 days will
                  forfeit the deposit.
                </li>
              </ul>
            </div>
          </div>

          <div className="actions">
            <button className="btn-next" onClick={handleNext}>
              NEXT
            </button>
          </div>
        </div>
      </div>
    </>
  );
}