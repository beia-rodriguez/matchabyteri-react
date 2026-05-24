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

const ALLOWED_PURPOSES = ["event_booking", "workshop_booking", "workshop_public"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function GcashPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const purpose = (searchParams.get("purpose") || "").toLowerCase();
  const bookingId = parseInt(searchParams.get("booking_id") || "0", 10);
  const registrationId = parseInt(
    searchParams.get("registration_id") || "0",
    10
  );

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

  useEffect(() => {
    const validPrivate =
      ["event_booking", "workshop_booking"].includes(purpose) && bookingId > 0;

    const validPublic = purpose === "workshop_public" && registrationId > 0;

    if (!ALLOWED_PURPOSES.includes(purpose) || (!validPrivate && !validPublic)) {
      navigate("/calendar");
      return;
    }

    loadPaymentInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const totalAmount = useMemo(() => {
    return Number(paymentData?.total_amount || 0);
  }, [paymentData]);

  const formSnapshot = useMemo(() => {
    const snapshotRaw = paymentData?.form_snapshot;

    if (!snapshotRaw) return null;

    try {
      return typeof snapshotRaw === "string" ? JSON.parse(snapshotRaw) : snapshotRaw;
    } catch {
      return null;
    }
  }, [paymentData]);

  const bookingBaseRate = useMemo(() => {
    const snapshotBaseRate = Number(formSnapshot?.base_rate || 0);

    if (Number.isFinite(snapshotBaseRate) && snapshotBaseRate > 0) {
      return snapshotBaseRate;
    }

    const contextRaw = paymentData?.context_json;

    if (!contextRaw) return 0;

    try {
      const context =
        typeof contextRaw === "string" ? JSON.parse(contextRaw) : contextRaw;

      const contextBaseRate = Number(context?.base_rate || context?.form_snapshot?.base_rate || 0);

      return Number.isFinite(contextBaseRate) && contextBaseRate > 0
        ? contextBaseRate
        : 0;
    } catch {
      return 0;
    }
  }, [formSnapshot, paymentData]);

  const downpaymentPercentage = useMemo(() => {
    if (isPublicWorkshop) return 100;

    const percentage = Number(formSnapshot?.downpayment_percentage || 50);

    return percentage > 0 && percentage <= 100 ? percentage : 50;
  }, [formSnapshot, isPublicWorkshop]);

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
  }, [
    isPublicWorkshop,
    paymentChoice,
    totalAmount,
    remainingAmount,
    downpaymentAmount,
  ]);

  const showInitialOptions =
    !isPublicWorkshop &&
    (paymentStatus === "unpaid" || paymentStatus === "rejected");

  const showRemainingOnly = !isPublicWorkshop && paymentStatus === "partial";

  const readableLinkedRecord = isPublicWorkshop
    ? `public workshop registration number ${digitsForReader(registrationId)}`
    : `booking number ${digitsForReader(bookingId)}`;

  const readableGcashNumber = digitsForReader(gcash.number);
  const readableTotalAmount = `Total amount is ${money(totalAmount)} pesos.`;
  const readableBaseRate =
    bookingBaseRate > 0
      ? `Base booking rate is ${money(bookingBaseRate)} pesos.`
      : "No separate base booking rate was found for this booking.";
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
    formData.append("payment_choice", paymentChoice);
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
                    ? "Loading payment details..."
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
                Loading payment details...
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

                        {bookingBaseRate > 0 && (
                          <div
                            className="gpmt-summary-item voice-readable"
                            tabIndex="0"
                            aria-label={readableBaseRate}
                          >
                            <span>Base Booking Rate</span>
                            <strong>₱{money(bookingBaseRate)}</strong>
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
                                aria-label={`Downpayment option. ${money(
                                  downpaymentPercentage
                                )} percent. Amount is ${money(
                                  downpaymentAmount
                                )} pesos.`}
                              >
                                <input
                                  type="radio"
                                  name="payment_choice"
                                  value="downpayment"
                                  checked={paymentChoice === "downpayment"}
                                  onChange={() =>
                                    setPaymentChoice("downpayment")
                                  }
                                />
                                <span>
                                  Downpayment ({money(downpaymentPercentage)}%)
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
                                  checked={paymentChoice === "full"}
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
                        {submitting ? "SUBMITTING..." : "SUBMIT PAYMENT PROOF"}
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