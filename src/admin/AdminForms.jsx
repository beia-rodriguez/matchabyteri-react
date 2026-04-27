import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

const FIELD_TYPES = [
  "text",
  "number",
  "email",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "date",
  "time",
  "file",
];

const PRICE_TYPES = [
  { value: "fixed", label: "Fixed" },
  { value: "per_quantity", label: "Per Quantity" },
  { value: "per_cup", label: "Per Cup" },
];

const emptyOption = () => ({
  label: "",
  price: 0,
  price_type: "fixed",
});

const emptyField = () => ({
  label: "",
  field_name: "",
  field_type: "text",
  is_required: false,
  allow_quantity: false,
  options: [],
});

const emptySection = () => ({
  title: "",
  fields: [],
});

const eventTemplate = () => [
  {
    title: "Event Information",
    fields: [
      {
        label: "Type of Event",
        field_name: "",
        field_type: "select",
        is_required: true,
        allow_quantity: false,
        options: [
          { label: "Birthday Party", price: 0, price_type: "fixed" },
          { label: "Corporate Event", price: 0, price_type: "fixed" },
          { label: "Product Launch", price: 0, price_type: "fixed" },
          { label: "Bridal Shower", price: 0, price_type: "fixed" },
          { label: "Baby Shower", price: 0, price_type: "fixed" },
          { label: "Other", price: 0, price_type: "fixed" },
        ],
      },
      {
        label: "Event Name",
        field_name: "",
        field_type: "text",
        is_required: true,
        allow_quantity: false,
        options: [],
      },
      {
        label: "Location",
        field_name: "",
        field_type: "text",
        is_required: true,
        allow_quantity: false,
        options: [],
      },
      {
        label: "Estimated Number of Guests",
        field_name: "",
        field_type: "select",
        is_required: true,
        allow_quantity: false,
        options: [
          { label: "10 - 20", price: 0, price_type: "fixed" },
          { label: "21 - 30", price: 0, price_type: "fixed" },
          { label: "31 - 40", price: 0, price_type: "fixed" },
          { label: "41 - 50", price: 0, price_type: "fixed" },
          { label: "50+", price: 0, price_type: "fixed" },
        ],
      },
    ],
  },
  {
    title: "Packages and Add-ons",
    fields: [
      {
        label: "Cup Package",
        field_name: "",
        field_type: "radio",
        is_required: true,
        allow_quantity: false,
        options: [
          { label: "50 cups", price: 13000, price_type: "fixed" },
          { label: "75 cups", price: 21000, price_type: "fixed" },
          { label: "100 cups", price: 26000, price_type: "fixed" },
          { label: "150 cups", price: 34500, price_type: "fixed" },
          { label: "200 cups", price: 40000, price_type: "fixed" },
        ],
      },
      {
        label: "Menu Option",
        field_name: "",
        field_type: "radio",
        is_required: true,
        allow_quantity: false,
        options: [
          { label: "4 menu items", price: 0, price_type: "fixed" },
          { label: "6 menu items", price: 1500, price_type: "fixed" },
          { label: "8 menu items", price: 3000, price_type: "fixed" },
          { label: "Customized cups logo", price: 12, price_type: "per_cup" },
        ],
      },
      {
        label: "Milk Option",
        field_name: "",
        field_type: "radio",
        is_required: false,
        allow_quantity: false,
        options: [
          { label: "Oatmilk", price: 0, price_type: "fixed" },
          { label: "Dairy Milk", price: 1500, price_type: "fixed" },
          { label: "Non-fat Milk", price: 1500, price_type: "fixed" },
        ],
      },
      {
        label: "Add-ons",
        field_name: "",
        field_type: "checkbox",
        is_required: false,
        allow_quantity: true,
        options: [
          { label: "Extra staff", price: 800, price_type: "per_quantity" },
          { label: "Sintra board sign", price: 0, price_type: "fixed" },
        ],
      },
    ],
  },
];

