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

const ALLOWED_PURPOSES = ["event_booking", "workshop_booking", "workshop_public"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function GcashPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const purpose = (searchParams.get("purpose") || "").toLowerCase();
  const bookingId = parseInt(searchParams.get("booking_id") || "0", 10);
  const registrationId = parseInt(searchParams.get("registration_id") || "0", 10);

  const isPublicWorkshop = purpose === "workshop_public";

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [payerName, setPayerName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [proof, setProof] = useState(null);

  const [paymentData, setPaymentData] = useState(null);
  const [gcash, setGcash] = useState({
    number: "+639771277498",
    name: "J*A*T",
    qr: "/images/gcash-qr.jpg",
  });

  const paymentStatus = String(paymentData?.payment_status || "unpaid").toLowerCase();
  const [paymentChoice, setPaymentChoice] = useState("downpayment");

  useEffect(() => {
    const validPrivate = ["event_booking", "workshop_booking"].includes(purpose) && bookingId > 0;
    const validPublic = purpose === "workshop_public" && registrationId > 0;

    if (!ALLOWED_PURPOSES.includes(purpose) || (!validPrivate && !validPublic)) {
      navigate("/calendar");
      return;
    }

    loadPaymentInfo();
  }, [purpose, bookingId, registrationId, navigate]);

  useEffect(() => {
    if (isPublicWorkshop) {
      setPaymentChoice("full");
      return;
    }

    if (paymentStatus === "partial") {
      setPaymentChoice("remaining");
    } else {
      setPaymentChoice("downpayment");
    }
  }, [paymentStatus, isPublicWorkshop]);

  const paymentParams = useMemo(() => {
    if (isPublicWorkshop) {
      return {
        purpose,
        registration_id: registrationId,
      };
    }

    return {
      purpose,
      booking_id: bookingId,
    };
  }, [isPublicWorkshop, purpose, registrationId, bookingId]);

  const loadPaymentInfo = async () => {
    setLoading(true);
    setErr("");

    try {
      const { data } = await API.get("/payments/gcash-payment.php", {
        params: paymentParams,
      });

      if (!data.success) {
        setErr(data.error || "Failed to load payment details.");
        return;
      }

      setPaymentData(data.booking || data.registration);

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

  const totalAmount = useMemo(() => Number(paymentData?.total_amount || 0), [paymentData]);

  const downpaymentPercentage = useMemo(() => {
    if (isPublicWorkshop) return 100;

    const snapshotRaw = paymentData?.form_snapshot;
    if (!snapshotRaw) return 50;

    try {
      const snapshot =
        typeof snapshotRaw === "string" ? JSON.parse(snapshotRaw) : snapshotRaw;

      const percentage = Number(snapshot?.downpayment_percentage || 50);
      return percentage > 0 && percentage <= 100 ? percentage : 50;
    } catch {
      return 50;
    }
  }, [paymentData, isPublicWorkshop]);

  const downpaymentAmount = useMemo(() => {
    return Number((totalAmount * (downpaymentPercentage / 100)).toFixed(2));
  }, [totalAmount, downpaymentPercentage]);

  const remainingAmount = useMemo(() => {
    return Number((totalAmount - downpaymentAmount).toFixed(2));
  }, [totalAmount, downpaymentAmount]);

  const amountToPay = useMemo(() => {
    if (isPublicWorkshop) return totalAmount;
    if (paymentChoice === "full") return totalAmount;
    if (paymentChoice === "remaining") return remainingAmount;
    return downpaymentAmount;
  }, [isPublicWorkshop, paymentChoice, totalAmount, remainingAmount, downpaymentAmount]);

  const handleProofChange = (e) => {
    const file = e.target.files?.[0];
    setProof(null);
    setErr("");

    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErr("File must be 5MB or smaller.");
      e.target.value = "";
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErr("Invalid file type. Upload JPG, PNG, or WEBP only.");
      e.target.value = "";
      return;
    }

    setProof(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setErr("");

    if (!payerName.trim() || !referenceNo.trim() || !proof) {
      setErr("Please enter payer name, reference number, and upload proof.");
      return;
    }

    if (amountToPay <= 0) {
      setErr("Invalid payment amount.");
      return;
    }

    const formData = new FormData();
    formData.append("payer_name", payerName.trim());
    formData.append("reference_no", referenceNo.trim());
    formData.append("amount", amountToPay.toFixed(2));
    formData.append("payment_choice", paymentChoice);
    formData.append("proof", proof);

    setSubmitting(true);

    try {
      await API.post("/payments/gcash-payment.php", formData, {
        params: paymentParams,
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });

      alert("Payment submitted! Awaiting admin verification.");
      navigate(isPublicWorkshop ? "/public-workshops" : "/calendar");
    } catch (error) {
      setErr(error.response?.data?.error || "Payment submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const showInitialOptions =
    !isPublicWorkshop && (paymentStatus === "unpaid" || paymentStatus === "rejected");

  const showRemainingOnly = !isPublicWorkshop && paymentStatus === "partial";

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
                This payment is linked to{" "}
                {isPublicWorkshop
                  ? `public workshop registration #${registrationId}`
                  : `booking #${bookingId}`}
                .
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
                      <label>Total Amount</label>
                      <input value={`₱${money(totalAmount)}`} readOnly />
                    </div>

                    <div>
                      <label>Payment Status</label>
                      <input value={paymentStatus.toUpperCase()} readOnly />
                    </div>

                    <div>
                      <label>Payment Option</label>

                      <div style={{ display: "grid", gap: 8 }}>
                        {isPublicWorkshop && (
                          <label>
                            <input
                              type="radio"
                              name="payment_choice"
                              value="full"
                              checked
                              readOnly
                            />
                            Full Payment — ₱{money(totalAmount)}
                          </label>
                        )}

                        {showInitialOptions && (
                          <>
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
                          </>
                        )}

                        {showRemainingOnly && (
                          <label>
                            <input
                              type="radio"
                              name="payment_choice"
                              value="remaining"
                              checked
                              readOnly
                            />
                            Remaining Balance — ₱{money(remainingAmount)}
                          </label>
                        )}
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
                      <label htmlFor="proof">Upload Payment Proof</label>
                      <input
                        type="file"
                        id="proof"
                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                        onChange={handleProofChange}
                        required
                      />
                    </div>

                    <button className="btn" type="submit" disabled={submitting}>
                      {submitting ? "SUBMITTING..." : "SUBMIT PAYMENT PROOF"}
                    </button>

                    <div className="note">
                      Your payment will be marked <b>Pending</b> until admin verification.
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