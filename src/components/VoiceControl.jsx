import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '../services/api';

const VoiceControl = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Microphone is off.');
  
  const recognitionRef = useRef(null);
  const activeFieldRef = useRef(null); 
  const isListeningRef = useRef(false); 
  
  const navigate = useNavigate();
  const location = useLocation(); 

  // --- SMART SPEAK FUNCTION ---
  const speak = (text) => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    
    utterance.onstart = () => setStatusMessage("AI is speaking...");
    utterance.onend = () => {
      if (isListeningRef.current) setStatusMessage("Listening continuously... (Speak now)");
      else setStatusMessage("Microphone is off.");
    };

    window.speechSynthesis.speak(utterance);
  };

  // --- SMART TIME PARSER ---
  const parseTime = (timeStr) => {
    const match = timeStr.match(/(\d{1,2})[:\s]?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/i);
    if (!match) return null;
    let hr = parseInt(match[1]);
    let min = match[2] || "00";
    let ampm = match[3] ? match[3].toLowerCase().replace(/\./g, '') : "am";
    if (ampm === "pm" && hr < 12) hr += 12;
    if (ampm === "am" && hr === 12) hr = 0;
    return `${String(hr).padStart(2, '0')}:${min}`;
  };

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setStatusMessage("Listening continuously... (Speak now)");
    };

    recognition.onresult = async (event) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.trim();
      const lowerTranscript = transcript.toLowerCase();
      const cleanTranscript = lowerTranscript.replace(/[^a-z0-9]/g, ''); 
      
      setStatusMessage(`Heard: "${transcript}"`);
      const isOnDayPage = location.pathname.includes("/day");
      const isOnBookingPage = location.pathname.includes("book");

      // --- 0. DELETE / CLEAR COMMAND ---
      if (lowerTranscript === "delete" || lowerTranscript === "clear" || lowerTranscript === "clear field" || lowerTranscript === "undo") {
        const inputElement = document.getElementById(activeFieldRef.current) || document.activeElement;
        if (inputElement && (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA')) {
          inputElement.value = '';
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          inputElement.dispatchEvent(new Event('change', { bubbles: true }));
          speak("Cleared.");
        } else {
          speak("No active field to clear.");
        }
        return;
      }

      // --- 1. CONTINUOUS DATA ENTRY & VALIDATION LOGIC ---
      if (activeFieldRef.current) {
        const inputElement = document.getElementById(activeFieldRef.current);
        
        if (inputElement) {
          const inputName = (inputElement.name || "").toLowerCase();
          const inputPlaceholder = (inputElement.placeholder || "").toLowerCase();
          
          // SMART VALIDATION: FULL NAME (Must be 2 words)
          if (inputName === "full_name" || inputName === "fullname" || inputPlaceholder.includes("full name")) {
            const words = transcript.trim().split(/\s+/);
            if (words.length >= 2) {
              // Capitalize first letters automatically
              const formattedName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              inputElement.value = formattedName;
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
              inputElement.dispatchEvent(new Event('change', { bubbles: true }));
              speak("Full name set.");
              activeFieldRef.current = null;
            } else {
              speak("Please say both your first and last name.");
            }
            return;
          }

          // SMART VALIDATION: PHONE NUMBER (Must be 11 digits)
          else if (inputName.includes("phone") || inputPlaceholder.includes("phone") || inputElement.type === "tel") {
            const digitsOnly = transcript.replace(/\D/g, ''); // Removes anything that isn't a number
            if (digitsOnly.length === 11) {
              inputElement.value = digitsOnly;
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
              inputElement.dispatchEvent(new Event('change', { bubbles: true }));
              speak("Phone number set.");
              activeFieldRef.current = null;
            } else {
              speak(`You said ${digitsOnly.length} digits. An 11 digit number is required. Please try again.`);
            }
            return;
          }

          // Handle Emails
          else if (activeFieldRef.current === "email" || inputElement.type === "email" || inputName.includes("email")) {
            inputElement.value = transcript.replace(/\s/g, '').toLowerCase();
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            speak("Email set."); 
            activeFieldRef.current = null;
            return;
          } 
          
          // Handle Work Hours / Time
          else if (inputElement.type === "time" || activeFieldRef.current.includes("start_time")) {
            const timeVal = parseTime(lowerTranscript);
            if (timeVal) {
              inputElement.value = timeVal;
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
              inputElement.dispatchEvent(new Event('change', { bubbles: true }));
              speak(`Time set to ${timeVal}`); 
              activeFieldRef.current = null; 
            }
            return;
          }
          
          // Handle Normal Text (Appends so you can take breaths)
          else {
            const currentVal = inputElement.value;
            inputElement.value = currentVal ? currentVal + " " + transcript : transcript;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      }

      // --- 2. SMART CHECKBOXES & RADIOS ---
      const checkables = {
        "text": ["text", "txt", "selecttext"],
        "call": ["call", "selectcall"],
        "viber": ["viber", "selectviber"],
        "whatsapp": ["whatsapp", "selectwhatsapp"],
        "50cups": ["50cups", "fiftycups", "select50cups"],
        "75cups": ["75cups", "seventyfivecups"],
        "100cups": ["100cups", "onehundredcups"],
        "150cups": ["150cups", "onehundredfiftycups"],
        "200cups": ["200cups", "twohundredcups"],
        "4menu": ["4menu", "fourmenu", "4menuitems"],
        "6menu": ["6menu", "sixmenu", "6menuitems"],
        "8menu": ["8menu", "eightmenu", "8menuitems"],
        "customized": ["customized", "customizedcups"],
        "oatmilk": ["oatmilk", "oat", "outmilk"],
        "dairymilk": ["dairymilk", "dairy"],
        "nonfat": ["nonfat", "nonfatmilk"],
        "extrastaff": ["extrastaff", "extraboard"],
        "sintra": ["sintra", "sintraboard", "sintraboardsign"]
      };

      for (let [key, terms] of Object.entries(checkables)) {
        if (terms.some(t => cleanTranscript.includes(t))) {
          const optionLabels = Array.from(document.querySelectorAll('label.opt'));
          const targetLabel = optionLabels.find(l => l.innerText.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key));
          
          if (targetLabel) {
            const input = targetLabel.querySelector('input');
            if (input) input.click();
            else targetLabel.click();
            
            speak(`Selected ${key.replace('cups', ' cups').replace('menu', ' menu')}`);
            return;
          }
        }
      }

      // --- 3. SMART TEXT FIELDS ---
      if (lowerTranscript === "work hours" || lowerTranscript.includes("select work hours")) {
        const startTimeInput = document.querySelector('input[name="start_time"]');
        if (startTimeInput) {
          if (!startTimeInput.id) startTimeInput.id = `voice-id-start-time`;
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
        { spoken: "other request", idMatch: "otherrequest" }
      ];

      for (let field of formFields) {
        if (cleanTranscript.includes(field.spoken.replace(/\s/g, ''))) {
          const fieldBlocks = Array.from(document.querySelectorAll('.field'));
          const targetBlock = fieldBlocks.find(block => {
            const label = block.querySelector('.label');
            return label && label.innerText.toLowerCase().replace(/[^a-z0-9]/g, '').includes(field.idMatch);
          });

          if (targetBlock) {
            const targetInput = targetBlock.querySelector('input, textarea, select');
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

      // --- 4. ON-PAGE BUTTON CLICKS ---
      if (lowerTranscript === "next" || lowerTranscript.includes("click next") || lowerTranscript.includes("continue")) {
        const btns = Array.from(document.querySelectorAll('button'));
        const nextBtn = btns.find(b => b.innerText.toLowerCase().includes('next'));
        if (nextBtn) { speak("Continuing."); nextBtn.click(); } 
        return;
      }
      else if (lowerTranscript.includes("submit login") || lowerTranscript.includes("click login")) { 
        const btn = document.getElementById("login-btn");
        if (btn) { speak("Logging you in."); btn.click(); } 
        return;
      }
      else if (lowerTranscript.includes("cancel")) { 
        const btns = Array.from(document.querySelectorAll('button'));
        const cancelBtn = btns.find(b => b.innerText.toLowerCase().includes('cancel'));
        if (cancelBtn) { speak("Canceling."); cancelBtn.click(); } 
        return;
      }
      else if (lowerTranscript.includes("book event")) {
        if (isOnDayPage) {
          const btns = Array.from(document.querySelectorAll('.add-pill'));
          const btn = btns.find(b => b.innerText.toLowerCase().includes('event'));
          if (btn) { speak("Opening event booking form."); btn.click(); } 
        } else {
          speak("You must select a date first."); navigate("/calendar");
        }
        return; 
      }
      else if (lowerTranscript.includes("book workshop")) {
        if (isOnDayPage) {
          const btns = Array.from(document.querySelectorAll('.add-pill'));
          const btn = btns.find(b => b.innerText.toLowerCase().includes('workshop'));
          if (btn) { speak("Opening workshop booking form."); btn.click(); } 
        } else {
          speak("You must select a date first."); navigate("/calendar");
        }
        return; 
      }

      if (isOnDayPage && (lowerTranscript.includes("events tab") || lowerTranscript === "event" || lowerTranscript === "events")) {
        const btns = Array.from(document.querySelectorAll('.toggle-btn'));
        const tab = btns.find(b => b.innerText.toLowerCase().includes('events'));
        if (tab) { speak("Switching to events."); tab.click(); return; }
      }
      if (isOnDayPage && (lowerTranscript.includes("workshops tab") || lowerTranscript === "workshop" || lowerTranscript === "workshops")) {
        const btns = Array.from(document.querySelectorAll('.toggle-btn'));
        const tab = btns.find(b => b.innerText.toLowerCase().includes('workshops'));
        if (tab) { speak("Switching to workshops."); tab.click(); return; }
      }

      // --- 5. GENERAL NAVIGATION COMMANDS ---
      if (lowerTranscript.includes("home")) { speak("Going Home"); navigate("/"); }
      else if (lowerTranscript.includes("about")) { speak("Opening About Us"); navigate("/about"); }
      else if (lowerTranscript.includes("login") || lowerTranscript.includes("log in")) { speak("Opening Login"); navigate("/login"); }
      else if (lowerTranscript.includes("sign up") || lowerTranscript.includes("register")) { speak("Opening Sign Up"); navigate("/sign-up"); }
      else if (lowerTranscript.includes("forgot")) { speak("Opening Forgot Password"); navigate("/forgot-password"); }
      else if (lowerTranscript.includes("public workshop")) { speak("Opening Public Workshops."); navigate("/workshop/public"); }
      else if (lowerTranscript.includes("private workshop")) { speak("Opening Private Workshops."); navigate("/workshop/private"); }
      else if (lowerTranscript.includes("workshop") && !isOnBookingPage) { speak("Opening Workshops."); navigate("/workshop"); }
      else if (lowerTranscript.includes("event") && !isOnBookingPage) { speak("Opening Events."); navigate("/event"); }
      else if (lowerTranscript.includes("calendar") || lowerTranscript.includes("book now")) { speak("Opening the calendar."); navigate("/calendar"); }

      // --- 6. SMART DATE LOGIC ---
      const monthRegex = /(january|february|march|april|may|june|july|august|september|october|november|december)/;
      const dayRegex = /(\d{1,2})/;
      const foundMonth = lowerTranscript.match(monthRegex);
      const foundDay = lowerTranscript.match(dayRegex);

      if (foundMonth && foundDay) {
        const monthName = foundMonth[1];
        const dayNum = parseInt(foundDay[1]);
        const today = new Date(); today.setHours(0,0,0,0);
        const currentYear = today.getFullYear();
        const monthIndex = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(monthName);
        const targetDate = new Date(currentYear, monthIndex, dayNum);

        if (targetDate < today) {
          speak(`Sorry, ${monthName} ${dayNum} is a past date.`);
        } else {
          const formattedDate = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const targetPath = `/day?date=${formattedDate}&type=both`;

          try {
            const statusRes = await API.get("/calendar/calendar_status.php", { params: { year: currentYear, month: monthIndex + 1, type: "both" }});
            const monthStatus = statusRes.data || {};
            const dayInfo = monthStatus[formattedDate];

            if (dayInfo && dayInfo.status === "FULL") { speak(`Sorry, ${monthName} ${dayNum} is fully booked.`); return; } 
            else if (dayInfo && dayInfo.status === "BLOCKED") { speak(`Sorry, ${monthName} ${dayNum} is ${dayInfo.reason ? dayInfo.reason : "unavailable"}.`); return; }

            await API.get("/auth/check-auth.php");
            speak(`Opening schedule for ${monthName} ${dayNum}.`);
            navigate(targetPath);
          } catch (err) {
            if (err.response?.status === 401 || err.response?.data?.status === "error") {
              speak("Please log in first.");
              navigate(`/login?redirect=${encodeURIComponent(targetPath)}`);
            } else { speak("Sorry, I could not check the calendar status."); }
          }
        }
      }

      // --- 7. DYNAMIC READ CONTENT ---
      else if (lowerTranscript.includes("read") || lowerTranscript.includes("content")) {
        const content = document.querySelector(".panel") || document.querySelector(".card") || document.querySelector(".login-card") || document.getElementById("readable-content") || document.body;
        if (content) { speak("Reading page content."); setTimeout(() => speak(content.innerText), 1500); } 
      }

      // --- 8. MANUAL MIC STOP ---
      else if (lowerTranscript.includes("stop listening") || lowerTranscript.includes("turn off microphone")) {
        speak("Microphone turned off.");
        recognitionRef.current.stop();
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try { recognition.start(); } catch(e) { setIsListening(false); setStatusMessage("Microphone dropped."); }
      } else {
        setIsListening(false);
        setStatusMessage("Microphone is off.");
      }
    };
    
    recognitionRef.current = recognition;
  }, [navigate, location]); 

  const toggleMicrophone = () => {
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setStatusMessage("Microphone is off.");
    } else {
      recognitionRef.current.start();
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ backgroundColor: '#fff', border: '2px solid #1a4f35', borderRadius: '12px', padding: '20px', marginBottom: '15px', width: '280px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: isOpen ? 'block' : 'none' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#1a4f35' }}>Matcha Assistant</h3>
        <p style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>Say "Clear field" to delete mistakes.</p>
        <button onClick={toggleMicrophone} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: isListening ? '#d9534f' : '#1a4f35', color: 'white', fontWeight: 'bold' }}>
          {isListening ? "Listening continuously... (Speak now)" : "🎤 Push to Speak"}
        </button>
        <p style={{ marginTop: '10px', fontSize: '13px', background: '#f4f4f4', padding: '8px', color: statusMessage.includes("AI is speaking") ? "#1a4f35" : "#333", fontWeight: statusMessage.includes("AI is speaking") ? "bold" : "normal" }}>
          {statusMessage}
        </p>
      </div>
      <button style={{ backgroundColor: '#1a4f35', color: 'white', border: 'none', borderRadius: '50px', padding: '15px 25px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? "✖ Close" : "♿ Voice Access"}
      </button>
    </div>
  );
};

export default VoiceControl;