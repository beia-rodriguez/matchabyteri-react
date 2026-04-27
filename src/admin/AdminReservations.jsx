import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

export default function AdminReservations() {
  const [csrf, setCsrf] = useState("");
  const [pending, setPending] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadData = async () => {
    try {
      const { data } = await adminApi.get("/admin/admin-reservations.php");
      setCsrf(data.csrf || "");
      setPending(data.pending || []);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load reservations.");
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleStatus = async (bookingId, newStatus) => {
    if (newStatus === "cancelled" && !window.confirm("Cancel this booking?")) return;

    try {
      const { data } = await adminApi.post("/admin/admin-reservations.php", {
        action: "set_status",
        csrf_token: csrf,
        booking_id: bookingId,
        new_status: newStatus,
      });
      if (data.error) setErr(data.error);
      else {
        setMsg(data.message || "Booking updated.");
        loadData();
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update booking.");
    }
  };

  return (
    <AdminLayout title="Reservations">
      {msg ? <div className="admin-notice-react ok">{msg}</div> : null}
      {err ? <div className="admin-notice-react bad">{err}</div> : null}

      <div className="admin-panel-react">
        <h3>Pending Reservations</h3>

        {pending.length === 0 ? (
          <div className="admin-muted-react">No pending bookings.</div>
        ) : (
          <table className="admin-table-react">
            <thead>
              <tr><th>ID</th><th>Date</th><th>Type</th><th>Customer</th><th>Email</th><th>Time</th><th>Details</th><th>Action</th></tr>
            </thead>
            <tbody>
              {pending.map((p) => {
                const notes = p.notes_decoded || {};
                let detail = "—";
                if (String(p.booking_type).toLowerCase() === "workshop") detail = notes.workshop_type || notes.package || "Workshop";
                else if (String(p.booking_type).toLowerCase() === "event") detail = notes.event_name || notes.event_type || "Event";
                else detail = notes.purpose || "Custom";

                const time = p.start_time && p.end_time ? `${p.start_time} - ${p.end_time}` : "";

                return (
                  <tr key={p.id}>
                    <td>#{Number(p.id)}</td>
                    <td>{p.booking_date}</td>
                    <td>{p.booking_type}</td>
                    <td>{p.user_name || "Guest"}</td>
                    <td>{p.user_email || ""}</td>
                    <td>{time}</td>
                    <td>{detail}</td>
                    <td>
                      <div className="admin-row-actions-react">
                        <button className="admin-btn-react admin-btn-approve-react" type="button" onClick={() => handleStatus(p.id, "approved")}>APPROVE</button>
                        <button className="admin-btn-react admin-btn-cancel-react" type="button" onClick={() => handleStatus(p.id, "cancelled")}>CANCEL</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}