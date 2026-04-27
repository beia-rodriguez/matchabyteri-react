import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import "../assets/css/my-concerns.css";
import Navbar from "../components/Navbar";

export default function MyConcerns() {
  const navigate = useNavigate();
  const [concerns, setConcerns] = useState([]);

  useEffect(() => {
    API.get("/concerns/get-concerns.php")
      .then(res => setConcerns(res.data))
      .catch(err => {
        if (err.response?.status === 401) {
          navigate("/login?redirect=/my-concerns");
        }
      });
  }, [navigate]);

  const statusLabel = (s) => {
    if (s === "resolved") return "Resolved";
    if (s === "in_review") return "In Review";
    return "Pending";
  };

  return (
    <>
    <Navbar />

    <div className="wrap">
      <div className="title">My Concerns</div>

      <div className="card">
        <div className="sub">
          This page shows your submitted concerns and any replies from the admin team.
        </div>

        <div className="actions">
          <button className="btn btn-back" onClick={() => navigate("/profile")}>
            Back to Profile
          </button>
          <button className="btn btn-new" onClick={() => navigate("/report-concerns")}>
            Report a Concern
          </button>
        </div>

        {concerns.length === 0 ? (
          <div className="empty">
            You have not submitted any concerns yet.
          </div>
        ) : (
          <div className="list">
            {concerns.map(c => (
              <div key={c.id} className="item">
                <div className="top">
                  <div>
                    <div className="subject">{c.subject}</div>
                    <div className="meta">
                      Type: {c.concern_type}
                      {c.booking_id && <> • Booking ID: {c.booking_id}</>}
                      {" • Submitted: "}
                      {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className="badge">
                    {statusLabel(c.status)}
                  </span>
                </div>

                <div className="divider"></div>

                <details>
                  <summary className="meta" style={{ fontWeight: 900, cursor: "pointer" }}>
                    View details
                  </summary>
                  <div style={{ marginTop: 10 }} className="details">
                    {c.details}
                  </div>
                </details>

                {c.admin_response && (
                  <div className="reply-box">
                    <div className="reply-title">Admin Reply</div>
                    <div className="reply-text">{c.admin_response}</div>
                    {c.responded_at && (
                      <div className="reply-time">
                        Replied on: {new Date(c.responded_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}