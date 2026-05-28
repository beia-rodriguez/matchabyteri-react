import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "./../assets/css/AdminForms.css";
import {
  Save,
  RefreshCw,
  PartyPopper,
  Coffee,
  Calculator,
  Info,
} from "lucide-react";

const EVENT_DEFAULTS = {
  event_50_cups_price_per_cup: 230,
  event_100_cups_price_per_cup: 220,
  event_150_cups_price_per_cup: 210,
  event_200_cups_price_per_cup: 200,
  event_signature_addon: 0,
  event_plus_addon: 1000,
  event_premium_addon: 2000,
  event_booking_downpayment_percentage: 50,
};

const PRIVATE_WORKSHOP_DEFAULTS = {
  private_workshop_standard_price: 3000,
  private_workshop_premium_price: 3800,
  private_workshop_downpayment_percentage: 50,
};

const money = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function PriceInput({
  label,
  value,
  onChange,
  helper,
  min = 0,
  max,
  suffix,
}) {
  return (
    <div className="afc-settings-field">
      <label className="afc-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {!suffix && <span className="afc-option-currency">₱</span>}
        <input
          className="afc-input"
          type="number"
          min={min}
          max={max}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && (
          <span style={{ fontWeight: 800, color: "var(--muted, #777)" }}>
            {suffix}
          </span>
        )}
      </div>
      {helper && <div className="afc-label-hint">{helper}</div>}
    </div>
  );
}

