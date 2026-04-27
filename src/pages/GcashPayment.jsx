import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../assets/css/gcash-payment.css";
import API from "../services/api";

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function GcashPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const purpose = (searchParams.get("purpose") || "").toLowerCase();
  const bookingId = parseInt(searchParams.get("booking_id") || 0, 10);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [payerName, setPayerName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [proof, setProof] = useState(null);

  const [booking, setBooking] = useState(null);
  const [gcash, setGcash] = useState({
    number: "+639771277498",
    name: "J*A*T",
    qr: "/images/gcash-qr.jpg",
  });

  const [paymentChoice, setPaymentChoice] = useState("downpayment");

  useEffect(() => {
    if (
      !["event_booking", "workshop_booking", "workshop_public"].includes(purpose) ||
      bookingId <= 0
    ) {
      navigate("/calendar");
      return;
    }

    loadPaymentInfo();
  }, [purpose, bookingId, navigate]);

  const loadPaymentInfo = async () => {
    setLoading(true);
    setErr("");

    try {
      const { data } = await API.get(
        `/payments/gcash-payment.php?purpose=${purpose}&booking_id=${bookingId}`
      );

      if (!data.success) {
        setErr(data.error || "Failed to load payment details.");
        return;
      }

      setBooking(data.booking);

      setGcash({
        number: data.gcash_number || "+639771277498",
        name: data.gcash_name || "J*A*T",
        qr: data.gcash_qr?.startsWith("/")
          ? data.gcash_qr
          : `/${data.gcash_qr || "images/gcash-qr.jpg"}`,
      });
    } catch (error) {
      setErr(error.response?.data?.error || "Failed to load payment details.");
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = useMemo(() => {
    return Number(booking?.total_amount || 0);
  }, [booking]);

  const downpaymentPercentage = useMemo(() => {
    const snapshotRaw = booking?.form_snapshot;

    if (!snapshotRaw) return 50;

    try {
      const snapshot =
        typeof snapshotRaw === "string" ? JSON.parse(snapshotRaw) : snapshotRaw;

      return Number(snapshot?.downpayment_percentage || 50);
    } catch {
      return 50;
    }
  }, [booking]);

  const downpaymentAmount = useMemo(() => {
    return totalAmount * (downpaymentPercentage / 100);
  }, [totalAmount, downpaymentPercentage]);

  const amountToPay = useMemo(() => {
    return paymentChoice === "full" ? totalAmount : downpaymentAmount;
  }, [paymentChoice, totalAmount, downpaymentAmount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!payerName || !referenceNo || !proof) {
      setErr("Please enter payer name, reference number, and upload proof.");
      return;
    }

    if (amountToPay <= 0) {
      setErr("Invalid payment amount.");
      return;
    }

    const formData = new FormData();
    formData.append("payer_name", payerName);
    formData.append("reference_no", referenceNo);
    formData.append("amount", amountToPay.toFixed(2));
    formData.append("payment_choice", paymentChoice);
    formData.append("proof", proof);

    try {
      await API.post(
        `/payments/gcash-payment.php?purpose=${purpose}&booking_id=${bookingId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        }
      );

      alert("Payment submitted! Awaiting admin verification.");
      navigate("/calendar");
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

          {loading ? (
            <div className="sub">Loading payment details...</div>
          ) : (
            <>
              <div className="sub">
                This payment is linked to booking #{bookingId}.
              </div>

              {err && <div className="alert bad">{err}</div>}

              <div className="gcash-grid">
                <div>
                  <div className="qr">
                    <img src={gcash.qr} alt="GCash QR" />
                  </div>

                  <div className="biz">
                    GCash Number: {gcash.number}
                    <br />
                    Initials/Name: {gcash.name}
                  </div>
                </div>

                <div>
                  <form onSubmit={handleSubmit} encType="multipart/form-data">
                    <div>
                      <label>Total Booking Amount</label>
                      <input value={`₱${money(totalAmount)}`} readOnly />
                    </div>

                    <div>
                      <label>Payment Option</label>

                      <div style={{ display: "grid", gap: 8 }}>
                        <label>
                          <input
                            type="radio"
                            name="payment_choice"
                            value="downpayment"
                            checked={paymentChoice === "downpayment"}
                            onChange={() => setPaymentChoice("downpayment")}
                          />
                          Downpayment ({money(downpaymentPercentage)}%) — ₱
                          {money(downpaymentAmount)}
                        </label>

                        <label>
                          <input
                            type="radio"
                            name="payment_choice"
                            value="full"
                            checked={paymentChoice === "full"}
                            onChange={() => setPaymentChoice("full")}
                          />
                          Full Payment — ₱{money(totalAmount)}
                        </label>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="amount">Amount to Pay</label>
                      <input
                        type="text"
                        id="amount"
                        value={`₱${money(amountToPay)}`}
                        readOnly
                      />
                    </div>

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
                      <label htmlFor="proof">
                        Upload Payment Proof (screenshot)
                      </label>
                      <input
                        type="file"
                        id="proof"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={(e) => setProof(e.target.files[0])}
                        required
                      />
                    </div>

                    <button className="btn" type="submit">
                      SUBMIT PAYMENT PROOF
                    </button>

                    <div className="note">
                      Your payment will be marked <b>Pending</b> until admin
                      verification.
                    </div>
                  </form>

                  <button className="back" onClick={() => navigate(-1)}>
                    ← Back
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}