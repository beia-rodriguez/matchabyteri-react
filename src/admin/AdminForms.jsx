import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import { 
  Type, 
  AlignLeft, 
  Hash, 
  Mail, 
  Calendar, 
  ChevronDownSquare, 
  CheckCircle2, 
  CheckSquare, 
  Paperclip,
  GripVertical,
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  PartyPopper,
  Coffee
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const QUESTION_TYPES = [
  {
    value: "text",
    label: "Short Answer",
    icon: <Type size={16} />,
    hint: "One-line text (e.g. Event Name)",
    hasOptions: false,
    hasPricing: false,
  },
  {
    value: "textarea",
    label: "Long Answer",
    icon: <AlignLeft size={16} />,
    hint: "Multi-line text (e.g. Special Requests)",
    hasOptions: false,
    hasPricing: false,
  },
  {
    value: "number",
    label: "Number",
    icon: <Hash size={16} />,
    hint: "Numeric input",
    hasOptions: false,
    hasPricing: false,
  },
  {
    value: "email",
    label: "Email",
    icon: <Mail size={16} />,
    hint: "Email address",
    hasOptions: false,
    hasPricing: false,
  },
  {
    value: "date",
    label: "Date Picker",
    icon: <Calendar size={16} />,
    hint: "Date selection",
    hasOptions: false,
    hasPricing: false,
  },
  {
    value: "select",
    label: "Dropdown",
    icon: <ChevronDownSquare size={16} />,
    hint: "One choice from a dropdown list",
    hasOptions: true,
    hasPricing: true,
  },
  {
    value: "radio",
    label: "Multiple Choice",
    icon: <CheckCircle2 size={16} />,
    hint: "Pick one option (shown as radio buttons)",
    hasOptions: true,
    hasPricing: true,
  },
  {
    value: "checkbox",
    label: "Checkboxes",
    icon: <CheckSquare size={16} />,
    hint: "Pick one or more options",
    hasOptions: true,
    hasPricing: true,
    allowsQuantity: true,
  },
  {
    value: "file",
    label: "File Upload",
    icon: <Paperclip size={16} />,
    hint: "Customer uploads a file",
    hasOptions: false,
    hasPricing: false,
  },
];

const PRICE_TYPE_OPTIONS = [
  { value: "fixed", label: "Flat fee (₱ added once)" },
  { value: "per_quantity", label: "Per quantity selected" },
  { value: "per_cup", label: "Per cup ordered (×cups)" },
];

const typeMap = Object.fromEntries(QUESTION_TYPES.map((t) => [t.value, t]));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const emptyOption = () => ({ _id: uid(), label: "", price: 0, price_type: "fixed" });

const emptyField = (field_type = "text") => ({
  _id: uid(),
  label: "",
  field_name: "",
  field_type,
  is_required: false,
  allow_quantity: false,
  options: typeMap[field_type]?.hasOptions ? [emptyOption()] : [],
});

const emptySection = () => ({ _id: uid(), title: "", fields: [emptyField()] });

const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "field";

const buildFieldNames = (sections) => {
  const counts = {};
  return sections.map((s) => ({
    ...s,
    fields: s.fields.map((f) => {
      const base = slugify(f.label || "field");
      counts[base] = (counts[base] || 0) + 1;
      return { ...f, field_name: counts[base] > 1 ? `${base}_${counts[base]}` : base };
    }),
  }));
};

const money = (v) =>
  Number(v || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── Default templates ────────────────────────────────────────────────────────

const eventTemplate = () => [
  {
    _id: uid(),
    title: "Event Information",
    fields: [
      {
        _id: uid(),
        label: "Type of Event",
        field_name: "",
        field_type: "select",
        is_required: true,
        allow_quantity: false,
        options: ["Birthday Party", "Corporate Event", "Product Launch", "Bridal Shower", "Baby Shower", "Other"].map((l) => ({ _id: uid(), label: l, price: 0, price_type: "fixed" })),
      },
      { _id: uid(), label: "Event Name", field_name: "", field_type: "text", is_required: true, allow_quantity: false, options: [] },
      { _id: uid(), label: "Location", field_name: "", field_type: "text", is_required: true, allow_quantity: false, options: [] },
      {
        _id: uid(),
        label: "Estimated Number of Guests",
        field_name: "",
        field_type: "select",
        is_required: true,
        allow_quantity: false,
        options: ["10–20", "21–30", "31–40", "41–50", "50+"].map((l) => ({ _id: uid(), label: l, price: 0, price_type: "fixed" })),
      },
    ],
  },
  {
    _id: uid(),
    title: "Packages & Add-ons",
    fields: [
      {
        _id: uid(),
        label: "Cup Package",
        field_name: "",
        field_type: "radio",
        is_required: true,
        allow_quantity: false,
        options: [
          ["50 cups", 13000],
          ["75 cups", 21000],
          ["100 cups", 26000],
          ["150 cups", 34500],
          ["200 cups", 40000],
        ].map(([l, p]) => ({ _id: uid(), label: l, price: p, price_type: "fixed" })),
      },
      {
        _id: uid(),
        label: "Menu Option",
        field_name: "",
        field_type: "radio",
        is_required: true,
        allow_quantity: false,
        options: [
          ["4 menu items", 0, "fixed"],
          ["6 menu items", 1500, "fixed"],
          ["8 menu items", 3000, "fixed"],
          ["Customized cups logo", 12, "per_cup"],
        ].map(([l, p, pt]) => ({ _id: uid(), label: l, price: p, price_type: pt })),
      },
      {
        _id: uid(),
        label: "Milk Option",
        field_name: "",
        field_type: "radio",
        is_required: false,
        allow_quantity: false,
        options: ["Oatmilk", "Dairy Milk (+ ₱1,500)", "Non-fat Milk (+ ₱1,500)"].map((l, i) => ({ _id: uid(), label: l, price: i === 0 ? 0 : 1500, price_type: "fixed" })),
      },
      {
        _id: uid(),
        label: "Add-ons",
        field_name: "",
        field_type: "checkbox",
        is_required: false,
        allow_quantity: true,
        options: [
          ["Extra staff", 800, "per_quantity"],
          ["Sintra board sign", 0, "fixed"],
        ].map(([l, p, pt]) => ({ _id: uid(), label: l, price: p, price_type: pt })),
      },
    ],
  },
];

const workshopTemplate = () => [
  {
    _id: uid(),
    title: "Workshop Information",
    fields: [
      {
        _id: uid(),
        label: "Type of Workshop",
        field_name: "",
        field_type: "select",
        is_required: true,
        allow_quantity: false,
        options: ["Matcha Workshop", "Private Workshop", "Corporate Workshop", "Other"].map((l) => ({ _id: uid(), label: l, price: 0, price_type: "fixed" })),
      },
      {
        _id: uid(),
        label: "Location",
        field_name: "",
        field_type: "select",
        is_required: true,
        allow_quantity: false,
        options: ["Makati", "Greenhills, San Juan", "I have a set location"].map((l) => ({ _id: uid(), label: l, price: 0, price_type: "fixed" })),
      },
      {
        _id: uid(),
        label: "Number of Attendees",
        field_name: "",
        field_type: "select",
        is_required: true,
        allow_quantity: false,
        options: ["10–20", "21–30", "31–40", "41–50", "50+"].map((l) => ({ _id: uid(), label: l, price: 0, price_type: "fixed" })),
      },
    ],
  },
  {
    _id: uid(),
    title: "Packages & Add-ons",
    fields: [
      {
        _id: uid(),
        label: "Cup Drink Options",
        field_name: "",
        field_type: "radio",
        is_required: true,
        allow_quantity: false,
        options: ["2 cups per person", "3 cups per person", "5 cups per person"].map((l) => ({ _id: uid(), label: l, price: 0, price_type: "fixed" })),
      },
      {
        _id: uid(),
        label: "Customized Cups Logo",
        field_name: "",
        field_type: "checkbox",
        is_required: false,
        allow_quantity: false,
        options: [{ _id: uid(), label: "Customized cups logo (₱12/cup)", price: 12, price_type: "per_cup" }],
      },
      {
        _id: uid(),
        label: "Milk Options",
        field_name: "",
        field_type: "checkbox",
        is_required: false,
        allow_quantity: false,
        options: [
          ["Oatmilk", 0, "fixed"],
          ["Dairy Milk", 30, "per_cup"],
          ["Sparkling Water", 40, "per_cup"],
        ].map(([l, p, pt]) => ({ _id: uid(), label: l, price: p, price_type: pt })),
      },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypePicker({ value, onChange }) {
  return (
    <div className="afc-type-grid">
      {QUESTION_TYPES.map((t) => (
        <button
          key={t.value}
          type="button"
          className={`afc-type-card ${value === t.value ? "active" : ""}`}
          onClick={() => onChange(t.value)}
          title={t.hint}
        >
          <span className="afc-type-icon">{t.icon}</span>
          <span className="afc-type-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function OptionRow({ option, fieldType, onChange, onRemove, canRemove }) {
  const hasPricing = typeMap[fieldType]?.hasPricing;

  return (
    <div className="afc-option-row">
      <span className="afc-option-bullet">
        {fieldType === "radio" ? "◉" : fieldType === "select" ? "▾" : "☐"}
      </span>

      <input
        className="afc-option-input"
        type="text"
        placeholder="Option label…"
        value={option.label}
        onChange={(e) => onChange("label", e.target.value)}
      />

      {hasPricing && (
        <>
          <div className="afc-option-price-wrap">
            <span className="afc-option-currency">₱</span>
            <input
              className="afc-option-price"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={option.price}
              onChange={(e) => onChange("price", parseFloat(e.target.value) || 0)}
            />
          </div>

          <select
            className="afc-option-ptype"
            value={option.price_type}
            onChange={(e) => onChange("price_type", e.target.value)}
            title="How is this price applied?"
          >
            {PRICE_TYPE_OPTIONS.map((pt) => (
              <option key={pt.value} value={pt.value}>
                {pt.label}
              </option>
            ))}
          </select>
        </>
      )}

      {canRemove && (
        <button
          type="button"
          className="afc-icon-btn afc-remove-opt"
          onClick={onRemove}
          title="Remove option"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

function FieldCard({
  field,
  sectionIndex,
  fieldIndex,
  totalFields,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
}) {
  const typeDef = typeMap[field.field_type] || typeMap.text;
  const [showTypePicker, setShowTypePicker] = useState(false);

const handleTypeChange = (newType) => {
    const newTypeDef = typeMap[newType];
    const updates = { field_type: newType };
    
    if (!newTypeDef.hasOptions) {
      updates.options = [];
    } else if (!field.options?.length) {
      updates.options = [emptyOption()];
    }
    
    // Send both updates at the exact same time
    onUpdate(updates);
    setShowTypePicker(false);
  };

  const updateOption = (optIndex, key, value) => {
    const next = field.options.map((o, i) => (i === optIndex ? { ...o, [key]: value } : o));
    onUpdate("options", next);
  };

  const addOption = () => onUpdate("options", [...field.options, emptyOption()]);

  const removeOption = (optIndex) =>
    onUpdate("options", field.options.filter((_, i) => i !== optIndex));

  return (
    <div className="afc-field-card">
      <div className="afc-field-header">
        <div className="afc-field-drag-handle" title="Drag to reorder">
          <GripVertical size={16} />
        </div>

        <button
          type="button"
          className="afc-type-pill"
          onClick={() => setShowTypePicker((v) => !v)}
          title="Change question type"
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {typeDef.icon} {typeDef.label} ▾
          </span>
        </button>

        <div className="afc-field-actions">
          <button
            type="button"
            className="afc-icon-btn"
            onClick={onDuplicate}
            title="Duplicate question"
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            className="afc-icon-btn"
            onClick={() => onMove(-1)}
            disabled={fieldIndex === 0}
            title="Move up"
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            className="afc-icon-btn"
            onClick={() => onMove(1)}
            disabled={fieldIndex === totalFields - 1}
            title="Move down"
          >
            <ArrowDown size={16} />
          </button>
          <button
            type="button"
            className="afc-icon-btn afc-remove-btn"
            onClick={onRemove}
            title="Delete question"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {showTypePicker && (
        <div className="afc-type-picker-popup">
          <div className="afc-type-picker-title">Choose question type</div>
          <TypePicker value={field.field_type} onChange={handleTypeChange} />
        </div>
      )}

      <input
        className="afc-field-label-input"
        type="text"
        placeholder={`Question label… (e.g. ${typeDef.hint})`}
        value={field.label}
        onChange={(e) => onUpdate("label", e.target.value)}
      />

      {typeDef.hasOptions && (
        <div className="afc-options-list">
          {(field.options || []).map((opt, optIndex) => (
            <OptionRow
              key={opt._id}
              option={opt}
              fieldType={field.field_type}
              onChange={(k, v) => updateOption(optIndex, k, v)}
              onRemove={() => removeOption(optIndex)}
              canRemove={field.options.length > 1}
            />
          ))}

          <button type="button" className="afc-add-option-btn" onClick={addOption}>
            + Add option
          </button>
        </div>
      )}

      <div className="afc-field-footer">
        <label className="afc-toggle">
          <input
            type="checkbox"
            checked={field.is_required}
            onChange={(e) => onUpdate("is_required", e.target.checked)}
          />
          <span className="afc-toggle-track" />
          <span className="afc-toggle-label">Required</span>
        </label>

        {typeDef.allowsQuantity && (
          <label className="afc-toggle">
            <input
              type="checkbox"
              checked={field.allow_quantity}
              onChange={(e) => onUpdate("allow_quantity", e.target.checked)}
            />
            <span className="afc-toggle-track" />
            <span className="afc-toggle-label">
              Allow quantity input <span className="afc-toggle-hint">(customer can enter how many)</span>
            </span>
          </label>
        )}
      </div>
    </div>
  );
}

function SectionEditor({ section, sectionIndex, totalSections, onUpdate, onRemove, onAddField }) {
const updateField = (fieldIndex, keyOrObj, value) => {
    const next = section.fields.map((f, i) => {
      if (i !== fieldIndex) return f;
      // Allow passing an object to update multiple things at once
      if (typeof keyOrObj === "object" && keyOrObj !== null) {
        return { ...f, ...keyOrObj };
      }
      return { ...f, [keyOrObj]: value };
    });
    onUpdate("fields", next);
  };

  const removeField = (fieldIndex) => {
    onUpdate("fields", section.fields.filter((_, i) => i !== fieldIndex));
  };

  const duplicateField = (fieldIndex) => {
    const orig = section.fields[fieldIndex];
    const copy = {
      ...orig,
      _id: uid(),
      label: orig.label + " (copy)",
      options: (orig.options || []).map((o) => ({ ...o, _id: uid() })),
    };
    const next = [...section.fields];
    next.splice(fieldIndex + 1, 0, copy);
    onUpdate("fields", next);
  };

  const moveField = (fieldIndex, dir) => {
    const next = [...section.fields];
    const target = fieldIndex + dir;
    if (target < 0 || target >= next.length) return;
    [next[fieldIndex], next[target]] = [next[target], next[fieldIndex]];
    onUpdate("fields", next);
  };

  return (
    <div className="afc-section">
      <div className="afc-section-header">
        <div className="afc-section-number">Section {sectionIndex + 1}</div>
        <input
          className="afc-section-title-input"
          type="text"
          placeholder="Section title (optional — leave blank for no header)"
          value={section.title}
          onChange={(e) => onUpdate("title", e.target.value)}
        />
        {totalSections > 1 && (
          <button
            type="button"
            className="afc-icon-btn afc-remove-btn"
            onClick={onRemove}
            title="Remove section"
            style={{ alignSelf: "flex-start", padding: "6px 12px", fontSize: "0.85rem" }}
          >
            Remove section
          </button>
        )}
      </div>

      {(section.fields || []).map((field, fieldIndex) => (
        <FieldCard
          key={field._id}
          field={field}
          sectionIndex={sectionIndex}
          fieldIndex={fieldIndex}
          totalFields={section.fields.length}
          onUpdate={(k, v) => updateField(fieldIndex, k, v)}
          onRemove={() => removeField(fieldIndex)}
          onDuplicate={() => duplicateField(fieldIndex)}
          onMove={(dir) => moveField(fieldIndex, dir)}
        />
      ))}

      <button
        type="button"
        className="afc-add-field-btn"
        onClick={onAddField}
      >
        + Add question to this section
      </button>
    </div>
  );
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function PreviewField({ field }) {
  const typeDef = typeMap[field.field_type] || typeMap.text;

  return (
    <div className="afp-isolated-scope">
      <div className="field">
        <label className="label">
          {field.label || <em style={{ color: "#aaa" }}>Untitled question</em>}
          {field.is_required && (
            <span style={{ color: "#d93025", marginLeft: 4 }}>*</span>
          )}
        </label>

        {field.field_type === "text" && (
          <input type="text" placeholder="Short answer text" disabled />
        )}
        {field.field_type === "textarea" && (
          <textarea placeholder="Long answer text" disabled />
        )}
        {field.field_type === "number" && (
          <input type="number" placeholder="0" disabled />
        )}
        {field.field_type === "email" && (
          <input type="email" placeholder="name@email.com" disabled />
        )}
        {field.field_type === "date" && <input type="date" disabled />}
        {field.field_type === "file" && (
          <div
            style={{
              width: "100%",
              padding: 12,
              border: "2px dashed #ccc",
              borderRadius: 10,
              textAlign: "center",
              color: "#888",
              background: "var(--field)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Paperclip size={16} /> Choose file…
          </div>
        )}

        {field.field_type === "select" && (
          <select disabled>
            <option>— Select an option —</option>
            {(field.options || []).map((o, i) => (
              <option key={i}>
                {o.label}
                {o.price > 0
                  ? ` (+₱${money(o.price)}${
                      o.price_type !== "fixed"
                        ? ` ${PRICE_TYPE_OPTIONS.find(
                            (p) => p.value === o.price_type
                          )?.label.toLowerCase()}`
                        : ""
                    })`
                  : ""}
              </option>
            ))}
          </select>
        )}

        {(field.field_type === "radio" || field.field_type === "checkbox") && (
          <div className="options">
            {(field.options || []).map((o, i) => (
              <div key={i}>
                <label className="opt">
                  <input type={field.field_type} disabled name={field._id} />
                  <span>
                    {o.label}
                    {o.price > 0 && (
                      <span style={{ color: "var(--green-2)", fontWeight: 800 }}>
                        {" "}
                        +₱{money(o.price)}
                      </span>
                    )}
                  </span>
                </label>
                {field.allow_quantity &&
                  field.field_type === "checkbox" &&
                  o.label && (
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      disabled
                      style={{ marginTop: 8 }}
                    />
                  )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LivePreview({ title, sections, downpayment }) {
  return (
    <div className="afp-root afp-isolated-scope">
      <div className="card">
        <div className="title" style={{ fontSize: "1.8rem", marginBottom: 6 }}>
          {title || "Untitled Form"}
        </div>
        <div
          style={{
            textAlign: "center",
            color: "var(--muted)",
            fontSize: "0.9rem",
            marginBottom: 24,
            fontWeight: 700,
          }}
        >
          {downpayment < 100
            ? `${downpayment}% downpayment required to confirm booking`
            : "Full payment required to confirm booking"}
        </div>

        {sections.map((section, si) => (
          <div key={section._id} style={{ marginBottom: 32 }}>
            {section.title && (
              <div className="section-title">{section.title}</div>
            )}
            {(section.fields || []).map((field) => (
              <PreviewField key={field._id} field={field} />
            ))}
          </div>
        ))}

        <div className="actions" style={{ justifyContent: "center" }}>
          <button
            className="btn btn-confirm"
            disabled
            style={{ opacity: 0.6, width: "100%", maxWidth: 300 }}
          >
            Submit Booking Request
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminForms() {
  const [bookingType, setBookingType] = useState("event");
  const [csrfToken, setCsrfToken] = useState("");
  const [title, setTitle] = useState("");
  const [downpayment, setDownpayment] = useState(50);
  const [sections, setSections] = useState(eventTemplate());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);

  const getDefaultTitle = (type) =>
    type === "event" ? "Event Booking Form" : "Private Workshop Booking Form";

  const getDefaultTemplate = (type) =>
    type === "event" ? eventTemplate() : workshopTemplate();

  const normalizeFromApi = (apiSections) =>
    (apiSections || []).map((section) => ({
      _id: uid(),
      title: section.title || "",
      fields: (section.fields || []).map((field) => ({
        _id: uid(),
        label: field.label || "",
        field_name: field.field_name || "",
        field_type: field.field_type || "text",
        is_required: Number(field.is_required) === 1,
        allow_quantity: Number(field.allow_quantity) === 1,
        options: (field.options || []).map((o) => ({
          _id: uid(),
          label: o.label || "",
          price: Number(o.price || 0),
          price_type: o.price_type || "fixed",
        })),
      })),
    }));

  const loadForm = async (type) => {
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

      if (data.form) {
        setTitle(data.form.title || "");
        setDownpayment(Number(data.form.downpayment_percentage || 50));
        const normalized = normalizeFromApi(data.form.sections);
        setSections(
          normalized.length ? normalized : getDefaultTemplate(type)
        );
      } else {
        setTitle(getDefaultTitle(type));
        setDownpayment(50);
        setSections(getDefaultTemplate(type));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load booking form.");
      setTitle(getDefaultTitle(type));
      setSections(getDefaultTemplate(type));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForm(bookingType);
  }, [bookingType]);

  const updateSection = (si, key, value) =>
    setSections((prev) =>
      prev.map((s, i) => (i === si ? { ...s, [key]: value } : s))
    );

  const addSection = () => setSections((prev) => [...prev, emptySection()]);

  const removeSection = (si) =>
    setSections((prev) => prev.filter((_, i) => i !== si));

  const addFieldToSection = (si) =>
    setSections((prev) =>
      prev.map((s, i) =>
        i === si ? { ...s, fields: [...s.fields, emptyField()] } : s
      )
    );

  const validate = () => {
    if (!title.trim()) return "Please give this form a title.";
    if (Number(downpayment) < 1 || Number(downpayment) > 100)
      return "Downpayment percentage must be between 1 and 100.";
    const liveSections = sections.filter((s) => (s.fields || []).length > 0);
    if (!liveSections.length) return "Add at least one question.";

    for (const section of sections) {
      for (const field of section.fields || []) {
        if (!field.label.trim()) return "Every question needs a label.";
        if (
          typeMap[field.field_type]?.hasOptions &&
          !(field.options || []).length
        )
          return `"${field.label}" needs at least one option.`;
        for (const opt of field.options || []) {
          if (!opt.label.trim())
            return `"${field.label}" has an option without a label.`;
        }
      }
    }
    return "";
  };

  const handleSave = async () => {
    setError("");
    setNotice("");

    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setSaving(true);
    const processedSections = buildFieldNames(sections);

    try {
      const { data } = await adminApi.post("/admin/save-booking-form.php", {
        csrf_token: csrfToken,
        booking_type: bookingType,
        title,
        downpayment_percentage: Number(downpayment),
        sections: processedSections.map((s) => ({
          title: s.title,
          fields: s.fields.map((f) => ({
            label: f.label,
            field_name: f.field_name,
            field_type: f.field_type,
            is_required: f.is_required ? 1 : 0,
            allow_quantity: f.allow_quantity ? 1 : 0,
            options: f.options.map((o) => ({
              label: o.label,
              price: o.price,
              price_type: o.price_type,
            })),
          })),
        })),
      });

      if (data.success) {
        setNotice("✓ Form saved successfully.");
        await loadForm(bookingType);
      } else {
        setError(data.error || "Failed to save form.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to save form.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetConfirm = () => {
    setTitle(getDefaultTitle(bookingType));
    setDownpayment(50);
    setSections(getDefaultTemplate(bookingType));
    setConfirmReset(false);
    setNotice("");
    setError("");
  };

  return (
    <AdminLayout title="Booking Forms">
      {confirmReset && (
        <div
          className="afc-modal-backdrop"
          onClick={() => setConfirmReset(false)}
        >
          <div className="afc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="afc-modal-title">Reset to default template?</div>
            <p className="afc-modal-body">
              All current questions will be replaced with the default{" "}
              {bookingType === "event" ? "Event" : "Workshop"} template.
              Unsaved changes will be lost.
            </p>
            <div className="afc-modal-actions">
              <button
                className="afc-btn-secondary"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
              <button className="afc-btn-danger" onClick={handleResetConfirm}>
                Yes, reset
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="afc-toolbar">
        <div className="afc-toolbar-left">
          <div className="afc-tabs">
            {["event", "workshop"].map((t) => (
              <button
                key={t}
                className={`afc-tab ${bookingType === t ? "active" : ""}`}
                onClick={() => setBookingType(t)}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                {t === "event" ? <PartyPopper size={16} /> : <Coffee size={16} />}
                {t === "event" ? "Event Form" : "Workshop Form"}
              </button>
            ))}
          </div>
        </div>

        <div className="afc-toolbar-right">
          <button
            type="button"
            className="afc-btn-secondary"
            onClick={() => setShowPreview((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>

          <button
            type="button"
            className="afc-btn-secondary"
            onClick={() => setConfirmReset(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RotateCcw size={16} /> Reset Template
          </button>

          <button
            type="button"
            className="afc-btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Save size={16} /> {saving ? "Saving…" : "Save Form"}
          </button>
        </div>
      </div>

      {notice && <div className="admin-notice-react ok">{notice}</div>}
      {error && <div className="admin-notice-react bad">{error}</div>}

      <div className={`afc-split ${showPreview ? "with-preview" : ""}`}>
        <div className="afc-editor">
          <div className="afc-settings-card">
            <div className="afc-settings-row">
              <div className="afc-settings-field">
                <label className="afc-label">Form Title</label>
                <input
                  className="afc-input"
                  type="text"
                  value={title}
                  placeholder={getDefaultTitle(bookingType)}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="afc-settings-field afc-settings-field--sm">
                <label className="afc-label">
                  Downpayment % <span className="afc-label-hint"> (1–100)</span>
                </label>
                <input
                  className="afc-input"
                  type="number"
                  min="1"
                  max="100"
                  value={downpayment}
                  onChange={(e) => setDownpayment(e.target.value)}
                />
              </div>
            </div>
            <div className="afc-downpayment-preview">
              {downpayment >= 100
                ? "Customers must pay the full amount upfront."
                : `Customers pay ${downpayment}% now and the remaining ${
                    100 - downpayment
                  }% later.`}
            </div>
          </div>

          {loading ? (
            <div className="afc-loading">Loading form…</div>
          ) : (
            <>
              {sections.map((section, si) => (
                <SectionEditor
                  key={section._id}
                  section={section}
                  sectionIndex={si}
                  totalSections={sections.length}
                  onUpdate={(k, v) => updateSection(si, k, v)}
                  onRemove={() => removeSection(si)}
                  onAddField={() => addFieldToSection(si)}
                />
              ))}

              <button
                type="button"
                className="afc-add-section-btn"
                onClick={addSection}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <Plus size={18} /> Add new section
              </button>
            </>
          )}
        </div>

        {showPreview && (
          <div className="afc-preview-pane">
            <div className="afc-preview-header">
              <span
                className="afc-preview-badge"
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Eye size={12} /> Live Preview
              </span>
              <span className="afc-preview-hint">
                This is exactly what your customers will see
              </span>
            </div>
            <LivePreview
              title={title}
              sections={sections}
              downpayment={downpayment}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}