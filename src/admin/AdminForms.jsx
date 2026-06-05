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
  Plus,
  Trash2,
  History,
  Eye,
  EyeOff,
} from "lucide-react";

const DEFAULT_EVENT_FORM = {
  cup_packages: [
    { quantity: 50, price_per_cup: 230, is_active: 1, sort_order: 1 },
    { quantity: 100, price_per_cup: 220, is_active: 1, sort_order: 2 },
    { quantity: 150, price_per_cup: 210, is_active: 1, sort_order: 3 },
    { quantity: 200, price_per_cup: 200, is_active: 1, sort_order: 4 },
  ],
  menu_packages: [
    {
      package_code: "SIGNATURE",
      label: "Signature Package",
      description: "4 signature drinks",
      addon_price: 0,
      included_drinks_count: 4,
      is_active: 1,
      sort_order: 1,
    },
    {
      package_code: "PLUS",
      label: "Plus Package",
      description: "Signature drinks + 2 additional drinks",
      addon_price: 1000,
      included_drinks_count: 6,
      is_active: 1,
      sort_order: 2,
    },
    {
      package_code: "PREMIUM",
      label: "Premium Package",
      description: "Signature drinks + 4 additional drinks",
      addon_price: 2000,
      included_drinks_count: 8,
      is_active: 1,
      sort_order: 3,
    },
  ],
  drinks: [
    {
      drink_name: "Basic Matcha Latte",
      category: "matcha",
      is_signature: 1,
      is_active: 1,
      sort_order: 1,
    },
    {
      drink_name: "Earl Grey Matcha Latte",
      category: "matcha",
      is_signature: 1,
      is_active: 1,
      sort_order: 2,
    },
    {
      drink_name: "Peach Mango Matcha Latte",
      category: "matcha",
      is_signature: 1,
      is_active: 1,
      sort_order: 3,
    },
    {
      drink_name: "AM Matcha ’Ricano",
      category: "matcha",
      is_signature: 1,
      is_active: 1,
      sort_order: 4,
    },
  ],
  downpayment_percentage: 50,
  last_updated: null,
  updated_by: null,
};