function EventPricingEditor({ pricing, setPricing }) {
  const [previewCupQty, setPreviewCupQty] = useState(100);
  const [previewMenu, setPreviewMenu] = useState("PREMIUM");

  const cupPriceKey = {
    50: "event_50_cups_price_per_cup",
    100: "event_100_cups_price_per_cup",
    150: "event_150_cups_price_per_cup",
    200: "event_200_cups_price_per_cup",
  }[previewCupQty];

  const menuAddonKey = {
    SIGNATURE: "event_signature_addon",
    PLUS: "event_plus_addon",
    PREMIUM: "event_premium_addon",
  }[previewMenu];

  const previewBase =
    numberValue(previewCupQty) * numberValue(pricing[cupPriceKey]);
  const previewAddon = numberValue(pricing[menuAddonKey]);
  const previewTotal = previewBase + previewAddon;
  const downpaymentPercent = numberValue(
    pricing.event_booking_downpayment_percentage
  );
  const dueNow = (previewTotal * downpaymentPercent) / 100;

  const update = (key, value) => {
    setPricing((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <>
      <div className="afc-settings-card">
        <div className="afc-section-number">Event Cup Package Prices</div>
        <p className="afc-downpayment-preview">
          Event booking uses <strong>base price + menu package add-on</strong>.
          The base price is calculated by multiplying the selected cup quantity
          by the price per cup.
        </p>

        <div className="afc-settings-row">
          <PriceInput
            label="50 cups price per cup"
            value={pricing.event_50_cups_price_per_cup}
            onChange={(v) => update("event_50_cups_price_per_cup", v)}
            helper="Default: ₱230 per cup"
          />

          <PriceInput
            label="100 cups price per cup"
            value={pricing.event_100_cups_price_per_cup}
            onChange={(v) => update("event_100_cups_price_per_cup", v)}
            helper="Default: ₱220 per cup"
          />
        </div>

        <div className="afc-settings-row">
          <PriceInput
            label="150 cups price per cup"
            value={pricing.event_150_cups_price_per_cup}
            onChange={(v) => update("event_150_cups_price_per_cup", v)}
            helper="Default: ₱210 per cup"
          />

          <PriceInput
            label="200 cups price per cup"
            value={pricing.event_200_cups_price_per_cup}
            onChange={(v) => update("event_200_cups_price_per_cup", v)}
            helper="Default: ₱200 per cup"
          />
        </div>
      </div>

      <div className="afc-settings-card">
        <div className="afc-section-number">Event Menu Package Add-ons</div>
        <p className="afc-downpayment-preview">
          Signature can stay at ₱0 because it is already included in the base
          cup package. Plus and Premium add extra cost.
        </p>

        <div className="afc-settings-row">
          <PriceInput
            label="Signature add-on"
            value={pricing.event_signature_addon}
            onChange={(v) => update("event_signature_addon", v)}
            helper="4 signature drinks"
          />

          <PriceInput
            label="Plus add-on"
            value={pricing.event_plus_addon}
            onChange={(v) => update("event_plus_addon", v)}
            helper="Signature drinks + 2 additional drinks"
          />
        </div>

        <div className="afc-settings-row">
          <PriceInput
            label="Premium add-on"
            value={pricing.event_premium_addon}
            onChange={(v) => update("event_premium_addon", v)}
            helper="Signature drinks + 4 additional drinks"
          />

          <PriceInput
            label="Event downpayment"
            value={pricing.event_booking_downpayment_percentage}
            onChange={(v) => update("event_booking_downpayment_percentage", v)}
            helper="Amount customer pays first when reserving"
            min={1}
            max={100}
            suffix="%"
          />
        </div>
      </div>

      <div className="afc-settings-card">
        <div
          className="afc-section-number"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Calculator size={16} />
          Event Pricing Preview
        </div>

        <div className="afc-settings-row">
          <div className="afc-settings-field">
            <label className="afc-label">Preview cup package</label>
            <select
              className="afc-input"
              value={previewCupQty}
              onChange={(e) => setPreviewCupQty(Number(e.target.value))}
            >
              <option value={50}>50 cups</option>
              <option value={100}>100 cups</option>
              <option value={150}>150 cups</option>
              <option value={200}>200 cups</option>
            </select>
          </div>

          <div className="afc-settings-field">
            <label className="afc-label">Preview menu package</label>
            <select
              className="afc-input"
              value={previewMenu}
              onChange={(e) => setPreviewMenu(e.target.value)}
            >
              <option value="SIGNATURE">Signature</option>
              <option value="PLUS">Plus</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </div>
        </div>

        <div className="afp-booking-summary">
          <div className="afp-booking-row">
            <span>
              {previewCupQty} cups × ₱{money(pricing[cupPriceKey])}
            </span>
            <strong>₱{money(previewBase)}</strong>
          </div>

          <div className="afp-booking-row">
            <span>{previewMenu} add-on</span>
            <strong>₱{money(previewAddon)}</strong>
          </div>

          <div className="afp-booking-row afp-booking-row-total">
            <span>Total Event Price</span>
            <strong>₱{money(previewTotal)}</strong>
          </div>

          <div className="afp-booking-row">
            <span>Downpayment Due Now ({downpaymentPercent}%)</span>
            <strong>₱{money(dueNow)}</strong>
          </div>
        </div>
      </div>
    </>
  );
}

function PrivateWorkshopPricingEditor({ pricing, setPricing }) {
  const [previewTotalAttendees, setPreviewTotalAttendees] = useState(30);
  const [previewStandardAttendees, setPreviewStandardAttendees] = useState(15);
  const [previewPremiumAttendees, setPreviewPremiumAttendees] = useState(15);

  const update = (key, value) => {
    setPricing((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const standardTotal =
    numberValue(previewStandardAttendees) *
    numberValue(pricing.private_workshop_standard_price);

  const premiumTotal =
    numberValue(previewPremiumAttendees) *
    numberValue(pricing.private_workshop_premium_price);

  const total = standardTotal + premiumTotal;

  const downpaymentPercent = numberValue(
    pricing.private_workshop_downpayment_percentage
  );

  const dueNow = (total * downpaymentPercent) / 100;

  const attendeeMismatch =
    numberValue(previewStandardAttendees) +
      numberValue(previewPremiumAttendees) !==
    numberValue(previewTotalAttendees);

  return (
    <>
      <div className="afc-settings-card">
        <div className="afc-section-number">Private Workshop Prices</div>
        <p className="afc-downpayment-preview">
          Private workshop uses <strong>per-person package pricing</strong>.
          The customer enters how many attendees chose Standard and Premium.
        </p>

        <div className="afc-settings-row">
          <PriceInput
            label="Standard price per person"
            value={pricing.private_workshop_standard_price}
            onChange={(v) => update("private_workshop_standard_price", v)}
            helper="Default: ₱3,000 per person"
          />

          <PriceInput
            label="Premium price per person"
            value={pricing.private_workshop_premium_price}
            onChange={(v) => update("private_workshop_premium_price", v)}
            helper="Default: ₱3,800 per person"
          />
        </div>

        <div className="afc-settings-row">
          <PriceInput
            label="Private workshop downpayment"
            value={pricing.private_workshop_downpayment_percentage}
            onChange={(v) =>
              update("private_workshop_downpayment_percentage", v)
            }
            helper="Amount customer pays first when reserving"
            min={1}
            max={100}
            suffix="%"
          />
        </div>
      </div>

      <div className="afc-settings-card">
        <div
          className="afc-section-number"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Calculator size={16} />
          Private Workshop Pricing Preview
        </div>

        <div className="afc-settings-row">
          <PriceInput
            label="Total attendees"
            value={previewTotalAttendees}
            onChange={setPreviewTotalAttendees}
            min={1}
            suffix="people"
          />

          <PriceInput
            label="Standard attendees"
            value={previewStandardAttendees}
            onChange={setPreviewStandardAttendees}
            min={0}
            suffix="people"
          />

          <PriceInput
            label="Premium attendees"
            value={previewPremiumAttendees}
            onChange={setPreviewPremiumAttendees}
            min={0}
            suffix="people"
          />
        </div>

        {attendeeMismatch && (
          <div className="admin-notice-react bad">
            Standard attendees + Premium attendees must equal Total attendees.
          </div>
        )}

        <div className="afp-booking-summary">
          <div className="afp-booking-row">
            <span>
              {previewStandardAttendees} Standard × ₱
              {money(pricing.private_workshop_standard_price)}
            </span>
            <strong>₱{money(standardTotal)}</strong>
          </div>

          <div className="afp-booking-row">
            <span>
              {previewPremiumAttendees} Premium × ₱
              {money(pricing.private_workshop_premium_price)}
            </span>
            <strong>₱{money(premiumTotal)}</strong>
          </div>

          <div className="afp-booking-row afp-booking-row-total">
            <span>Total Private Workshop Price</span>
            <strong>₱{money(total)}</strong>
          </div>

          <div className="afp-booking-row">
            <span>Downpayment Due Now ({downpaymentPercent}%)</span>
            <strong>₱{money(dueNow)}</strong>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminForms() {
  const [bookingType, setBookingType] = useState("event_booking");
  const [csrfToken, setCsrfToken] = useState("");
  const [pricing, setPricing] = useState({
    ...EVENT_DEFAULTS,
    ...PRIVATE_WORKSHOP_DEFAULTS,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activeDefaults = useMemo(() => {
    return bookingType === "event_booking"
      ? EVENT_DEFAULTS
      : PRIVATE_WORKSHOP_DEFAULTS;
  }, [bookingType]);

  const loadPricing = async (type) => {
    setLoading(true);
    setNotice("");
    setError("");

    try {
      const { data } = await adminApi.get("/admin/get-booking-form.php", {
        params: { type },
      });

      if (data.csrf_token) {
        setCsrfToken(data.csrf_token);
      }

      setPricing((prev) => ({
        ...prev,
        ...activeDefaults,
        ...(data.pricing || {}),
      }));
    } catch (err) {
      console.error(err);
      setError("Failed to load pricing settings.");
      setPricing((prev) => ({
        ...prev,
        ...activeDefaults,
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPricing(bookingType);
  }, [bookingType]);

  const validate = () => {
    const keys =
      bookingType === "event_booking"
        ? Object.keys(EVENT_DEFAULTS)
        : Object.keys(PRIVATE_WORKSHOP_DEFAULTS);

    for (const key of keys) {
      const value = numberValue(pricing[key]);

      if (value < 0) {
        return "Prices cannot be negative.";
      }

      if (key.includes("downpayment_percentage") && (value < 1 || value > 100)) {
        return "Downpayment percentage must be between 1 and 100.";
      }
    }

    return "";
  };

  const handleSave = async () => {
    setError("");
    setNotice("");

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    const keys =
      bookingType === "event_booking"
        ? Object.keys(EVENT_DEFAULTS)
        : Object.keys(PRIVATE_WORKSHOP_DEFAULTS);

    const payloadPricing = {};

    keys.forEach((key) => {
      payloadPricing[key] = numberValue(pricing[key]);
    });

    try {
      const { data } = await adminApi.post("/admin/save-booking-form.php", {
        csrf_token: csrfToken,
        booking_type: bookingType,
        pricing: payloadPricing,
      });

      if (data.success) {
        setNotice("✓ Pricing settings saved successfully.");
        await loadPricing(bookingType);
      } else {
        setError(data.error || "Failed to save pricing settings.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to save pricing settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setPricing((prev) => ({
      ...prev,
      ...activeDefaults,
    }));

    setNotice("Default values restored. Click Save to apply them.");
    setError("");
  };

  return (
    <AdminLayout title="Booking Pricing">
      <div className="admin-forms-page-react">
        <div className="afc-toolbar">
          <div className="afc-toolbar-left">
            <div className="afc-tabs">
              <button
                type="button"
                className={`afc-tab ${
                  bookingType === "event_booking" ? "active" : ""
                }`}
                onClick={() => setBookingType("event_booking")}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <PartyPopper size={16} />
                Event Booking
              </button>

              <button
                type="button"
                className={`afc-tab ${
                  bookingType === "private_workshop" ? "active" : ""
                }`}
                onClick={() => setBookingType("private_workshop")}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Coffee size={16} />
                Private Workshop
              </button>
            </div>
          </div>

          <div className="afc-toolbar-right">
            <button
              type="button"
              className="afc-btn-secondary"
              onClick={handleResetDefaults}
              disabled={saving || loading}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw size={16} />
              Reset Defaults
            </button>

            <button
              type="button"
              className="afc-btn-primary"
              onClick={handleSave}
              disabled={saving || loading}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Save size={16} />
              {saving ? "Saving…" : "Save Pricing"}
            </button>
          </div>
        </div>

        {notice && <div className="admin-notice-react ok">{notice}</div>}
        {error && <div className="admin-notice-react bad">{error}</div>}

        <div className="afc-settings-card">
          <div
            className="afc-section-number"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Info size={16} />
            Pricing Logic
          </div>

          {bookingType === "event_booking" ? (
            <p className="afc-downpayment-preview">
              Event booking total is calculated as:{" "}
              <strong>Cup Quantity × Price Per Cup + Menu Package Add-on</strong>.
            </p>
          ) : (
            <p className="afc-downpayment-preview">
              Private workshop total is calculated as:{" "}
              <strong>
                Standard Attendees × Standard Price + Premium Attendees ×
                Premium Price
              </strong>.
            </p>
          )}
        </div>

        {loading ? (
          <div className="afc-loading">Loading pricing settings…</div>
        ) : (
          <>
            {bookingType === "event_booking" ? (
              <EventPricingEditor pricing={pricing} setPricing={setPricing} />
            ) : (
              <PrivateWorkshopPricingEditor
                pricing={pricing}
                setPricing={setPricing}
              />
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}