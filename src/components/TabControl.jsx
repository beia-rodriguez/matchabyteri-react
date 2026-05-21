import React, { useState, useEffect, useRef } from 'react';
import "../assets/css/tabs.css";

const TabControl = ({ tabs }) => {
  const [activeTab, setActiveTab] = useState(0);
  const contentRef = useRef(null);

  useEffect(() => {
    const contentArea = contentRef.current;

    if (!contentArea) return;

    // Make all readable content inside the active tab focusable by Tab key
    const readableElements = contentArea.querySelectorAll(
      'h1, h2, h3, h4, h5, h6, p, li, span, button, a, img'
    );

    readableElements.forEach((element) => {
      element.setAttribute('tabindex', '0');

      // Add aria-label if missing, so your screen reader function can read it clearly
      if (!element.getAttribute('aria-label')) {
        let textToRead = '';

        if (element.tagName === 'IMG') {
          textToRead = element.getAttribute('alt') || 'Image';
        } else {
          textToRead = element.innerText || element.textContent || '';
        }

        if (textToRead.trim() !== '') {
          element.setAttribute('aria-label', textToRead.trim());
        }
      }
    });
  }, [activeTab, tabs]);

  const handleTabKeyDown = (event, index) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActiveTab((prev) => (prev + 1) % tabs.length);
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActiveTab((prev) => (prev - 1 + tabs.length) % tabs.length);
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setActiveTab(index);
    }
  };

  return (
    <div className="tab-container">
      {/* TAB HEADERS */}
      <div className="tab-headers" role="tablist" aria-label="Page tabs">
        {tabs.map((tab, index) => (
          <button
            key={index}
            type="button"
            className={`tab-btn ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            role="tab"
            aria-selected={activeTab === index}
            aria-controls={`tab-panel-${index}`}
            id={`tab-button-${index}`}
            aria-label={`Switch to ${tab.label} tab`}
            tabIndex="0"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div
        ref={contentRef}
        className="tab-content"
        id="voice-active-tab"
        role="tabpanel"
        aria-labelledby={`tab-button-${activeTab}`}
        tabIndex="0"
        aria-label={`${tabs[activeTab].label} content`}
      >
        <div id={`tab-panel-${activeTab}`}>
          {tabs[activeTab].content}
        </div>
      </div>
    </div>
  );
};

export default TabControl;