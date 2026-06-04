import React, { useMemo, useRef, useState } from "react";
import "../assets/css/tabs.css";

function slugify(value) {
  return (
    String(value || "tab")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tab"
  );
}

function getTabId(tab) {
  return String(tab.id || tab.key || tab.value || slugify(tab.label));
}

function makeReadableContent(contentArea) {
  if (!contentArea) return;

  const readableElements = contentArea.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, p, li, span, button, a, img"
  );

  readableElements.forEach((element) => {
    element.setAttribute("tabindex", "0");

    if (!element.getAttribute("aria-label")) {
      let textToRead = "";

      if (element.tagName === "IMG") {
        textToRead = element.getAttribute("alt") || "Image";
      } else {
        textToRead = element.innerText || element.textContent || "";
      }

      if (textToRead.trim() !== "") {
        element.setAttribute("aria-label", textToRead.trim());
      }
    }
  });
}

const TabControl = ({ tabs }) => {
  const normalizedTabs = useMemo(
    () =>
      tabs.map((tab) => ({
        ...tab,
        tabId: getTabId(tab),
      })),
    [tabs]
  );

  const [activeTabId, setActiveTabId] = useState(
    () => normalizedTabs[0]?.tabId || ""
  );
  const contentRef = useRef(null);

  const activeTabStillExists = normalizedTabs.some(
    (tab) => tab.tabId === activeTabId
  );
  const safeActiveTabId = activeTabStillExists
    ? activeTabId
    : normalizedTabs[0]?.tabId || "";

  const activeTabIndex = normalizedTabs.findIndex(
    (tab) => tab.tabId === safeActiveTabId
  );
  const safeActiveIndex = activeTabIndex >= 0 ? activeTabIndex : 0;
  const activeTab = normalizedTabs[safeActiveIndex];

  const handleContentRef = (node) => {
    contentRef.current = node;
    makeReadableContent(node);
  };

  const handleTabKeyDown = (event, tabId) => {
    if (!normalizedTabs.length) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = (safeActiveIndex + 1) % normalizedTabs.length;
      setActiveTabId(normalizedTabs[nextIndex].tabId);
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const previousIndex =
        (safeActiveIndex - 1 + normalizedTabs.length) % normalizedTabs.length;
      setActiveTabId(normalizedTabs[previousIndex].tabId);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveTabId(tabId);
    }
  };

  if (!activeTab) {
    return null;
  }

  return (
    <div className="tab-container">
      <div className="tab-headers" role="tablist" aria-label="Page tabs">
        {normalizedTabs.map((tab) => {
          const isActive = activeTab.tabId === tab.tabId;
          const buttonId = `tab-button-${tab.tabId}`;
          const panelId = `tab-panel-${tab.tabId}`;

          return (
            <button
              key={tab.tabId}
              type="button"
              className={`tab-btn ${isActive ? "active" : ""}`}
              onClick={() => setActiveTabId(tab.tabId)}
              onKeyDown={(event) => handleTabKeyDown(event, tab.tabId)}
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              id={buttonId}
              aria-label={`Switch to ${tab.label} tab`}
              tabIndex={0}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        ref={handleContentRef}
        className="tab-content"
        id="voice-active-tab"
        role="tabpanel"
        aria-labelledby={`tab-button-${activeTab.tabId}`}
        tabIndex={0}
        aria-label={`${activeTab.label} content`}
      >
        <div id={`tab-panel-${activeTab.tabId}`}>{activeTab.content}</div>
      </div>
    </div>
  );
};

export default TabControl;
