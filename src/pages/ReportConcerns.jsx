import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../services/api";
import "../assets/css/report-concerns.css";
import Navbar from "../components/Navbar";

export default function ReportConcerns() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    concern_type: "Booking Issue",
    booking_id: searchParams.get("booking_id") || "",
    subject: "",
    details: ""
  });

  const [error, setError] = useState("");

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");

    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));

    const res = await API.post("/concerns/submit-concern.php", formData);

    if (res.data.error) {
      setError(res.data.error);
    } else {
      navigate("/my-concerns");
    }
  };

  return (
    <>
    <Navbar />
    <div className="wrap">
      <div className="title">Report Concerns</div>

      <div className="card">
        <div className="sub">
          Use this form to report concerns regarding your bookings or an error within the website.
        </div>

        {error && (
          <div className="alerts">
            <div className="alert bad">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <div className="field">
            <label>Concern Type</label>
            <select name="concern_type" value={form.concern_type} onChange={handleChange}>
              <option>Booking Issue</option>
              <option>Website Error</option>
              <option>Payment Issue</option>
              <option>Other</option>
            </select>
            <div className="hint">Choose the category that best matches your concern.</div>
          </div>

          <div className="field">
            <label>Booking ID (optional)</label>
            <input
              type="number"
              name="booking_id"
              value={form.booking_id}
              onChange={handleChange}
              min="1"
            />
            <div className="hint">If your concern is about a booking, include the Booking ID if available.</div>
          </div>

          <div className="field full">
            <label>Subject</label>
            <input
              type="text"
              name="subject"
              value={form.subject}
              onChange={handleChange}
              maxLength="150"
              required
            />
          </div>

          <div className="field full">
            <label>Details</label>
            <textarea
              name="details"
              value={form.details}
              onChange={handleChange}
              required
            />
            <div className="hint">
              Please include important details.
            </div>
          </div>

          <div className="actions full">
            <button type="button" className="btn btn-back" onClick={() => navigate("/profile")}>
              Back to Profile
            </button>

            <button type="submit" className="btn btn-submit">
              Submit Concern
            </button>
          </div>

        </form>

      </div>
    </div>
    </>
  );
}