const workshopTemplate = () => [
  {
    title: "Workshop Information",
    fields: [
      {
        label: "Type of Workshop",
        field_name: "",
        field_type: "select",
        is_required: true,
        allow_quantity: false,
        options: [
          { label: "Matcha Workshop", price: 0, price_type: "fixed" },
          { label: "Private Workshop", price: 0, price_type: "fixed" },
          { label: "Corporate Workshop", price: 0, price_type: "fixed" },
          { label: "Other", price: 0, price_type: "fixed" },
        ],
      },
      {
        label: "Location",
        field_name: "",
        field_type: "select",
        is_required: true,
        allow_quantity: false,
        options: [
          { label: "Makati", price: 0, price_type: "fixed" },
          { label: "Greenhills, San Juan", price: 0, price_type: "fixed" },
          { label: "I have a set location", price: 0, price_type: "fixed" },
        ],
      },
      {
        label: "Number of Attendees",
        field_name: "",
        field_type: "select",
        is_required: true,
        allow_quantity: false,
        options: [
          { label: "10 - 20", price: 0, price_type: "fixed" },
          { label: "21 - 30", price: 0, price_type: "fixed" },
          { label: "31 - 40", price: 0, price_type: "fixed" },
          { label: "41 - 50", price: 0, price_type: "fixed" },
          { label: "50+", price: 0, price_type: "fixed" },
        ],
      },
    ],
  },
  {
    title: "Packages and Add-ons",
    fields: [
      {
        label: "Cup Drink Options",
        field_name: "",
        field_type: "radio",
        is_required: true,
        allow_quantity: false,
        options: [
          { label: "2 cups per person", price: 0, price_type: "fixed" },
          { label: "3 cups per person", price: 0, price_type: "fixed" },
          { label: "5 cups per person", price: 0, price_type: "fixed" },
        ],
      },
      {
        label: "Drinks Allowed Per Person",
        field_name: "",
        field_type: "radio",
        is_required: true,
        allow_quantity: false,
        options: [
          { label: "2", price: 0, price_type: "fixed" },
          { label: "3", price: 0, price_type: "fixed" },
          { label: "5", price: 0, price_type: "fixed" },
        ],
      },
      {
        label: "Customized Cups Logo",
        field_name: "",
        field_type: "checkbox",
        is_required: false,
        allow_quantity: false,
        options: [
          { label: "Customized cups logo", price: 12, price_type: "per_cup" },
        ],
      },
      {
        label: "Milk Options",
        field_name: "",
        field_type: "checkbox",
        is_required: false,
        allow_quantity: false,
        options: [
          { label: "Oatmilk", price: 0, price_type: "fixed" },
          { label: "Dairy Milk", price: 30, price_type: "per_cup" },
          { label: "Sparkling Water", price: 40, price_type: "per_cup" },
        ],
      },
    ],
  },
];

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

  useEffect(() => {
    loadForm(bookingType);
  }, [bookingType]);

  const getDefaultTitle = (type) =>
    type === "event" ? "Event Booking Form" : "Private Workshop Booking Form";

  const getDefaultTemplate = (type) =>
    type === "event" ? eventTemplate() : workshopTemplate();

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
        setSections(
          Array.isArray(data.form.sections) && data.form.sections.length
            ? data.form.sections.map((section) => ({
                title: section.title || "",
                fields: Array.isArray(section.fields)
                  ? section.fields.map((field) => ({
                      label: field.label || "",
                      field_name: field.field_name || "",
                      field_type: field.field_type || "text",
                      is_required: Number(field.is_required) === 1,
                      allow_quantity: Number(field.allow_quantity) === 1,
                      options: Array.isArray(field.options)
                        ? field.options.map((option) => ({
                            label: option.label || "",
                            price: Number(option.price || 0),
                            price_type: option.price_type || "fixed",
                          }))
                        : [],
                    }))
                  : [],
              }))
            : getDefaultTemplate(type)
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

  const resetToDefaultTemplate = () => {
    if (!window.confirm("Reset this form to the default template? Unsaved changes will be lost.")) {
      return;
    }

    setTitle(getDefaultTitle(bookingType));
    setDownpayment(50);
    setSections(getDefaultTemplate(bookingType));
  };

  const updateSection = (sectionIndex, key, value) => {
    setSections((prev) =>
      prev.map((section, index) =>
        index === sectionIndex ? { ...section, [key]: value } : section
      )
    );
  };

  const addSection = () => {
    setSections((prev) => [...prev, emptySection()]);
  };

  const removeSection = (sectionIndex) => {
    setSections((prev) => prev.filter((_, index) => index !== sectionIndex));
  };

  const addField = (sectionIndex) => {
    setSections((prev) =>
      prev.map((section, index) =>
        index === sectionIndex
          ? { ...section, fields: [...section.fields, emptyField()] }
          : section
      )
    );
  };

  const removeField = (sectionIndex, fieldIndex) => {
    setSections((prev) =>
      prev.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              fields: section.fields.filter((_, i) => i !== fieldIndex),
            }
          : section
      )
    );
  };

  const updateField = (sectionIndex, fieldIndex, key, value) => {
    setSections((prev) =>
      prev.map((section, sIndex) => {
        if (sIndex !== sectionIndex) return section;

        return {
          ...section,
          fields: section.fields.map((field, fIndex) =>
            fIndex === fieldIndex ? { ...field, [key]: value } : field
          ),
        };
      })
    );
  };

  const addOption = (sectionIndex, fieldIndex) => {
    setSections((prev) =>
      prev.map((section, sIndex) => {
        if (sIndex !== sectionIndex) return section;

        return {
          ...section,
          fields: section.fields.map((field, fIndex) =>
            fIndex === fieldIndex
              ? { ...field, options: [...field.options, emptyOption()] }
              : field
          ),
        };
      })
    );
  };

  const removeOption = (sectionIndex, fieldIndex, optionIndex) => {
    setSections((prev) =>
      prev.map((section, sIndex) => {
        if (sIndex !== sectionIndex) return section;

        return {
          ...section,
          fields: section.fields.map((field, fIndex) =>
            fIndex === fieldIndex
              ? {
                  ...field,
                  options: field.options.filter((_, oIndex) => oIndex !== optionIndex),
                }
              : field
          ),
        };
      })
    );
  };

  const updateOption = (sectionIndex, fieldIndex, optionIndex, key, value) => {
    setSections((prev) =>
      prev.map((section, sIndex) => {
        if (sIndex !== sectionIndex) return section;

        return {
          ...section,
          fields: section.fields.map((field, fIndex) => {
            if (fIndex !== fieldIndex) return field;

            return {
              ...field,
              options: field.options.map((option, oIndex) =>
                oIndex === optionIndex ? { ...option, [key]: value } : option
              ),
            };
          }),
        };
      })
    );
  };

  const fieldNeedsOptions = (fieldType) =>
    ["select", "radio", "checkbox"].includes(fieldType);

  const validate = () => {
    if (!title.trim()) return "Form title is required.";

    if (Number(downpayment) < 1 || Number(downpayment) > 100) {
      return "Downpayment must be between 1 and 100.";
    }

    const validSections = sections.filter((section) => section.title.trim());

    if (!validSections.length) return "Add at least one section.";

    for (const section of validSections) {
      for (const field of section.fields || []) {
        if (!field.label.trim()) return "Every field must have a label.";

        if (fieldNeedsOptions(field.field_type) && !field.options?.length) {
          return `"${field.label}" needs at least one option.`;
        }

        for (const option of field.options || []) {
          if (!option.label.trim()) {
            return `"${field.label}" has an option without a label.`;
          }
        }
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

    try {
      const payload = {
        csrf_token: csrfToken,
        booking_type: bookingType,
        title,
        downpayment_percentage: Number(downpayment),
        sections,
      };

      const { data } = await adminApi.post("/admin/save-booking-form.php", payload);

      if (data.success) {
        setNotice("Booking form saved successfully.");
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

  return (
    <AdminLayout title="Booking Forms">
      {notice && <div className="admin-notice-react good">{notice}</div>}
      {error && <div className="admin-notice-react bad">{error}</div>}

      <div className="admin-panel-react">
        <h3>Form Settings</h3>

        <div className="admin-grid-2-react">
          <div>
            <label className="admin-muted-react">Booking Type</label>
            <select
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value)}
            >
              <option value="event">Event</option>
              <option value="workshop">Private Workshop</option>
            </select>
          </div>

          <div>
            <label className="admin-muted-react">Downpayment Percentage</label>
            <input
              type="number"
              min="1"
              max="100"
              value={downpayment}
              onChange={(e) => setDownpayment(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="admin-muted-react">Form Title</label>
          <input
            type="text"
            value={title}
            placeholder="Event Booking Form"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="admin-pill-react"
            onClick={resetToDefaultTemplate}
          >
            Reset to Default Template
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin-panel-react">Loading form...</div>
      ) : (
        <>
          {sections.map((section, sectionIndex) => (
            <div className="admin-panel-react" key={sectionIndex}>
              <div className="admin-stat-item-react">
                <strong>Section {sectionIndex + 1}</strong>

                <button
                  type="button"
                  className="admin-pill-react"
                  onClick={() => removeSection(sectionIndex)}
                  disabled={sections.length === 1}
                >
                  Remove Section
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="admin-muted-react">Section Title</label>
                <input
                  type="text"
                  value={section.title}
                  placeholder="Packages and Add-ons"
                  onChange={(e) =>
                    updateSection(sectionIndex, "title", e.target.value)
                  }
                />
              </div>

              {(section.fields || []).map((field, fieldIndex) => (
                <div
                  key={fieldIndex}
                  style={{
                    marginTop: 18,
                    padding: 16,
                    border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 14,
                  }}
                >
                  <div className="admin-stat-item-react">
                    <strong>{field.label || `Field ${fieldIndex + 1}`}</strong>

                    <button
                      type="button"
                      className="admin-pill-react"
                      onClick={() => removeField(sectionIndex, fieldIndex)}
                    >
                      Remove Field
                    </button>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label className="admin-muted-react">Question / Field Label</label>
                    <input
                      type="text"
                      value={field.label}
                      placeholder="Example: Cup Package"
                      onChange={(e) =>
                        updateField(sectionIndex, fieldIndex, "label", e.target.value)
                      }
                    />
                  </div>

                  <div className="admin-grid-3-react" style={{ marginTop: 12 }}>
                    <div>
                      <label className="admin-muted-react">Field Type</label>
                      <select
                        value={field.field_type}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          updateField(sectionIndex, fieldIndex, "field_type", nextType);

                          if (!fieldNeedsOptions(nextType)) {
                            updateField(sectionIndex, fieldIndex, "options", []);
                          }
                        }}
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="admin-pill-react">
                      <input
                        type="checkbox"
                        checked={!!field.is_required}
                        onChange={(e) =>
                          updateField(
                            sectionIndex,
                            fieldIndex,
                            "is_required",
                            e.target.checked
                          )
                        }
                      />
                      Required
                    </label>

                    <label className="admin-pill-react">
                      <input
                        type="checkbox"
                        checked={!!field.allow_quantity}
                        onChange={(e) =>
                          updateField(
                            sectionIndex,
                            fieldIndex,
                            "allow_quantity",
                            e.target.checked
                          )
                        }
                      />
                      Allow Quantity
                    </label>
                  </div>

                  {fieldNeedsOptions(field.field_type) && (
                    <div style={{ marginTop: 16 }}>
                      <div className="admin-stat-item-react">
                        <strong>Choices and Prices</strong>

                        <button
                          type="button"
                          className="admin-pill-react"
                          onClick={() => addOption(sectionIndex, fieldIndex)}
                        >
                          Add Choice
                        </button>
                      </div>

                      {(field.options || []).map((option, optionIndex) => (
                        <div
                          className="admin-grid-3-react"
                          key={optionIndex}
                          style={{ marginTop: 10 }}
                        >
                          <input
                            type="text"
                            placeholder="Choice label"
                            value={option.label}
                            onChange={(e) =>
                              updateOption(
                                sectionIndex,
                                fieldIndex,
                                optionIndex,
                                "label",
                                e.target.value
                              )
                            }
                          />

                          <input
                            type="number"
                            step="0.01"
                            placeholder="Price"
                            value={option.price}
                            onChange={(e) =>
                              updateOption(
                                sectionIndex,
                                fieldIndex,
                                optionIndex,
                                "price",
                                e.target.value
                              )
                            }
                          />

                          <div style={{ display: "flex", gap: 8 }}>
                            <select
                              value={option.price_type}
                              onChange={(e) =>
                                updateOption(
                                  sectionIndex,
                                  fieldIndex,
                                  optionIndex,
                                  "price_type",
                                  e.target.value
                                )
                              }
                            >
                              {PRICE_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              className="admin-pill-react"
                              onClick={() =>
                                removeOption(sectionIndex, fieldIndex, optionIndex)
                              }
                            >
                              X
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="admin-pill-react"
                style={{ marginTop: 14 }}
                onClick={() => addField(sectionIndex)}
              >
                Add Field
              </button>
            </div>
          ))}

          <div className="admin-panel-react">
            <button type="button" className="admin-pill-react" onClick={addSection}>
              Add Section
            </button>

            <button
              type="button"
              className="admin-pill-react"
              style={{ marginLeft: 10 }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Active Form"}
            </button>
          </div>
        </>
      )}
    </AdminLayout>
  );
}