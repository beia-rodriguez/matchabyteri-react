import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../assets/css/gcash-payment.css";
import API from "../services/api";

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percent(value) {
  const n = Number(value || 0);

  if (!Number.isFinite(n)) {
    return "0";
  }

  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function digitsForReader(value = "") {
  return String(value)
    .replace(/\D/g, "")
    .split("")
    .join(" ");
}

function getSafeStatusClass(status = "") {
  return String(status)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");
}

function normalizePurpose(value = "") {
  const purpose = String(value || "").toLowerCase().trim();

  if (purpose === "workshop_booking") return "private_workshop";
  if (purpose === "workshop_public") return "workshop_registration";

  return purpose;
}

const ALLOWED_PURPOSES = [
  "event_booking",
  "private_workshop",
  "workshop_registration",

  // old URL compatibility
  "workshop_booking",
  "workshop_public",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function GcashPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawPurpose = (searchParams.get("purpose") || "").toLowerCase();
  const purpose = normalizePurpose(rawPurpose);

  const bookingId = parseInt(searchParams.get("booking_id") || "0", 10);
  const registrationId = parseInt(
    searchParams.get("registration_id") || "0",
    10
  );

  const isPublicWorkshop = purpose === "workshop_registration";
  const isPrivateBooking =
    purpose === "event_booking" || purpose === "private_workshop";

  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [payerName, setPayerName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [proof, setProof] = useState(null);

  const [paymentResponse, setPaymentResponse] = useState(null);

  const loading = !paymentResponse && !err;

  const paymentData = useMemo(() => {
    return paymentResponse?.booking || paymentResponse?.registration || null;
  }, [paymentResponse]);

  const gcash = useMemo(() => {
    const qrPath = paymentResponse?.gcash_qr || "images/gcash-qr.jpg";

    return {
      number: paymentResponse?.gcash_number || "+639771277498",
      name: paymentResponse?.gcash_name || "J*A*T",
      qr: String(qrPath).startsWith("/") ? qrPath : `/${qrPath}`,
    };
  }, [paymentResponse]);

  const paymentStatus = String(
    paymentData?.payment_status || "unpaid"
  ).toLowerCase();

  const safePaymentStatusClass = getSafeStatusClass(paymentStatus);

  const [paymentChoice, setPaymentChoice] = useState("downpayment");

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

  const loadPaymentInfo = useCallback(async () => {
    setPaymentResponse(null);
    setErr("");

    try {
      const res = await API.get("/payments/gcash-payment.php", {
        params: paymentParams,
      });

      if (!res.data.success) {
        setErr(res.data.error || "Failed to load payment details.");
        return;
      }

      const nextPaymentData = res.data.booking || res.data.registration || null;

      if (!nextPaymentData) {
        setErr("Payment record was not found.");
        return;
      }

      setPaymentResponse(res.data);
    } catch (error) {
      setErr(error.response?.data?.error || "Failed to load payment details.");
    }
  }, [paymentParams]);

  useEffect(() => {
    const validPrivate = isPrivateBooking && bookingId > 0;
    const validPublic = isPublicWorkshop && registrationId > 0;

    if (
      !ALLOWED_PURPOSES.includes(rawPurpose) ||
      (!validPrivate && !validPublic)
    ) {
      navigate("/calendar");
      return;
    }

    loadPaymentInfo();
  }, [
    rawPurpose,
    bookingId,
    registrationId,
    isPrivateBooking,
    isPublicWorkshop,
    loadPaymentInfo,
    navigate,
  ]);

  const effectivePaymentChoice = useMemo(() => {
    if (isPublicWorkshop) return "full";
    if (paymentStatus === "partial") return "remaining";
    return paymentChoice;
  }, [isPublicWorkshop, paymentStatus, paymentChoice]);

  const totalAmount = useMemo(() => {
    return Number(paymentData?.total_amount || 0);
  }, [paymentData]);

  const amountPaid = useMemo(() => {
    return Number(paymentData?.amount_paid || 0);
  }, [paymentData]);

  const downpaymentPercentage = useMemo(() => {
    if (isPublicWorkshop) return 100;

    const fromApi = Number(paymentData?.downpayment_percentage || 0);

    if (fromApi > 0 && fromApi <= 100) {
      return fromApi;
    }

    return 50;
  }, [paymentData, isPublicWorkshop]);

  const downpaymentAmount = useMemo(() => {
    const fromApi = Number(paymentData?.downpayment_amount || 0);

    if (fromApi > 0) {
      return Number(fromApi.toFixed(2));
    }

    return Number((totalAmount * (downpaymentPercentage / 100)).toFixed(2));
  }, [paymentData, totalAmount, downpaymentPercentage]);

  const remainingAmount = useMemo(() => {
    const fromApi = Number(paymentData?.remaining_amount || 0);

    if (fromApi > 0) {
      return Number(fromApi.toFixed(2));
    }

    return Number(Math.max(0, totalAmount - amountPaid).toFixed(2));
  }, [paymentData, totalAmount, amountPaid]);

  const amountToPay = useMemo(() => {
    if (effectivePaymentChoice === "full") return totalAmount;
    if (effectivePaymentChoice === "remaining") return remainingAmount;

    return downpaymentAmount;
  }, [effectivePaymentChoice, totalAmount, remainingAmount, downpaymentAmount]);

  const showInitialOptions =
    !isPublicWorkshop &&
    (paymentStatus === "unpaid" || paymentStatus === "rejected");

  const showRemainingOnly = !isPublicWorkshop && paymentStatus === "partial";

  const readableLinkedRecord = isPublicWorkshop
    ? `public workshop registration number ${digitsForReader(registrationId)}`
    : `booking number ${digitsForReader(bookingId)}`;

  const readableGcashNumber = digitsForReader(gcash.number);
  const readableTotalAmount = `Total amount is ${money(totalAmount)} pesos.`;
  const readableAmountToPay = `Amount to pay is ${money(amountToPay)} pesos.`;

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
    formData.append("payment_choice", effectivePaymentChoice);
    formData.append("proof", proof);

    setSubmitting(true);

    try {
      await API.post("/payments/gcash-payment.php", formData, {
        params: paymentParams,
        headers: {
          "Content-Type": "multipart/form-data",
        },
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

  return (
    <>
      <Navbar />

      <main
        id="readable-content"
        className="gpmt-page"
        aria-label="GCash payment page"
      >
        <section className="gpmt-wrap">
          <div
            className="gpmt-card voice-readable"
            tabIndex="0"
            aria-label="GCash payment form"
          >
            <header className="gpmt-header">
              <div>
                <p
                  className="gpmt-eyebrow voice-readable"
                  tabIndex="0"
                  aria-label="Secure payment"
                >
                  Secure Payment
                </p>

                <h1
                  className="gpmt-title voice-readable"
                  tabIndex="0"
                  aria-label="Pay via GCash"
                >
                  Pay via GCash
                </h1>

                <p
                  className="gpmt-sub voice-readable"
                  tabIndex="0"
                  aria-label={
                    loading
                      ? "Loading payment details"
                      : `This payment is linked to ${readableLinkedRecord}.`
                  }
                >
                  {loading
                    ? "Loading payment details…"
                    : `This payment is linked to ${
                        isPublicWorkshop
                          ? `public workshop registration #${registrationId}`
                          : `booking #${bookingId}`
                      }.`}
                </p>
              </div>

              {!loading && (
                <div
                  className={`gpmt-status-pill gpmt-status-${safePaymentStatusClass}`}
                  tabIndex="0"
                  aria-label={`Payment status is ${paymentStatus}`}
                >
                  {paymentStatus.toUpperCase()}
                </div>
              )}
            </header>

            {loading ? (
              <div
                className="gpmt-loading voice-readable"
                tabIndex="0"
                aria-label="Loading payment details. Please wait."
              >
                <span className="gpmt-loader" aria-hidden="true"></span>
                Loading payment details…
              </div>
            ) : (
              <>
                {err && (
                  <div
                    className="gpmt-alert gpmt-alert-bad voice-readable"
                    role="alert"
                    tabIndex="0"
                    aria-label={`Error. ${err}`}
                  >
                    {err}
                  </div>
                )}

                <div className="gpmt-grid">
                  <aside className="gpmt-left-panel">
                    <div
                      className="gpmt-qr-card voice-readable"
                      tabIndex="0"
                      aria-label={`Scan the GCash QR code to pay ${money(
                        amountToPay
                      )} pesos.`}
                    >
                      <div className="gpmt-qr-top">
                        <span>Scan to Pay</span>
                      </div>

                      <div className="gpmt-qr">
                        <img src={gcash.qr} alt="GCash QR code for payment" />
                      </div>
                    </div>

                    <div
                      className="gpmt-business-card voice-readable"
                      tabIndex="0"
                      aria-label={`GCash number ${readableGcashNumber}. Initials or name ${gcash.name}.`}
                    >
                      <div className="gpmt-business-row">
                        <span>GCash Number</span>
                        <strong>{gcash.number}</strong>
                      </div>

                      <div className="gpmt-business-row">
                        <span>Initials/Name</span>
                        <strong>{gcash.name}</strong>
                      </div>
                    </div>

                    <div
                      className="gpmt-note-box voice-readable"
                      tabIndex="0"
                      aria-label="Reminder. Send payment first using the QR code or GCash number, then upload your proof of payment."
                    >
                      Send your payment first, then upload your proof below for
                      admin verification.
                    </div>
                  </aside>

                  <section className="gpmt-form-panel">
                    <form onSubmit={handleSubmit} encType="multipart/form-data">
                      <div className="gpmt-summary-grid">
                        <div
                          className="gpmt-summary-item voice-readable"
                          tabIndex="0"
                          aria-label={readableTotalAmount}
                        >
                          <span>Total Amount</span>
                          <strong>₱{money(totalAmount)}</strong>
                        </div>

                        {amountPaid > 0 && (
                          <div
                            className="gpmt-summary-item voice-readable"
                            tabIndex="0"
                            aria-label={`Amount already paid is ${money(
                              amountPaid
                            )} pesos.`}
                          >
                            <span>Amount Paid</span>
                            <strong>₱{money(amountPaid)}</strong>
                          </div>
                        )}

                        <div
                          className="gpmt-summary-item voice-readable"
                          tabIndex="0"
                          aria-label={`Payment status is ${paymentStatus}.`}
                        >
                          <span>Payment Status</span>
                          <strong>{paymentStatus.toUpperCase()}</strong>
                        </div>
                      </div>

                      <div className="gpmt-field">
                        <label
                          className="voice-readable"
                          htmlFor="gpmt-payment-choice-group"
                          tabIndex="0"
                          aria-label="Payment option"
                        >
                          Payment Option
                        </label>

                        <div
                          id="gpmt-payment-choice-group"
                          className="gpmt-payment-options"
                          role="radiogroup"
                          aria-label="Payment option"
                        >
                          {isPublicWorkshop && (
                            <label
                              className="gpmt-radio-option voice-readable"
                              tabIndex="0"
                              aria-label={`Full payment selected. Amount is ${money(
                                totalAmount
                              )} pesos.`}
                            >
                              <input
                                type="radio"
                                name="payment_choice"
                                value="full"
                                checked
                                readOnly
                              />
                              <span>
                                Full Payment
                                <b>₱{money(totalAmount)}</b>
                              </span>
                            </label>
                          )}

                          {showInitialOptions && (
                            <>
                              <label
                                className="gpmt-radio-option voice-readable"
                                tabIndex="0"
                                aria-label={`Downpayment option. ${percent(
                                  downpaymentPercentage
                                )} percent. Amount is ${money(
                                  downpaymentAmount
                                )} pesos.`}
                              >
                                <input
                                  type="radio"
                                  name="payment_choice"
                                  value="downpayment"
                                  checked={effectivePaymentChoice === "downpayment"}
                                  onChange={() =>
                                    setPaymentChoice("downpayment")
                                  }
                                />
                                <span>
                                  Downpayment ({percent(downpaymentPercentage)}
                                  %)
                                  <b>₱{money(downpaymentAmount)}</b>
                                </span>
                              </label>

                              <label
                                className="gpmt-radio-option voice-readable"
                                tabIndex="0"
                                aria-label={`Full payment option. Amount is ${money(
                                  totalAmount
                                )} pesos.`}
                              >
                                <input
                                  type="radio"
                                  name="payment_choice"
                                  value="full"
                                  checked={effectivePaymentChoice === "full"}
                                  onChange={() => setPaymentChoice("full")}
                                />
                                <span>
                                  Full Payment
                                  <b>₱{money(totalAmount)}</b>
                                </span>
                              </label>
                            </>
                          )}

                          {showRemainingOnly && (
                            <label
                              className="gpmt-radio-option voice-readable"
                              tabIndex="0"
                              aria-label={`Remaining balance selected. Amount is ${money(
                                remainingAmount
                              )} pesos.`}
                            >
                              <input
                                type="radio"
                                name="payment_choice"
                                value="remaining"
                                checked
                                readOnly
                              />
                              <span>
                                Remaining Balance
                                <b>₱{money(remainingAmount)}</b>
                              </span>
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="gpmt-field">
                        <label
                          className="voice-readable"
                          htmlFor="gpmt-amount"
                          tabIndex="0"
                          aria-label="Amount to pay"
                        >
                          Amount to Pay
                        </label>

                        <input
                          type="text"
                          id="gpmt-amount"
                          value={`₱${money(amountToPay)}`}
                          readOnly
                          aria-label={readableAmountToPay}
                        />

                        <p
                          className="gpmt-file-hint voice-readable"
                          tabIndex="0"
                          aria-label="This amount is based on the total saved when your booking was created."
                        >
                          This is based on the saved booking total.
                        </p>
                      </div>

                      <div className="gpmt-field">
                        <label
                          className="voice-readable"
                          htmlFor="gpmt-payer-name"
                          tabIndex="0"
                          aria-label="Payer name"
                        >
                          Payer Name
                        </label>

                        <input
                          type="text"
                          id="gpmt-payer-name"
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          placeholder="Enter the GCash account name"
                          required
                          aria-label="Payer name. Enter the name used in GCash payment."
                        />
                      </div>

                      <div className="gpmt-field">
                        <label
                          className="voice-readable"
                          htmlFor="gpmt-reference-no"
                          tabIndex="0"
                          aria-label="GCash reference number"
                        >
                          GCash Reference No.
                        </label>

                        <input
                          type="text"
                          id="gpmt-reference-no"
                          value={referenceNo}
                          onChange={(e) => setReferenceNo(e.target.value)}
                          placeholder="Enter your GCash reference number"
                          required
                          aria-label="GCash reference number. Enter the reference number from your receipt."
                        />
                      </div>

                      <div className="gpmt-field">
                        <label
                          className="voice-readable"
                          htmlFor="gpmt-proof"
                          tabIndex="0"
                          aria-label="Upload payment proof"
                        >
                          Upload Payment Proof
                        </label>

                        <input
                          type="file"
                          id="gpmt-proof"
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          onChange={handleProofChange}
                          required
                          aria-label="Upload payment proof. Accepted files are JPG, PNG, or WEBP."
                        />

                        <p
                          className="gpmt-file-hint voice-readable"
                          tabIndex="0"
                          aria-label="Accepted files are JPG, PNG, or WEBP. Maximum file size is 5 megabytes."
                        >
                          Accepted files: JPG, PNG, or WEBP. Maximum size: 5MB.
                        </p>
                      </div>

                      <button
                        className="gpmt-btn voice-readable"
                        type="submit"
                        disabled={submitting}
                        aria-label={
                          submitting
                            ? "Submitting payment proof"
                            : "Submit payment proof"
                        }
                      >
                        {submitting ? "SUBMITTING…" : "SUBMIT PAYMENT PROOF"}
                      </button>

                      <div
                        className="gpmt-note voice-readable"
                        tabIndex="0"
                        aria-label="Your payment will be marked pending until admin verification."
                      >
                        Your payment will be marked <b>Pending</b> until admin
                        verification.
                      </div>
                    </form>

                    <button
                      type="button"
                      className="gpmt-back voice-readable"
                      onClick={() => navigate(-1)}
                      aria-label="Go back to previous page"
                    >
                      ← Back
                    </button>
                  </section>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}