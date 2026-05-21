import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../services/api";
import "../assets/css/VoiceControl.css";

const VoiceControl = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Microphone is off.");
  const [pageCommands, setPageCommands] = useState([]);

  // ACCESSIBILITY STATES
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark"
  );
  const [isTabReaderOn, setIsTabReaderOn] = useState(false);

  const recognitionRef = useRef(null);
  const activeFieldRef = useRef(null);
  const isListeningRef = useRef(false);

  const navigate = useNavigate();
  const location = useLocation();

  // DARK MODE EFFECT
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // SCREEN READER BODY CLASS EFFECT
  // This makes the focus outline appear only when Screen Reader is ON.
  useEffect(() => {
    if (isTabReaderOn) {
      document.body.classList.add("screen-reader-on");
    } else {
      document.body.classList.remove("screen-reader-on");
    }

    return () => {
      document.body.classList.remove("screen-reader-on");
    };
  }, [isTabReaderOn]);

  // TAB NAVIGATION TEXT-TO-SPEECH
  useEffect(() => {
    if (!isTabReaderOn) {
      window.speechSynthesis.cancel();
      return;
    }

    const handleFocus = (event) => {
      const el = event.target;

      if (
        el === document.body ||
        el === window ||
        el === document.documentElement
      ) {
        return;
      }

      let textToRead =
        el.getAttribute("aria-label") ||
        el.getAttribute("alt") ||
        el.placeholder ||
        el.value ||
        el.textContent ||
        el.innerText;

      if (
        textToRead &&
        typeof textToRead === "string" &&
        textToRead.trim() !== ""
      ) {
        window.speechSynthesis.cancel();

        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(textToRead.trim());
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          window.speechSynthesis.speak(utterance);
        }, 50);
      }
    };

    document.addEventListener("focus", handleFocus, true);

    return () => {
      document.removeEventListener("focus", handleFocus, true);
      window.speechSynthesis.cancel();
    };
  }, [isTabReaderOn]);

  // SET CONTEXTUAL COMMANDS BASED ON PAGE
  useEffect(() => {
    const path = location.pathname.toLowerCase();

    let commands = [
      "'Read content'",
      "'Stop reading'",
      "'Turn off microphone'",
      "'Dark Mode'",
      "'Light Mode'",
      "'Toggle Screen Reader'",
    ];

    if (path.includes("/day")) {
      commands.push(
        "'Book event'",
        "'Book workshop'",
        "'Events tab'",
        "'Workshops tab'"
      );
    } else if (path.includes("/calendar")) {
      commands.push("'Say a date, example May 20'");
    } else if (path.includes("book")) {
      commands.push(
        "Dictate fields, example 'Full Name'",
        "'Select option'",
        "'Next'"
      );
    } else {
      commands.push("'Calendar'", "'Login'", "'About'");
    }

    setPageCommands(commands);
  }, [location.pathname]);

  // SMART SPEAK FUNCTION
  const speak = (text) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;

    utterance.onstart = () => {
      setStatusMessage("AI is speaking...");
    };

    utterance.onend = () => {
      if (isListeningRef.current) {
        setStatusMessage("Listening continuously... Speak now.");
      } else {
        setStatusMessage("Microphone is off.");
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // SMART TIME PARSER
  const parseTime = (timeStr) => {
    const match = timeStr.match(
      /(\d{1,2})[:\s]?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/i
    );

    if (!match) return null;

    let hr = parseInt(match[1]);
    let min = match[2] || "00";
    let ampm = match[3]
      ? match[3].toLowerCase().replace(/\./g, "")
      : "am";

    if (ampm === "pm" && hr < 12) hr += 12;
    if (ampm === "am" && hr === 12) hr = 0;

    return `${String(hr).padStart(2, "0")}:${min}`;
  };

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // SPEECH RECOGNITION
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatusMessage("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setStatusMessage("Listening continuously... Speak now.");
    };

    recognition.onresult = async (event) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.trim();
      const lowerTranscript = transcript.toLowerCase();
      const cleanTranscript = lowerTranscript.replace(/[^a-z0-9]/g, "");

      setStatusMessage(`Heard: "${transcript}"`);

      const isOnDayPage = location.pathname.includes("/day");

      // THEME & ACCESSIBILITY COMMANDS
      if (
        lowerTranscript.includes("dark mode") ||
        lowerTranscript.includes("night mode")
      ) {
        setIsDarkMode(true);
        speak("Switching to dark mode.");
        return;
      }

      if (
        lowerTranscript.includes("light mode") ||
        lowerTranscript.includes("day mode")
      ) {
        setIsDarkMode(false);
        speak("Switching to light mode.");
        return;
      }

      if (
        lowerTranscript.includes("screen reader") ||
        lowerTranscript.includes("tab reader")
      ) {
        setIsTabReaderOn((prev) => {
          const newState = !prev;
          speak(`Screen reader turned ${newState ? "on" : "off"}.`);
          return newState;
        });
        return;
      }

      // DELETE / CLEAR COMMAND
      if (
        lowerTranscript === "delete" ||
        lowerTranscript === "clear" ||
        lowerTranscript === "clear field" ||
        lowerTranscript === "undo"
      ) {
        const inputElement =
          document.getElementById(activeFieldRef.current) ||
          document.activeElement;

        if (
          inputElement &&
          (inputElement.tagName === "INPUT" ||
            inputElement.tagName === "TEXTAREA")
        ) {
          inputElement.value = "";
          inputElement.dispatchEvent(new Event("input", { bubbles: true }));
          inputElement.dispatchEvent(new Event("change", { bubbles: true }));
          speak("Cleared.");
        } else {
          speak("No active field to clear.");
        }

        return;
      }

      // CONTINUOUS DATA ENTRY
      if (activeFieldRef.current) {
        const inputElement = document.getElementById(activeFieldRef.current);

        if (inputElement) {
          const inputName = (inputElement.name || "").toLowerCase();
          const inputPlaceholder = (
            inputElement.placeholder || ""
          ).toLowerCase();

          if (
            inputName === "full_name" ||
            inputName === "fullname" ||
            inputPlaceholder.includes("full name")
          ) {
            const words = transcript.trim().split(/\s+/);

            if (words.length >= 2) {
              const formattedName = words
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");

              inputElement.value = formattedName;
              inputElement.dispatchEvent(
                new Event("input", { bubbles: true })
              );
              inputElement.dispatchEvent(
                new Event("change", { bubbles: true })
              );

              speak("Full name set.");
              activeFieldRef.current = null;
            } else {
              speak("Please say both your first and last name.");
            }

            return;
          }

          if (
            inputName.includes("phone") ||
            inputPlaceholder.includes("phone") ||
            inputElement.type === "tel"
          ) {
            const digitsOnly = transcript.replace(/\D/g, "");

            if (digitsOnly.length === 11) {
              inputElement.value = digitsOnly;
              inputElement.dispatchEvent(
                new Event("input", { bubbles: true })
              );
              inputElement.dispatchEvent(
                new Event("change", { bubbles: true })
              );

              speak("Phone number set.");
              activeFieldRef.current = null;
            } else {
              speak(
                `You said ${digitsOnly.length} digits. An 11 digit number is required.`
              );
            }

            return;
          }

          if (
            activeFieldRef.current === "email" ||
            inputElement.type === "email" ||
            inputName.includes("email")
          ) {
            inputElement.value = transcript.replace(/\s/g, "").toLowerCase();
            inputElement.dispatchEvent(
              new Event("input", { bubbles: true })
            );
            inputElement.dispatchEvent(
              new Event("change", { bubbles: true })
            );

            speak("Email set.");
            activeFieldRef.current = null;
            return;
          }

          if (
            inputElement.type === "time" ||
            activeFieldRef.current.includes("start_time")
          ) {
            const timeVal = parseTime(lowerTranscript);

            if (timeVal) {
              inputElement.value = timeVal;
              inputElement.dispatchEvent(
                new Event("input", { bubbles: true })
              );
              inputElement.dispatchEvent(
                new Event("change", { bubbles: true })
              );

              speak(`Time set to ${timeVal}`);
              activeFieldRef.current = null;
            }

            return;
          }

          const currentVal = inputElement.value;
          inputElement.value = currentVal
            ? `${currentVal} ${transcript}`
            : transcript;
          inputElement.dispatchEvent(new Event("input", { bubbles: true }));
          inputElement.dispatchEvent(new Event("change", { bubbles: true }));

          return;
        }
      }

      // SMART CHECKBOXES & RADIOS
      const checkables = {
        text: ["text", "txt", "selecttext"],
        call: ["call", "selectcall"],
        viber: ["viber", "selectviber"],
        whatsapp: ["whatsapp", "selectwhatsapp"],
        "50cups": ["50cups", "fiftycups", "select50cups"],
        "75cups": ["75cups", "seventyfivecups"],
        "100cups": ["100cups", "onehundredcups"],
        "150cups": ["150cups", "onehundredfiftycups"],
        "200cups": ["200cups", "twohundredcups"],
        "4menu": ["4menu", "fourmenu", "4menuitems"],
        "6menu": ["6menu", "sixmenu", "6menuitems"],
        "8menu": ["8menu", "eightmenu", "8menuitems"],
        customized: ["customized", "customizedcups"],
        oatmilk: ["oatmilk", "oat", "outmilk"],
        dairymilk: ["dairymilk", "dairy"],
        nonfat: ["nonfat", "nonfatmilk"],
        extrastaff: ["extrastaff", "extraboard"],
        sintra: ["sintra", "sintraboard", "sintraboardsign"],
      };

      for (let [key, terms] of Object.entries(checkables)) {
        if (terms.some((t) => cleanTranscript.includes(t))) {
          const optionLabels = Array.from(document.querySelectorAll("label.opt"));

          const targetLabel = optionLabels.find((label) =>
            label.innerText
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")
              .includes(key)
          );

          if (targetLabel) {
            const input = targetLabel.querySelector("input");

            if (input) input.click();
            else targetLabel.click();

            speak(
              `Selected ${key
                .replace("cups", " cups")
                .replace("menu", " menu")}`
            );
            return;
          }
        }
      }

      // SMART TEXT FIELDS
      if (
        lowerTranscript === "work hours" ||
        lowerTranscript.includes("select work hours")
      ) {
        const startTimeInput = document.querySelector(
          'input[name="start_time"]'
        );

        if (startTimeInput) {
          if (!startTimeInput.id) startTimeInput.id = "voice-id-start-time";

          startTimeInput.focus();
          activeFieldRef.current = startTimeInput.id;

          speak("Work hours selected. Say the start time, like 7 A M.");
          return;
        }
      }

      const formFields = [
        { spoken: "full name", idMatch: "fullname" },
        { spoken: "name", idMatch: "fullname" },
        { spoken: "phone number", idMatch: "phonenumber" },
        { spoken: "phone", idMatch: "phonenumber" },
        { spoken: "email", idMatch: "emailaddress" },
        { spoken: "type of event", idMatch: "typeofevent" },
        { spoken: "event name", idMatch: "eventname" },
        { spoken: "location", idMatch: "location" },
        { spoken: "guests", idMatch: "guests" },
        { spoken: "request", idMatch: "otherrequest" },
        { spoken: "other request", idMatch: "otherrequest" },
      ];

      for (let field of formFields) {
        if (cleanTranscript.includes(field.spoken.replace(/\s/g, ""))) {
          const fieldBlocks = Array.from(document.querySelectorAll(".field"));

          const targetBlock = fieldBlocks.find((block) => {
            const label = block.querySelector(".label");

            return (
              label &&
              label.innerText
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")
                .includes(field.idMatch)
            );
          });

          if (targetBlock) {
            const targetInput = targetBlock.querySelector(
              "input, textarea, select"
            );

            if (targetInput) {
              if (!targetInput.id) targetInput.id = `voice-id-${Date.now()}`;

              targetInput.focus();
              activeFieldRef.current = targetInput.id;

              speak(`${field.spoken} selected. You can dictate freely.`);
              return;
            }
          }
        }
      }

      // ON-PAGE BUTTON CLICKS
      if (
        lowerTranscript === "next" ||
        lowerTranscript.includes("click next") ||
        lowerTranscript.includes("continue")
      ) {
        const btns = Array.from(document.querySelectorAll("button"));
        const nextBtn = btns.find((button) =>
          button.innerText.toLowerCase().includes("next")
        );

        if (nextBtn) {
          speak("Continuing.");
          nextBtn.click();
        }

        return;
      }

      if (
        lowerTranscript.includes("submit login") ||
        lowerTranscript.includes("click login")
      ) {
        const btn = document.getElementById("login-btn");

        if (btn) {
          speak("Logging you in.");
          btn.click();
        }

        return;
      }

      if (lowerTranscript.includes("cancel")) {
        const btns = Array.from(document.querySelectorAll("button"));
        const cancelBtn = btns.find((button) =>
          button.innerText.toLowerCase().includes("cancel")
        );

        if (cancelBtn) {
          speak("Canceling.");
          cancelBtn.click();
        }

        return;
      }

      if (lowerTranscript.includes("book event")) {
        if (isOnDayPage) {
          const btns = Array.from(document.querySelectorAll(".add-pill"));
          const btn = btns.find((button) =>
            button.innerText.toLowerCase().includes("event")
          );

          if (btn) {
            speak("Opening event booking form.");
            btn.click();
          }
        } else {
          speak("You must select a date first.");
          navigate("/calendar");
        }

        return;
      }

      if (lowerTranscript.includes("book workshop")) {
        if (isOnDayPage) {
          const btns = Array.from(document.querySelectorAll(".add-pill"));
          const btn = btns.find((button) =>
            button.innerText.toLowerCase().includes("workshop")
          );

          if (btn) {
            speak("Opening workshop booking form.");
            btn.click();
          }
        } else {
          speak("You must select a date first.");
          navigate("/calendar");
        }

        return;
      }

      // GENERAL NAVIGATION COMMANDS
      if (lowerTranscript.includes("home")) {
        speak("Going home.");
        navigate("/");
        return;
      }

      if (lowerTranscript.includes("about")) {
        speak("Opening About Us.");
        navigate("/about");
        return;
      }

      if (lowerTranscript.includes("login") || lowerTranscript.includes("log in")) {
        speak("Opening Login.");
        navigate("/login");
        return;
      }

      if (lowerTranscript.includes("sign up") || lowerTranscript.includes("register")) {
        speak("Opening Sign Up.");
        navigate("/sign-up");
        return;
      }

      if (lowerTranscript.includes("forgot")) {
        speak("Opening Forgot Password.");
        navigate("/forgot-password");
        return;
      }

      if (
        lowerTranscript.includes("calendar") ||
        lowerTranscript.includes("book now")
      ) {
        speak("Opening the calendar.");
        navigate("/calendar");
        return;
      }

      // SMART DATE LOGIC
      const monthRegex =
        /(january|february|march|april|may|june|july|august|september|october|november|december)/;

      const dayRegex = /(\d{1,2})/;

      const foundMonth = lowerTranscript.match(monthRegex);
      const foundDay = lowerTranscript.match(dayRegex);

      if (foundMonth && foundDay) {
        const monthName = foundMonth[1];
        const dayNum = parseInt(foundDay[1]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentYear = today.getFullYear();

        const monthIndex = [
          "january",
          "february",
          "march",
          "april",
          "may",
          "june",
          "july",
          "august",
          "september",
          "october",
          "november",
          "december",
        ].indexOf(monthName);

        const targetDate = new Date(currentYear, monthIndex, dayNum);

        if (targetDate < today) {
          speak(`Sorry, ${monthName} ${dayNum} is a past date.`);
          return;
        }

        const formattedDate = `${currentYear}-${String(monthIndex + 1).padStart(
          2,
          "0"
        )}-${String(dayNum).padStart(2, "0")}`;

        const targetPath = `/day?date=${formattedDate}&type=both`;

        try {
          const statusRes = await API.get("/calendar/calendar_status.php", {
            params: {
              year: currentYear,
              month: monthIndex + 1,
              type: "both",
            },
          });

          const monthStatus = statusRes.data || {};
          const dayInfo = monthStatus[formattedDate];

          if (dayInfo && dayInfo.status === "FULL") {
            speak(`Sorry, ${monthName} ${dayNum} is fully booked.`);
            return;
          }

          if (dayInfo && dayInfo.status === "BLOCKED") {
            speak(
              `Sorry, ${monthName} ${dayNum} is ${
                dayInfo.reason ? dayInfo.reason : "unavailable"
              }.`
            );
            return;
          }

          await API.get("/auth/check-auth.php");

          speak(`Opening schedule for ${monthName} ${dayNum}.`);
          navigate(targetPath);
        } catch (err) {
          if (err.response?.status === 401 || err.response?.data?.status === "error") {
            speak("Please log in first.");
            navigate(`/login?redirect=${encodeURIComponent(targetPath)}`);
          } else {
            speak("Sorry, I could not check the calendar status.");
          }
        }

        return;
      }

      // READ CONTENT
      if (lowerTranscript.includes("read") || lowerTranscript.includes("content")) {
        const content =
          document.getElementById("voice-active-tab") ||
          document.querySelector(".panel") ||
          document.querySelector(".card") ||
          document.querySelector(".login-card") ||
          document.getElementById("readable-content") ||
          document.body;

        if (content) {
          speak("Reading page content.");

          setTimeout(() => {
            speak(content.innerText);
          }, 1500);
        }

        return;
      }

      // STOP READING
      if (
        lowerTranscript.includes("stop reading") ||
        lowerTranscript.includes("stop talking") ||
        lowerTranscript === "quiet"
      ) {
        window.speechSynthesis.cancel();
        setStatusMessage("Speech stopped.");
        return;
      }

      // STOP MICROPHONE
      if (
        lowerTranscript.includes("stop listening") ||
        lowerTranscript.includes("turn off microphone")
      ) {
        window.speechSynthesis.cancel();
        speak("Microphone turned off.");

        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }

        setIsListening(false);
        return;
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch (e) {
          setIsListening(false);
          setStatusMessage("Microphone dropped.");
        }
      } else {
        setIsListening(false);
        setStatusMessage("Microphone is off.");
      }
    };

    recognitionRef.current = recognition;
  }, [navigate, location]);

  // TOGGLE MICROPHONE
  const toggleMicrophone = () => {
    if (!recognitionRef.current) {
      setStatusMessage("Speech recognition is not available.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      window.speechSynthesis.cancel();

      setIsListening(false);
      setStatusMessage("Microphone is off.");
    } else {
      speak(
        "Microphone is open. You can dictate fields by saying their names, say read content to listen, or say stop reading to silence me."
      );

      try {
        recognitionRef.current.start();
      } catch (error) {
        setStatusMessage("Microphone is already starting.");
      }
    }
  };

  // TOGGLE SCREEN READER
  const toggleScreenReader = () => {
    setIsTabReaderOn((prev) => {
      const newState = !prev;
      speak(`Screen reader turned ${newState ? "on" : "off"}.`);
      return newState;
    });
  };

  // TOGGLE NIGHT MODE
  const toggleNightMode = () => {
    setIsDarkMode((prev) => {
      const newState = !prev;
      speak(`${newState ? "Night mode" : "Light mode"} activated.`);
      return newState;
    });
  };

  return (
    <div
      className="accessibility-bubble-wrapper"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className={`accessibility-menu ${isOpen ? "show" : ""}`}>
        <button
          type="button"
          className={`accessibility-option ${isListening ? "active danger" : ""}`}
          onClick={toggleMicrophone}
        >
          <span className="accessibility-icon">🎤</span>
          <span>{isListening ? "Stop Voice Assistance" : "Voice Assistance"}</span>
        </button>

        <button
          type="button"
          className={`accessibility-option ${isTabReaderOn ? "active" : ""}`}
          onClick={toggleScreenReader}
        >
          <span className="accessibility-icon">
            {isTabReaderOn ? "🔊" : "🔇"}
          </span>
          <span>{isTabReaderOn ? "Screen Reader ON" : "Screen Reader"}</span>
        </button>

        <button
          type="button"
          className={`accessibility-option ${isDarkMode ? "active" : ""}`}
          onClick={toggleNightMode}
        >
          <span className="accessibility-icon">
            {isDarkMode ? "🌙" : "☀️"}
          </span>
          <span>{isDarkMode ? "Night Mode ON" : "Night Mode"}</span>
        </button>

        <div className="accessibility-status">
          <p>{statusMessage}</p>

          {isListening && (
            <div className="accessibility-commands">
              <strong>Try saying:</strong>

              <ul>
                {pageCommands.map((cmd, idx) => (
                  <li key={idx}>{cmd}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`accessibility-main-button ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Accessibility options"
      >
        {isOpen ? "✕" : "♿"}
      </button>
    </div>
  );
};

export default VoiceControl;