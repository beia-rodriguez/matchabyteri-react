import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../assets/css/gcash-payment.css";
import API from "../services/api"; // your axios instance


export default function GcashPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const purpose = (searchParams.get("purpose") || "").toLowerCase();
  const bookingId = parseInt(searchParams.get("booking_id") || 0, 10);

  const [err, setErr] = useState("");
  const [payerName, setPayerName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [amount, setAmount] = useState("");
  const [proof, setProof] = useState(null);

  const GCASH_NUMBER = "+639771277498";
  const GCASH_NAME = "J*A*T";
  const GCASH_QR = "/pics/gcash-qr.jpg"; // public folder path

  // Validate booking_id & purpose
  useEffect(() => {
    if (!["event_booking", "workshop_booking", "workshop_public"].includes(purpose) || bookingId <= 0) {
      navigate("/calendar");
    }
  }, [purpose, bookingId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!payerName || !referenceNo || !amount || !proof) {
      setErr("Please enter payer name, reference number, amount, and upload proof.");
      return;
    }

    const formData = new FormData();
    formData.append("payer_name", payerName);
    formData.append("reference_no", referenceNo);
    formData.append("amount", amount);
    formData.append("proof", proof);

    try {
      const res = await API.post(
        `/payments/gcash-payment.php?purpose=${purpose}&booking_id=${bookingId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" }, withCredentials: true }
      );

      // PHP redirects, so we may get HTML. Instead, simulate redirect or show success message
      alert("Payment submitted! Awaiting verification.");
      navigate("/calendar"); // fallback redirect
    } catch (error) {
      setErr(error.response?.data?.error || "Payment submission failed.");
    }
  };

  return (
    <>
      <Navbar />
      <div className="wrap">
        <div className="card">
          <h1>Pay via GCash</h1>
          <div className="sub">This payment is linked to booking #{bookingId}.</div>

          {err && <div className="alert bad">{err}</div>}

          <div className="gcash-grid">
            <div>
              <div className="qr">
                <img src={GCASH_QR} alt="GCash QR" />
              </div>
              <div className="biz">
                GCash Number: {GCASH_NUMBER}
                <br />
                Initials/Name: {GCASH_NAME}
              </div>
            </div>

            <div>
              <form onSubmit={handleSubmit} encType="multipart/form-data">
                <div>
                  <label htmlFor="payer_name">Payer Name</label>
                  <input
                    type="text"
                    id="payer_name"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="reference_no">GCash Reference No.</label>
                  <input
                    type="text"
                    id="reference_no"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="amount">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    id="amount"
                    value={amount}
                    placeholder="0.00"
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="proof">Upload Payment Proof (screenshot)</label>
                  <input
                    type="file"
                    id="proof"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(e) => setProof(e.target.files[0])}
                    required
                  />
                </div>

                <button className="btn" type="submit">SUBMIT PAYMENT PROOF</button>

                <div className="note">
                  After submitting, your payment will be marked <b>Pending</b> for admin verification.
                </div>
              </form>

              <button className="back" onClick={() => navigate(-1)}>← Back</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}