const DEFAULT_PRIVATE_FORM = {
  packages: [
    {
      package_code: "STANDARD",
      label: "Standard Package",
      price_per_person: 3000,
      description: "Private workshop standard package",
      is_active: 1,
      sort_order: 1,
    },
    {
      package_code: "PREMIUM",
      label: "Premium Package",
      price_per_person: 3800,
      description: "Private workshop premium package",
      is_active: 1,
      sort_order: 2,
    },
  ],
  downpayment_percentage: 50,
  last_updated: null,
  updated_by: null,
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

const integerValue = (value) => {
  const text = String(value ?? "").replace(/[^\d]/g, "");
  return text === "" ? "" : text;
};

const toInteger = (value, fallback = 0) => {
  const cleaned = integerValue(value);
  if (cleaned === "") return fallback;

  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toMoneyNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const makeCode = (text) =>
  String(text || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const clone = (value) => JSON.parse(JSON.stringify(value));

function PriceInput({
  label,
  value,
  onChange,
  helper,
  min = 0,
  max,
  suffix,
  integer = false,
}) {
  const handleChange = (e) => {
    let nextValue = e.target.value;

    if (integer) {
      nextValue = integerValue(nextValue);
    }

    onChange(nextValue);
  };

  return (
    <div className="afc-settings-field">
      <label className="afc-label">{label}</label>

      <div className="afc-input-with-prefix">
        {!suffix && <span className="afc-option-currency">₱</span>}

        <input
          aria-label={label}
          className="afc-input"
          type={integer ? "text" : "number"}
          inputMode={integer ? "numeric" : "decimal"}
          pattern={integer ? "[0-9]*" : undefined}
          min={integer ? undefined : min}
          max={integer ? undefined : max}
          step={integer ? undefined : "0.01"}
          value={value ?? ""}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (integer && [".", ",", "e", "E", "-", "+"].includes(e.key)) {
              e.preventDefault();
            }
          }}
          onPaste={(e) => {
            if (!integer) return;

            const pastedText = e.clipboardData.getData("text");

            if (!/^\d+$/.test(pastedText)) {
              e.preventDefault();
            }
          }}
        />

        {suffix && <span className="afc-input-suffix">{suffix}</span>}
      </div>

      {helper && <div className="afc-label-hint">{helper}</div>}
    </div>
  );
}

function TextInput({ label, value, onChange, helper, placeholder }) {
  return (
    <div className="afc-settings-field">
      <label className="afc-label">{label}</label>

      <input
        aria-label={label}
        className="afc-input"
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />

      {helper && <div className="afc-label-hint">{helper}</div>}
    </div>
  );
}

function SelectInput({ label, value, onChange, children, helper }) {
  return (
    <div className="afc-settings-field">
      <label className="afc-label">{label}</label>

      <select
        aria-label={label}
        className="afc-input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>

      {helper && <div className="afc-label-hint">{helper}</div>}
    </div>
  );
}

function SectionHeader({ title, children }) {
  return (
    <div className="afc-section-head">
      <div className="afc-section-number">{title}</div>
      <div className="afc-section-actions">{children}</div>
    </div>
  );
}

function StatusButton({ item, onToggle }) {
  const active = Number(item?.is_active) === 1;

  return (
    <button
      type="button"
      className={active ? "afc-btn-soft" : "afc-btn-muted"}
      onClick={onToggle}
      title={active ? "Disable" : "Enable"}
      aria-label={active ? "Disable item" : "Enable item"}
    >
      {active ? <Eye size={15} /> : <EyeOff size={15} />}
      {active ? "Active" : "Hidden"}
    </button>
  );
}

function EventPricingEditor({ form, setForm }) {
  const cupPackages = safeArray(form?.cup_packages);
  const menuPackages = safeArray(form?.menu_packages);
  const drinks = safeArray(form?.drinks);

  const activeCups = cupPackages.filter((item) => Number(item.is_active) === 1);
  const activeMenus = menuPackages.filter(
    (item) => Number(item.is_active) === 1
  );

  const [previewCupId, setPreviewCupId] = useState("");
  const [previewMenuId, setPreviewMenuId] = useState("");

  const defaultPreviewCupId = String(
    activeCups[0]?.id || activeCups[0]?._local_id || ""
  );
  const defaultPreviewMenuId = String(
    activeMenus[0]?.id || activeMenus[0]?._local_id || ""
  );

  const selectedPreviewCupId = activeCups.some(
    (item) => String(item.id || item._local_id) === String(previewCupId)
  )
    ? previewCupId
    : defaultPreviewCupId;

  const selectedPreviewMenuId = activeMenus.some(
    (item) => String(item.id || item._local_id) === String(previewMenuId)
  )
    ? previewMenuId
    : defaultPreviewMenuId;

  const previewCup =
    activeCups.find(
      (item) => String(item.id || item._local_id) === String(selectedPreviewCupId)
    ) || activeCups[0];

  const previewMenu =
    activeMenus.find(
      (item) => String(item.id || item._local_id) === String(selectedPreviewMenuId)
    ) || activeMenus[0];

  const previewBase =
    numberValue(previewCup?.quantity) * numberValue(previewCup?.price_per_cup);

  const previewAddon = numberValue(previewMenu?.addon_price);
  const previewTotal = previewBase + previewAddon;
  const downpaymentPercent = numberValue(form?.downpayment_percentage || 50);
  const dueNow = (previewTotal * downpaymentPercent) / 100;

  const updateFormValue = (key, value) => {
    setForm((prev) => ({
      ...(prev || {}),
      [key]: value,
    }));
  };

  const updateCup = (index, key, value) => {
    setForm((prev) => {
      const next = {
        ...(prev || {}),
        cup_packages: safeArray(prev?.cup_packages).map((item) => ({ ...item })),
      };

      if (!next.cup_packages[index]) return next;

      next.cup_packages[index][key] =
        key === "quantity" || key === "sort_order" ? integerValue(value) : value;

      return next;
    });
  };

  const addCup = () => {
    setForm((prev) => {
      const current = safeArray(prev?.cup_packages);

      return {
        ...(prev || {}),
        cup_packages: [
          ...current,
          {
            _local_id: `new-cup-${Date.now()}`,
            quantity: "",
            price_per_cup: "",
            is_active: 1,
            sort_order: current.length + 1,
          },
        ],
      };
    });
  };

  const removeCup = (index) => {
    setForm((prev) => {
      const next = {
        ...(prev || {}),
        cup_packages: safeArray(prev?.cup_packages).map((item) => ({ ...item })),
      };

      const item = next.cup_packages[index];

      if (!item) return next;

      if (item.id) {
        item.is_active = 0;
      } else {
        next.cup_packages.splice(index, 1);
      }

      return next;
    });
  };

  const updateMenu = (index, key, value) => {
    setForm((prev) => {
      const next = {
        ...(prev || {}),
        menu_packages: safeArray(prev?.menu_packages).map((item) => ({
          ...item,
        })),
      };

      if (!next.menu_packages[index]) return next;

      if (key === "included_drinks_count" || key === "sort_order") {
        next.menu_packages[index][key] = integerValue(value);
      } else {
        next.menu_packages[index][key] = value;
      }

      if (key === "label" && !next.menu_packages[index].id) {
        next.menu_packages[index].package_code = makeCode(value);
      }

      return next;
    });
  };

  const addMenu = () => {
    setForm((prev) => {
      const current = safeArray(prev?.menu_packages);

      return {
        ...(prev || {}),
        menu_packages: [
          ...current,
          {
            _local_id: `new-menu-${Date.now()}`,
            package_code: "",
            label: "",
            description: "",
            addon_price: 0,
            included_drinks_count: 0,
            is_active: 1,
            sort_order: current.length + 1,
          },
        ],
      };
    });
  };

  const removeMenu = (index) => {
    setForm((prev) => {
      const next = {
        ...(prev || {}),
        menu_packages: safeArray(prev?.menu_packages).map((item) => ({
          ...item,
        })),
      };

      const item = next.menu_packages[index];

      if (!item) return next;

      if (item.id) {
        item.is_active = 0;
      } else {
        next.menu_packages.splice(index, 1);
      }

      return next;
    });
  };

  const updateDrink = (index, key, value) => {
    setForm((prev) => {
      const next = {
        ...(prev || {}),
        drinks: safeArray(prev?.drinks).map((item) => ({ ...item })),
      };

      if (!next.drinks[index]) return next;

      next.drinks[index][key] = key === "sort_order" ? integerValue(value) : value;

      return next;
    });
  };

  const addDrink = () => {
    setForm((prev) => {
      const current = safeArray(prev?.drinks);

      return {
        ...(prev || {}),
        drinks: [
          ...current,
          {
            _local_id: `new-drink-${Date.now()}`,
            drink_name: "",
            category: "matcha",
            is_signature: 0,
            is_active: 1,
            sort_order: current.length + 1,
          },
        ],
      };
    });
  };

  const removeDrink = (index) => {
    setForm((prev) => {
      const next = {
        ...(prev || {}),
        drinks: safeArray(prev?.drinks).map((item) => ({ ...item })),
      };

      const item = next.drinks[index];

      if (!item) return next;

      if (item.id) {
        item.is_active = 0;
      } else {
        next.drinks.splice(index, 1);
      }

      return next;
    });
  };

  return (
    <>
      <div className="afc-settings-card">
        <SectionHeader title="Event Cup Package Prices">
          <button type="button" className="afc-btn-secondary" onClick={addCup}>
            <Plus size={15} />
            Add Cup Package
          </button>
        </SectionHeader>

        <p className="afc-downpayment-preview">
          Add any cup package you want, such as 250 cups or 300 cups. Active
          packages will automatically appear on the customer booking form.
        </p>

        {cupPackages.map((item, index) => (
          <div className="afc-edit-row" key={item.id || item._local_id || index}>
            <PriceInput
              label="Cup Quantity"
              value={item.quantity}
              onChange={(v) => updateCup(index, "quantity", v)}
              suffix="cups"
              integer
            />

            <PriceInput
              label="Price Per Cup"
              value={item.price_per_cup}
              onChange={(v) => updateCup(index, "price_per_cup", v)}
            />

            <PriceInput
              label="Sort Order"
              value={item.sort_order}
              onChange={(v) => updateCup(index, "sort_order", v)}
              suffix="#"
              integer
            />

            <div className="afc-row-actions">
              <StatusButton
                item={item}
                onToggle={() =>
                  updateCup(
                    index,
                    "is_active",
                    Number(item.is_active) === 1 ? 0 : 1
                  )
                }
              />

              <button
                type="button"
                className="afc-btn-danger"
                onClick={() => removeCup(index)}
                aria-label="Remove item"
              >
                <Trash2 size={15} />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="afc-settings-card">
        <SectionHeader title="Event Menu Packages">
          <button type="button" className="afc-btn-secondary" onClick={addMenu}>
            <Plus size={15} />
            Add Menu Package
          </button>
        </SectionHeader>

        <p className="afc-downpayment-preview">
          Add or edit menu packages like Signature, Plus, Premium, or your own
          custom package.
        </p>

        {menuPackages.map((item, index) => (
          <div
            className="afc-edit-row afc-edit-row-wide"
            key={item.id || item._local_id || index}
          >
            <TextInput
              label="Package Code"
              value={item.package_code}
              onChange={(v) => updateMenu(index, "package_code", makeCode(v))}
              helper="Example: SIGNATURE, PLUS, PREMIUM"
            />

            <TextInput
              label="Label"
              value={item.label}
              onChange={(v) => updateMenu(index, "label", v)}
              placeholder="Signature Package"
            />

            <TextInput
              label="Description"
              value={item.description}
              onChange={(v) => updateMenu(index, "description", v)}
              placeholder="4 signature drinks"
            />

            <PriceInput
              label="Add-on Price"
              value={item.addon_price}
              onChange={(v) => updateMenu(index, "addon_price", v)}
            />

            <PriceInput
              label="Included Drinks"
              value={item.included_drinks_count}
              onChange={(v) => updateMenu(index, "included_drinks_count", v)}
              suffix="drinks"
              integer
            />

            <PriceInput
              label="Sort Order"
              value={item.sort_order}
              onChange={(v) => updateMenu(index, "sort_order", v)}
              suffix="#"
              integer
            />

            <div className="afc-row-actions">
              <StatusButton
                item={item}
                onToggle={() =>
                  updateMenu(
                    index,
                    "is_active",
                    Number(item.is_active) === 1 ? 0 : 1
                  )
                }
              />

              <button
                type="button"
                className="afc-btn-danger"
                onClick={() => removeMenu(index)}
                aria-label="Remove item"
              >
                <Trash2 size={15} />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="afc-settings-card">
        <SectionHeader title="Event Drinks">
          <button type="button" className="afc-btn-secondary" onClick={addDrink}>
            <Plus size={15} />
            Add Drink
          </button>
        </SectionHeader>

        <p className="afc-downpayment-preview">
          Drinks added here will be shown as customer options in the event
          booking form.
        </p>

        {drinks.map((item, index) => (
          <div className="afc-edit-row" key={item.id || item._local_id || index}>
            <TextInput
              label="Drink Name"
              value={item.drink_name}
              onChange={(v) => updateDrink(index, "drink_name", v)}
              placeholder="Strawberry Matcha Latte"
            />

            <SelectInput
              label="Category"
              value={item.category}
              onChange={(v) => updateDrink(index, "category", v)}
            >
              <option value="matcha">Matcha</option>
              <option value="hojicha">Hojicha</option>
              <option value="other">Other</option>
            </SelectInput>

            <SelectInput
              label="Signature Drink"
              value={String(item.is_signature)}
              onChange={(v) => updateDrink(index, "is_signature", Number(v))}
            >
              <option value="0">No</option>
              <option value="1">Yes</option>
            </SelectInput>

            <PriceInput
              label="Sort Order"
              value={item.sort_order}
              onChange={(v) => updateDrink(index, "sort_order", v)}
              suffix="#"
              integer
            />

            <div className="afc-row-actions">
              <StatusButton
                item={item}
                onToggle={() =>
                  updateDrink(
                    index,
                    "is_active",
                    Number(item.is_active) === 1 ? 0 : 1
                  )
                }
              />

              <button
                type="button"
                className="afc-btn-danger"
                onClick={() => removeDrink(index)}
                aria-label="Remove item"
              >
                <Trash2 size={15} />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="afc-settings-card">
        <div className="afc-section-number">Event Downpayment</div>

        <div className="afc-settings-row">
          <PriceInput
            label="Event downpayment percentage"
            value={form?.downpayment_percentage ?? 50}
            onChange={(v) => updateFormValue("downpayment_percentage", v)}
            min={1}
            max={100}
            suffix="%"
            helper="This controls how much the customer must pay first for event bookings."
          />
        </div>
      </div>

      <div className="afc-settings-card">
        <div className="afc-section-number afc-inline-title">
          <Calculator size={16} />
          Event Pricing Preview
        </div>

        <div className="afc-settings-row">
          <SelectInput
            label="Preview cup package"
            value={selectedPreviewCupId}
            onChange={setPreviewCupId}
          >
            {activeCups.map((item) => (
              <option
                key={item.id || item._local_id}
                value={item.id || item._local_id}
              >
                {item.quantity} cups
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="Preview menu package"
            value={selectedPreviewMenuId}
            onChange={setPreviewMenuId}
          >
            {activeMenus.map((item) => (
              <option
                key={item.id || item._local_id}
                value={item.id || item._local_id}
              >
                {item.label}
              </option>
            ))}
          </SelectInput>
        </div>

        <div className="afp-booking-summary">
          <div className="afp-booking-row">
            <span>
              {previewCup?.quantity || 0} cups × ₱
              {money(previewCup?.price_per_cup)}
            </span>
            <strong>₱{money(previewBase)}</strong>
          </div>

          <div className="afp-booking-row">
            <span>{previewMenu?.label || "Menu Package"} add-on</span>
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

function PrivateWorkshopPricingEditor({ form, setForm }) {
  const [previewCounts, setPreviewCounts] = useState({});

  const packages = safeArray(form?.packages);

  const activePackages = packages.filter(
    (item) => Number(item.is_active) === 1
  );

  const updateFormValue = (key, value) => {
    setForm((prev) => ({
      ...(prev || {}),
      [key]: value,
    }));
  };

  const updatePackage = (index, key, value) => {
    setForm((prev) => {
      const next = {
        ...(prev || {}),
        packages: safeArray(prev?.packages).map((item) => ({ ...item })),
      };

      if (!next.packages[index]) return next;

      if (key === "sort_order") {
        next.packages[index][key] = integerValue(value);
      } else {
        next.packages[index][key] = value;
      }

      if (key === "label" && !next.packages[index].id) {
        next.packages[index].package_code = makeCode(value);
      }

      return next;
    });
  };

  const addPackage = () => {
    setForm((prev) => {
      const currentPackages = safeArray(prev?.packages);

      return {
        ...(prev || {}),
        packages: [
          ...currentPackages,
          {
            _local_id: `new-private-${Date.now()}`,
            package_code: "",
            label: "",
            price_per_person: 0,
            description: "",
            is_active: 1,
            sort_order: currentPackages.length + 1,
          },
        ],
      };
    });
  };

  const removePackage = (index) => {
    setForm((prev) => {
      const next = {
        ...(prev || {}),
        packages: safeArray(prev?.packages).map((item) => ({ ...item })),
      };

      const item = next.packages[index];

      if (!item) return next;

      if (item.id) {
        item.is_active = 0;
      } else {
        next.packages.splice(index, 1);
      }

      return next;
    });
  };

  const updatePreviewCount = (packageCode, value) => {
    setPreviewCounts((prev) => ({
      ...prev,
      [packageCode]: integerValue(value),
    }));
  };

  const downpaymentPercentage = numberValue(form?.downpayment_percentage || 50);

  const previewTotal = activePackages.reduce((sum, item) => {
    const count = numberValue(previewCounts[item.package_code] || 0);
    return sum + count * numberValue(item.price_per_person);
  }, 0);

  const dueNow = (previewTotal * downpaymentPercentage) / 100;

  return (
    <>
      <div className="afc-settings-card">
        <SectionHeader title="Private Workshop Packages">
          <button type="button" className="afc-btn-secondary" onClick={addPackage}>
            <Plus size={15} />
            Add Package
          </button>
        </SectionHeader>

        <p className="afc-downpayment-preview">
          Add or edit private workshop package prices. Customers can choose how
          many attendees belong to each active package.
        </p>

        {packages.length === 0 ? (
          <div className="afc-loading">
            No private workshop packages found. Click Restore Defaults, then Save
            Changes.
          </div>
        ) : (
          packages.map((item, index) => (
            <div
              className="afc-edit-row afc-edit-row-wide"
              key={item.id || item._local_id || index}
            >
              <TextInput
                label="Package Code"
                value={item.package_code}
                onChange={(v) =>
                  updatePackage(index, "package_code", makeCode(v))
                }
                helper="Example: STANDARD, PREMIUM"
              />

              <TextInput
                label="Label"
                value={item.label}
                onChange={(v) => updatePackage(index, "label", v)}
              />

              <PriceInput
                label="Price Per Person"
                value={item.price_per_person}
                onChange={(v) => updatePackage(index, "price_per_person", v)}
              />

              <TextInput
                label="Description"
                value={item.description}
                onChange={(v) => updatePackage(index, "description", v)}
              />

              <PriceInput
                label="Sort Order"
                value={item.sort_order}
                onChange={(v) => updatePackage(index, "sort_order", v)}
                suffix="#"
                integer
              />

              <div className="afc-row-actions">
                <StatusButton
                  item={item}
                  onToggle={() =>
                    updatePackage(
                      index,
                      "is_active",
                      Number(item.is_active) === 1 ? 0 : 1
                    )
                  }
                />

                <button
                  type="button"
                  className="afc-btn-danger"
                  onClick={() => removePackage(index)}
                aria-label="Remove item"
                >
                  <Trash2 size={15} />
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="afc-settings-card">
        <div className="afc-section-number">Private Workshop Downpayment</div>

        <div className="afc-settings-row">
          <PriceInput
            label="Private workshop downpayment percentage"
            value={form?.downpayment_percentage ?? 50}
            onChange={(v) => updateFormValue("downpayment_percentage", v)}
            min={1}
            max={100}
            suffix="%"
          />
        </div>
      </div>

      <div className="afc-settings-card">
        <div className="afc-section-number afc-inline-title">
          <Calculator size={16} />
          Private Workshop Pricing Preview
        </div>

        <div className="afc-settings-row">
          {activePackages.map((item) => (
            <PriceInput
              key={item.id || item._local_id}
              label={`${item.label} attendees`}
              value={previewCounts[item.package_code] || ""}
              onChange={(v) => updatePreviewCount(item.package_code, v)}
              suffix="people"
              integer
            />
          ))}
        </div>

        <div className="afp-booking-summary">
          {activePackages.map((item) => {
            const count = numberValue(previewCounts[item.package_code] || 0);
            const subtotal = count * numberValue(item.price_per_person);

            return (
              <div className="afp-booking-row" key={item.id || item._local_id}>
                <span>
                  {count} {item.label} × ₱{money(item.price_per_person)}
                </span>
                <strong>₱{money(subtotal)}</strong>
              </div>
            );
          })}

          <div className="afp-booking-row afp-booking-row-total">
            <span>Total Private Workshop Price</span>
            <strong>₱{money(previewTotal)}</strong>
          </div>

          <div className="afp-booking-row">
            <span>Downpayment Due Now ({downpaymentPercentage}%)</span>
            <strong>₱{money(dueNow)}</strong>
          </div>
        </div>
      </div>
    </>
  );
}

function humanizeAuditText(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function auditTargetLabel(value) {
  const key = String(value || "").toLowerCase();

  const labels = {
    event_cup_packages: "Event Cup Packages",
    event_menu_packages: "Event Menu Packages",
    event_drinks: "Event Drinks",
    private_workshop_packages: "Private Workshop Packages",
    system_settings: "System Settings",
  };

  return labels[key] || humanizeAuditText(value || "Pricing Settings");
}

function auditActionLabel(value) {
  const key = String(value || "").toLowerCase();

  if (key.includes("create") || key.includes("add")) return "added";
  if (key.includes("delete") || key.includes("remove")) return "removed";
  if (key.includes("disable") || key.includes("hide")) return "hid";
  if (key.includes("enable") || key.includes("active")) return "enabled";

  return "updated";
}

function parseAuditValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return value;

  let parsed = value;

  for (let i = 0; i < 3; i += 1) {
    if (typeof parsed !== "string") return parsed;

    try {
      parsed = JSON.parse(parsed);
    } catch {
      return parsed;
    }
  }

  return parsed;
}

function formatAuditValue(value) {
  const parsed = parseAuditValue(value);

  if (parsed === null || parsed === undefined || parsed === "") {
    return "Empty";
  }

  if (typeof parsed === "boolean") {
    return parsed ? "Yes" : "No";
  }

  if (typeof parsed === "number") {
    return String(parsed);
  }

  if (typeof parsed === "string") {
    return parsed;
  }

  if (Array.isArray(parsed)) {
    return `${parsed.length} item${parsed.length === 1 ? "" : "s"}`;
  }

  if (typeof parsed === "object") {
    if (parsed.label) return String(parsed.label);
    if (parsed.drink_name) return String(parsed.drink_name);
    if (parsed.package_code) return String(parsed.package_code);
    if (parsed.quantity && parsed.price_per_cup) {
      return `${parsed.quantity} cups at ₱${money(parsed.price_per_cup)}`;
    }

    return JSON.stringify(parsed, null, 2);
  }

  return String(parsed);
}

function buildAuditRows(log) {
  const oldValue = parseAuditValue(log.old_value);
  const newValue = parseAuditValue(log.new_value);

  if (
    oldValue &&
    newValue &&
    typeof oldValue === "object" &&
    typeof newValue === "object" &&
    !Array.isArray(oldValue) &&
    !Array.isArray(newValue)
  ) {
    const hiddenFields = new Set([
      "id",
      "admin_id",
      "created_at",
      "updated_at",
      "reviewed_at",
    ]);

    return Array.from(
      new Set([...Object.keys(oldValue), ...Object.keys(newValue)])
    )
      .filter((field) => !hiddenFields.has(field))
      .filter((field) => {
        return JSON.stringify(oldValue[field]) !== JSON.stringify(newValue[field]);
      })
      .map((field) => ({
        field: humanizeAuditText(field),
        before: formatAuditValue(oldValue[field]),
        after: formatAuditValue(newValue[field]),
      }));
  }

  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
    return [];
  }

  return [
    {
      field: "Record",
      before: formatAuditValue(oldValue),
      after: formatAuditValue(newValue),
    },
  ];
}

function AuditLogs({ logs }) {
  const auditLogs = safeArray(logs);

  return (
    <div className="afc-settings-card">
      <div className="afc-section-number afc-inline-title">
        <History size={16} />
        Pricing Audit Logs
      </div>

      <p className="afc-downpayment-preview">
        This section shows who changed pricing settings and what was changed.
      </p>

      {auditLogs.length === 0 ? (
        <div className="afc-loading">No pricing audit logs yet.</div>
      ) : (
        <div className="afc-audit-list">
          {auditLogs.map((log) => {
            const rows = buildAuditRows(log);
            const adminName = log.admin_name || "Admin";
            const targetLabel = auditTargetLabel(log.target_table);
            const actionLabel = auditActionLabel(log.action_type);

            return (
              <article className="afc-audit-item" key={log.id}>
                <div className="afc-audit-main">
                  <div>
                    <strong>
                      {adminName} {actionLabel} {targetLabel}
                    </strong>

                    <div className="afc-label-hint">
                      {log.created_at || "Date not available"}
                    </div>
                  </div>

                  <span className="afc-audit-pill">
                    {humanizeAuditText(log.action_type || "Update")}
                  </span>
                </div>

                <details className="afc-audit-details">
                  <summary>View changes</summary>

                  {rows.length === 0 ? (
                    <div className="afc-audit-empty">
                      No detailed field changes were recorded for this item.
                    </div>
                  ) : (
                    <div className="afc-audit-change-table">
                      <div className="afc-audit-change-head">
                        <span>Field</span>
                        <span>Before</span>
                        <span>After</span>
                      </div>

                      {rows.map((row, index) => (
                        <div className="afc-audit-change-row" key={`${row.field}-${index}`}>
                          <span>{row.field}</span>
                          <span>{row.before}</span>
                          <span>{row.after}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminForms() {
  const [bookingType, setBookingType] = useState("event_booking");
  const [csrfToken, setCsrfToken] = useState("");
  const [form, setForm] = useState(clone(DEFAULT_EVENT_FORM));
  const [originalForm, setOriginalForm] = useState(clone(DEFAULT_EVENT_FORM));
  const [auditLogs, setAuditLogs] = useState([]);

  const [loadStatus, setLoadStatus] = useState("idle");
  const [saving, setSaving] = useState(false);

  const loading = loadStatus === "loading";

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const hasUnsavedChanges = useMemo(() => {
    if (bookingType === "audit_logs") {
      return false;
    }

    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }, [form, originalForm, bookingType]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!hasUnsavedChanges) return;

      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const normalizeLoadedForm = (type, loadedForm) => {
    if (type === "event_booking") {
      return {
        ...clone(DEFAULT_EVENT_FORM),
        ...(loadedForm || {}),
        cup_packages:
          Array.isArray(loadedForm?.cup_packages) &&
          loadedForm.cup_packages.length > 0
            ? loadedForm.cup_packages
            : clone(DEFAULT_EVENT_FORM.cup_packages),
        menu_packages:
          Array.isArray(loadedForm?.menu_packages) &&
          loadedForm.menu_packages.length > 0
            ? loadedForm.menu_packages
            : clone(DEFAULT_EVENT_FORM.menu_packages),
        drinks:
          Array.isArray(loadedForm?.drinks) && loadedForm.drinks.length > 0
            ? loadedForm.drinks
            : clone(DEFAULT_EVENT_FORM.drinks),
        downpayment_percentage:
          loadedForm?.downpayment_percentage ??
          DEFAULT_EVENT_FORM.downpayment_percentage,
      };
    }

    if (type === "private_workshop") {
      return {
        ...clone(DEFAULT_PRIVATE_FORM),
        ...(loadedForm || {}),
        packages:
          Array.isArray(loadedForm?.packages) && loadedForm.packages.length > 0
            ? loadedForm.packages.map((item, index) => ({
                ...item,
                sort_order: integerValue(item.sort_order || index + 1),
              }))
            : clone(DEFAULT_PRIVATE_FORM.packages),
        downpayment_percentage:
          loadedForm?.downpayment_percentage ??
          DEFAULT_PRIVATE_FORM.downpayment_percentage,
      };
    }

    return loadedForm || {};
  };

  const loadForm = async (type) => {
    setLoadStatus("loading");
    setNotice("");
    setError("");

    try {
      const { data } = await adminApi.get("/admin/get-booking-form.php", {
        params: { type },
      });

      if (data.csrf_token) {
        setCsrfToken(data.csrf_token);
      }

      if (type === "audit_logs") {
        setAuditLogs(data.logs || []);
        setForm({});
        setOriginalForm({});
        return;
      }

      const nextForm = normalizeLoadedForm(type, data.form);

      setForm(clone(nextForm));
      setOriginalForm(clone(nextForm));
    } catch (err) {
      console.error(err);
      setError("Failed to load settings.");

      if (type === "event_booking") {
        setForm(clone(DEFAULT_EVENT_FORM));
        setOriginalForm(clone(DEFAULT_EVENT_FORM));
      }

      if (type === "private_workshop") {
        setForm(clone(DEFAULT_PRIVATE_FORM));
        setOriginalForm(clone(DEFAULT_PRIVATE_FORM));
      }
    } finally {
      setLoadStatus("ready");
    }
  };

  useEffect(() => {
    loadForm(bookingType);
  }, [bookingType]);

  const switchTab = (nextType) => {
    if (nextType === bookingType) return;

    if (hasUnsavedChanges) {
      const proceed = window.confirm(
        "You have unsaved changes. Leave this tab without saving?"
      );

      if (!proceed) return;
    }

    setBookingType(nextType);
  };

  const validate = () => {
    if (bookingType === "event_booking") {
      const downpayment = numberValue(form?.downpayment_percentage);

      if (downpayment < 1 || downpayment > 100) {
        return "Event downpayment percentage must be between 1 and 100.";
      }

      const cupPackages = safeArray(form?.cup_packages);
      const menuPackages = safeArray(form?.menu_packages);
      const drinks = safeArray(form?.drinks);

      const activeCups = cupPackages.filter(
        (item) => Number(item.is_active) === 1
      );

      if (activeCups.length === 0) {
        return "At least one active cup package is required.";
      }

      for (const item of cupPackages) {
        if (Number(item.is_active) !== 1) continue;

        if (!item.quantity || numberValue(item.quantity) <= 0) {
          return "Cup quantity must be greater than 0.";
        }

        if (!Number.isInteger(numberValue(item.quantity))) {
          return "Cup quantity must be a whole number.";
        }

        if (numberValue(item.price_per_cup) < 0) {
          return "Price per cup cannot be negative.";
        }

        if (!Number.isInteger(numberValue(item.sort_order))) {
          return "Cup package sort order must be a whole number.";
        }
      }

      const activeMenus = menuPackages.filter(
        (item) => Number(item.is_active) === 1
      );

      if (activeMenus.length === 0) {
        return "At least one active menu package is required.";
      }

      for (const item of menuPackages) {
        if (Number(item.is_active) !== 1) continue;

        if (!String(item.package_code || "").trim()) {
          return "Menu package code is required.";
        }

        if (!String(item.label || "").trim()) {
          return "Menu package label is required.";
        }

        if (numberValue(item.addon_price) < 0) {
          return "Menu add-on price cannot be negative.";
        }

        if (!Number.isInteger(numberValue(item.included_drinks_count))) {
          return "Included drinks must be a whole number.";
        }

        if (!Number.isInteger(numberValue(item.sort_order))) {
          return "Menu package sort order must be a whole number.";
        }
      }

      const activeDrinks = drinks.filter(
        (item) => Number(item.is_active) === 1
      );

      if (activeDrinks.length === 0) {
        return "At least one active drink is required.";
      }

      for (const item of drinks) {
        if (Number(item.is_active) !== 1) continue;

        if (!String(item.drink_name || "").trim()) {
          return "Drink name is required.";
        }

        if (!Number.isInteger(numberValue(item.sort_order))) {
          return "Drink sort order must be a whole number.";
        }
      }
    }

    if (bookingType === "private_workshop") {
      const downpayment = numberValue(form?.downpayment_percentage);

      if (downpayment < 1 || downpayment > 100) {
        return "Private workshop downpayment percentage must be between 1 and 100.";
      }

      const packages = safeArray(form?.packages);

      const activePackages = packages.filter(
        (item) => Number(item.is_active) === 1
      );

      if (activePackages.length === 0) {
        return "At least one active private workshop package is required.";
      }

      for (const item of packages) {
        if (Number(item.is_active) !== 1) continue;

        if (!String(item.package_code || "").trim()) {
          return "Package code is required.";
        }

        if (!String(item.label || "").trim()) {
          return "Package label is required.";
        }

        if (numberValue(item.price_per_person) < 0) {
          return "Package price cannot be negative.";
        }

        if (!Number.isInteger(numberValue(item.sort_order))) {
          return "Package sort order must be a whole number.";
        }
      }
    }

    return "";
  };

  const sanitizeFormForSave = () => {
    if (bookingType === "event_booking") {
      return {
        ...form,
        downpayment_percentage: toMoneyNumber(form?.downpayment_percentage, 50),
        cup_packages: safeArray(form?.cup_packages).map((item, index) => ({
          ...item,
          quantity: toInteger(item.quantity, 0),
          price_per_cup: toMoneyNumber(item.price_per_cup, 0),
          is_active: Number(item.is_active) === 1 ? 1 : 0,
          sort_order: toInteger(item.sort_order, index + 1),
        })),
        menu_packages: safeArray(form?.menu_packages).map((item, index) => ({
          ...item,
          package_code: makeCode(item.package_code),
          label: String(item.label || "").trim(),
          description: String(item.description || "").trim(),
          addon_price: toMoneyNumber(item.addon_price, 0),
          included_drinks_count: toInteger(item.included_drinks_count, 0),
          is_active: Number(item.is_active) === 1 ? 1 : 0,
          sort_order: toInteger(item.sort_order, index + 1),
        })),
        drinks: safeArray(form?.drinks).map((item, index) => ({
          ...item,
          drink_name: String(item.drink_name || "").trim(),
          category: String(item.category || "matcha").trim(),
          is_signature: Number(item.is_signature) === 1 ? 1 : 0,
          is_active: Number(item.is_active) === 1 ? 1 : 0,
          sort_order: toInteger(item.sort_order, index + 1),
        })),
      };
    }

    if (bookingType === "private_workshop") {
      return {
        ...form,
        downpayment_percentage: toMoneyNumber(form?.downpayment_percentage, 50),
        packages: safeArray(form?.packages).map((item, index) => ({
          ...item,
          package_code: makeCode(item.package_code),
          label: String(item.label || "").trim(),
          price_per_person: toMoneyNumber(item.price_per_person, 0),
          description: String(item.description || "").trim(),
          is_active: Number(item.is_active) === 1 ? 1 : 0,
          sort_order: toInteger(item.sort_order, index + 1),
        })),
      };
    }

    return form;
  };

  const handleSave = async () => {
    setError("");
    setNotice("");

    if (bookingType === "audit_logs") {
      return;
    }

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const payloadForm = sanitizeFormForSave();

      const { data } = await adminApi.post(
        "/admin/save-booking-form.php",
        {
          csrf_token: csrfToken,
          type: bookingType,
          booking_type: bookingType,
          form: payloadForm,
        },
        {
          params: { type: bookingType },
        }
      );

      if (data.success) {
        setNotice("✓ Settings saved successfully.");
        await loadForm(bookingType);
      } else {
        setError(data.error || "Failed to save settings.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    const confirmed = window.confirm(
      "Restore default values? This will not be saved until you click Save."
    );

    if (!confirmed) return;

    if (bookingType === "event_booking") {
      setForm(clone(DEFAULT_EVENT_FORM));
    }

    if (bookingType === "private_workshop") {
      setForm(clone(DEFAULT_PRIVATE_FORM));
    }

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
                onClick={() => switchTab("event_booking")}
              >
                <PartyPopper size={16} />
                Event Booking
              </button>

              <button
                type="button"
                className={`afc-tab ${
                  bookingType === "private_workshop" ? "active" : ""
                }`}
                onClick={() => switchTab("private_workshop")}
              >
                <Coffee size={16} />
                Private Workshop
              </button>

              <button
                type="button"
                className={`afc-tab ${
                  bookingType === "audit_logs" ? "active" : ""
                }`}
                onClick={() => switchTab("audit_logs")}
              >
                <History size={16} />
                Audit Logs
              </button>
            </div>
          </div>

          {bookingType !== "audit_logs" && (
            <div className="afc-toolbar-right">
              <button
                type="button"
                className="afc-btn-secondary"
                onClick={handleResetDefaults}
                disabled={saving || loading}
              >
                <RefreshCw size={16} />
                Restore Defaults
              </button>

              <button
                type="button"
                className="afc-btn-primary"
                onClick={handleSave}
                disabled={saving || loading || !hasUnsavedChanges}
              >
                <Save size={16} />
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        {notice && <div className="admin-notice-react ok">{notice}</div>}
        {error && <div className="admin-notice-react bad">{error}</div>}

        {hasUnsavedChanges && (
          <div className="admin-notice-react warn">
            You have unsaved changes. Click Save Changes before leaving this tab.
          </div>
        )}

        {form?.last_updated && bookingType !== "audit_logs" && (
          <div className="afc-meta-card">
            Last updated: <strong>{form.last_updated}</strong>
            {form.updated_by ? (
              <>
                {" "}
                by <strong>{form.updated_by}</strong>
              </>
            ) : null}
          </div>
        )}

        <div className="afc-settings-card">
          <div className="afc-section-number afc-inline-title">
            <Info size={16} />
            Pricing Logic
          </div>

          {bookingType === "event_booking" && (
            <p className="afc-downpayment-preview">
              Event booking total is calculated as:{" "}
              <strong>Cup Quantity × Price Per Cup + Menu Package Add-on</strong>.
            </p>
          )}

          {bookingType === "private_workshop" && (
            <p className="afc-downpayment-preview">
              Private workshop total is calculated as:{" "}
              <strong>Package Attendees × Package Price Per Person</strong>.
            </p>
          )}

          {bookingType === "audit_logs" && (
            <p className="afc-downpayment-preview">
              Review admin changes made to pricing, packages, and drinks.
            </p>
          )}
        </div>

        {loading ? (
          <div className="afc-loading">Loading settings…</div>
        ) : (
          <>
            {bookingType === "event_booking" && (
              <EventPricingEditor form={form} setForm={setForm} />
            )}

            {bookingType === "private_workshop" && (
              <PrivateWorkshopPricingEditor form={form} setForm={setForm} />
            )}

            {bookingType === "audit_logs" && <AuditLogs logs={auditLogs} />}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
