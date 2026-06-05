import React, { useState, useEffect, useRef } from "react";
import "../assets/css/tabs.css";

const READABLE_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "span",
  "label",
  "button",
  "a",
  "img",
  "input",
  "textarea",
  "select",
  ".voice-readable",
].join(", ");

function getElementReadableText(element) {
  if (!element) return "";

  if (element.tagName === "IMG") {
    return element.getAttribute("alt") || "Image";
  }

  if (element.tagName === "INPUT") {
    const type = element.getAttribute("type") || "text";
    const label =
      element.getAttribute("aria-label") ||
      element.closest("label")?.innerText ||
      document.querySelector(`label[for="${element.id}"]`)?.innerText ||
      element.placeholder ||
      element.name ||
      "Input field";

    if (type === "radio" || type === "checkbox") {
      return `${label} ${element.checked ? "selected" : "not selected"}`;
    }

    return label;
  }

  if (element.tagName === "TEXTAREA") {
    return (
      element.getAttribute("aria-label") ||
      element.closest("label")?.innerText ||
      document.querySelector(`label[for="${element.id}"]`)?.innerText ||
      element.placeholder ||
      element.name ||
      "Text area"
    );
  }

  if (element.tagName === "SELECT") {
    return (
      element.getAttribute("aria-label") ||
      element.closest("label")?.innerText ||
      document.querySelector(`label[for="${element.id}"]`)?.innerText ||
      element.name ||
      "Select field"
    );
  }

  return (
    element.getAttribute("aria-label") ||
    element.innerText ||
    element.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

const TabControl = ({ tabs }) => {
  const [activeTab, setActiveTab] = useState(0);
  const contentRef = useRef(null);

  useEffect(() => {
    const contentArea = contentRef.current;

    if (!contentArea) return;

    const readableElements = contentArea.querySelectorAll(READABLE_SELECTOR);

    readableElements.forEach((element) => {
      if (element.closest(".accessibility-bubble-wrapper")) return;

      const textToRead = getElementReadableText(element);

      if (!textToRead) return;

      element.setAttribute("tabindex", "0");
      element.classList.add("voice-readable");

      if (!element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", textToRead);
      }
    });
  }, [activeTab, tabs]);

  const moveToTab = (index) => {
    setActiveTab(index);

    window.requestAnimationFrame(() => {
      const button = document.getElementById(`tab-button-${index}`);
      button?.focus();
    });
  };

  const handleTabKeyDown = (event, index) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveToTab((index + 1) % tabs.length);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveToTab((index - 1 + tabs.length) % tabs.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      moveToTab(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      moveToTab(tabs.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveTab(index);
    }
  };

  return (
    <div className="tab-container">
      <div className="tab-headers" role="tablist" aria-label="Page tabs">
        {tabs.map((tab, index) => (
          <button
            key={tab.label || index}
            type="button"
            className={`tab-btn ${activeTab === index ? "active" : ""}`}
            onClick={() => setActiveTab(index)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            role="tab"
            aria-selected={activeTab === index}
            aria-controls={`tab-panel-${index}`}
            id={`tab-button-${index}`}
            aria-label={`${tab.label} tab`}
            tabIndex={activeTab === index ? 0 : -1}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        ref={contentRef}
        className="tab-content"
        id="voice-active-tab"
        role="tabpanel"
        aria-labelledby={`tab-button-${activeTab}`}
        tabIndex="0"
        aria-label={`${tabs[activeTab]?.label || "Selected"} content`}
      >
        <div id={`tab-panel-${activeTab}`}>{tabs[activeTab]?.content}</div>
      </div>
    </div>
  );
};

export default TabControl;