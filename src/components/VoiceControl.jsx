import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useReducer,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Accessibility,
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Type,
  Plus,
  Minus,
  HelpCircle,
  MoveDiagonal,
  ListChecks,
  MousePointerClick,
  PauseCircle,
  ChevronDown,
} from "lucide-react";
import API from "../services/api";
import "../assets/css/VoiceControl.css";

const HOME_PAGE_PATH = "/";
const ABOUT_PAGE_PATH = "/about";
const EVENT_PAGE_PATH = "/event";
const CALENDAR_PAGE_PATH = "/calendar";
const PROFILE_PAGE_PATH = "/profile";
const PUBLIC_WORKSHOP_PATH = "/public-workshops";
const PRIVATE_WORKSHOP_PATH = "/private-workshop";

function normalizeText(text = "") {
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
}


function includesAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

function setNativeInputValue(input, value) {
  if (!input) return;

  const proto =
    input.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;

  const valueSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

  if (valueSetter) {
    valueSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function getReadableText(el) {
  if (!el) return "";

  const aria = el.getAttribute?.("aria-label");
  const alt = el.getAttribute?.("alt");
  const title = el.getAttribute?.("title");

  let text =
    aria ||
    alt ||
    title ||
    el.placeholder ||
    el.value ||
    el.innerText ||
    el.textContent ||
    "";

  text = String(text).replace(/\s+/g, " ").trim();

  if (text.length > 280) {
    text = text.slice(0, 280) + "...";
  }

  return text;
}

function getVisibleElements(selector) {
  return Array.from(document.querySelectorAll(selector)).filter((el) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  });
}

function getMainContent() {
  return (
    document.getElementById("voice-active-tab") ||
    document.getElementById("readable-content") ||
    document.querySelector("main") ||
    document.querySelector(".page") ||
    document.querySelector(".panel") ||
    document.querySelector(".card") ||
    document.querySelector(".login-card")
  );
}

function getPageName() {
  const pathname = window.location.pathname;

  const pageNameFromRoute = {
    "/": "Home",
    "/about": "About Us",
    "/event": "Event",
    "/calendar": "Calendar",
    "/profile": "Profile",
    "/my-booking": "My Booking",
    "/public-workshops": "Public Workshop",
    "/private-workshop": "Private Workshop",
    "/login": "Login",
    "/sign-up": "Sign Up",
    "/forgot-password": "Forgot Password",
  };

  if (pageNameFromRoute[pathname]) {
    return pageNameFromRoute[pathname];
  }

  const customPageName =
    document.querySelector("[data-voice-page-name]")?.getAttribute(
      "data-voice-page-name"
    ) ||
    document.querySelector("[data-page-title]")?.getAttribute(
      "data-page-title"
    );

  if (customPageName) {
    return customPageName.replace(/\s+/g, " ").trim();
  }

  const title =
    document.querySelector("h1")?.innerText ||
    document.querySelector(".page-title")?.innerText ||
    document.querySelector(".profile-title")?.innerText ||
    document.querySelector(".my-booking-title")?.innerText ||
    document.querySelector(".date-title")?.innerText ||
    document.querySelector(".title")?.innerText ||
    document.querySelector(".section-title")?.innerText ||
    document.title ||
    "current";

  return String(title).replace(/\s+/g, " ").trim();
}

/*
  Only form/booking flow should read form questions automatically.
  Normal pages only say: "Voice assistance is on. This is ___ page."
*/
function isBookingPage(pathname = "") {
  return (
    pathname.includes("/day") ||
    pathname.includes("/booking") ||
    pathname.includes("/add-booking")
  );
}

function getFieldErrorText(field) {
  if (!field) return "";

  const describedBy = field.getAttribute("aria-describedby");

  if (describedBy) {
    const errorEl = document.getElementById(describedBy);
    if (errorEl?.innerText?.trim()) {
      return errorEl.innerText.replace(/\s+/g, " ").trim();
    }
  }

  const wrapper =
    field.closest(".field") ||
    field.closest(".form-group") ||
    field.closest(".input-group") ||
    field.parentElement;

  const errorText =
    wrapper?.querySelector(
      ".error, .field-error, .invalid-feedback, .text-danger, [role='alert']"
    )?.innerText || "";

  return errorText.replace(/\s+/g, " ").trim();
}

function findFirstFormError() {
  const invalidField = document.querySelector(
    "input[aria-invalid='true'], textarea[aria-invalid='true'], select[aria-invalid='true'], input.is-invalid, textarea.is-invalid, select.is-invalid, input.invalid, textarea.invalid, select.invalid"
  );

  if (invalidField) {
    return {
      field: invalidField,
      message: getFieldErrorText(invalidField) || "This field has an error.",
    };
  }

  const errorEl = document.querySelector(
    ".error, .field-error, .invalid-feedback, .text-danger, [role='alert']"
  );

  if (!errorEl) return null;

  const wrapper =
    errorEl.closest(".field") ||
    errorEl.closest(".form-group") ||
    errorEl.closest(".input-group") ||
    errorEl.parentElement;

  const field = wrapper?.querySelector("input, textarea, select") || null;

  return {
    field,
    message: errorEl.innerText.replace(/\s+/g, " ").trim(),
  };
}

function capitalizeWords(text = "") {
  const words = [];

  for (const word of String(text).trim().split(/\s+/)) {
    if (!word) continue;
    words.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  return words.join(" ");
}

function spokenLettersToWord(text = "") {
  const letterMap = {
    a: "a",
    ay: "a",
    b: "b",
    bee: "b",
    be: "b",
    we: "b",
    wee: "b",
    c: "c",
    see: "c",
    sea: "c",
    d: "d",
    dee: "d",
    e: "e",
    ee: "e",
    f: "f",
    ef: "f",
    g: "g",
    gee: "g",
    h: "h",
    age: "h",
    i: "i",
    eye: "i",
    j: "j",
    jay: "j",
    k: "k",
    kay: "k",
    l: "l",
    el: "l",
    m: "m",
    em: "m",
    n: "n",
    en: "n",
    o: "o",
    oh: "o",
    p: "p",
    pee: "p",
    q: "q",
    queue: "q",
    r: "r",
    are: "r",
    s: "s",
    es: "s",
    t: "t",
    tea: "t",
    u: "u",
    you: "u",
    v: "v",
    vee: "v",
    w: "w",
    doubleyou: "w",
    doubleu: "w",
    x: "x",
    ex: "x",
    y: "y",
    why: "y",
    z: "z",
    zee: "z",
    zed: "z",
  };

  const rawWords = String(text)
    .toLowerCase()
    .replace(/@/g, " at ")
    .replace(/\./g, " dot ")
    .replace(/-/g, " dash ")
    .replace(/_/g, " underscore ")
    .replace(/\bspell\b/g, "")
    .replace(/\bspelling\b/g, "")
    .replace(/\btype\b/g, "")
    .replace(/\bletter\b/g, "")
    .replace(/\bletters\b/g, "")
    .trim()
    .split(/\s+/)
    .map((word) => normalizeText(word))
    .filter(Boolean);

  if (!rawWords.length) return null;

  const isUpperCommand = (word = "") => {
    return (
      word === "upper" ||
      word === "uppercase" ||
      word === "capital" ||
      word === "cap" ||
      word === "caps"
    );
  };

  const isLowerCommand = (word = "") => {
    return word === "lower" || word === "lowercase";
  };

  const hasUpperCommand = rawWords.some((word) => isUpperCommand(word));
  const hasLowerCommand = rawWords.some((word) => isLowerCommand(word));
  const shouldUpperAll = hasUpperCommand && rawWords.includes("all");
  const shouldLowerAll = hasLowerCommand && rawWords.includes("all");

  const convertToken = (word = "") => {
    const clean = normalizeText(word);

    if (!clean) return "";

    if (clean === "space") return " ";
    if (clean === "dash" || clean === "hyphen" || clean === "minus") return "-";
    if (clean === "underscore") return "_";
    if (clean === "dot" || clean === "period" || clean === "point") return ".";
    if (clean === "at" || clean === "add" || clean === "ad" || clean === "alt") return "@";
    if (letterMap[clean]) return letterMap[clean];
    if (/^\d+$/.test(clean)) return clean;
    if (/^[a-z0-9]+$/.test(clean)) return clean;

    return null;
  };

  const capitalizeFirst = (value = "") => {
    if (!value) return value;

    const firstAlphaIndex = value.search(/[a-z]/i);

    if (firstAlphaIndex < 0) return value;

    return `${value.slice(0, firstAlphaIndex)}${value
      .charAt(firstAlphaIndex)
      .toUpperCase()}${value.slice(firstAlphaIndex + 1)}`;
  };

  const lowerFirst = (value = "") => {
    if (!value) return value;

    const firstAlphaIndex = value.search(/[a-z]/i);

    if (firstAlphaIndex < 0) return value;

    return `${value.slice(0, firstAlphaIndex)}${value
      .charAt(firstAlphaIndex)
      .toLowerCase()}${value.slice(firstAlphaIndex + 1)}`;
  };

  const converted = [];
  let pendingCase = "";

  for (let index = 0; index < rawWords.length; index += 1) {
    const clean = rawWords[index];
    const nextClean = rawWords[index + 1] || "";

    if (!clean) continue;

    if (clean === "all") continue;

    if (clean === "case" && (pendingCase || rawWords[index - 1] === "upper" || rawWords[index - 1] === "lower")) {
      continue;
    }

    if (isUpperCommand(clean)) {
      if (clean === "upper" && nextClean === "case") {
        index += 1;
      }

      if (!shouldUpperAll) {
        pendingCase = "upper-first";
      }

      continue;
    }

    if (isLowerCommand(clean)) {
      if (clean === "lower" && nextClean === "case") {
        index += 1;
      }

      if (!shouldLowerAll) {
        pendingCase = "lower-first";
      }

      continue;
    }

    let value = convertToken(clean);

    if (value === null) return null;

    if (pendingCase === "upper-first") {
      value = capitalizeFirst(value);
      pendingCase = "";
    } else if (pendingCase === "lower-first") {
      value = lowerFirst(value);
      pendingCase = "";
    }

    converted.push(value);
  }

  if (!converted.length) return null;

  const joinedValue = converted.join("").replace(/\s+/g, "");

  if (shouldUpperAll) return joinedValue.toUpperCase();
  if (shouldLowerAll) return joinedValue.toLowerCase();

  return joinedValue;
}

function formatDictatedText(text = "") {
  const spelled = spokenLettersToWord(text);

  if (spelled) return spelled;

  return String(text).trim();
}

function getSpelledSpeechPreview(text = "") {
  const rawText = String(text || "").trim();

  if (!rawText) return null;

  const spelledValue = spokenLettersToWord(rawText);

  if (!spelledValue) return null;

  const cleanedSpokenLetters = rawText
    .toLowerCase()
    .replace(/\bspell\b/g, "")
    .replace(/\bspelling\b/g, "")
    .replace(/\btype\b/g, "")
    .replace(/\bletter\b/g, "")
    .replace(/\bletters\b/g, "")
    .replace(/\bupper case\b/g, "uppercase")
    .replace(/\blower case\b/g, "lowercase")
    .replace(/\s+/g, " ")
    .trim();

  return {
    spelledLetters: cleanedSpokenLetters,
    connectedWord: spelledValue,
  };
}

function isEmailFieldElement(inputElement, fieldIdentity = "", inputName = "") {
  return (
    activeElementType(inputElement) === "email" ||
    inputName.includes("email") ||
    fieldIdentity.includes("email") ||
    fieldIdentity.includes("emailaddress")
  );
}

function activeElementType(inputElement) {
  return String(inputElement?.type || "").toLowerCase();
}

function formatEmailDictation(text = "") {
  const spelled = spokenLettersToWord(text);

  if (spelled) {
    return spelled.replace(/\s+/g, "").toLowerCase();
  }

  return String(text || "")
    .toLowerCase()
    .replace(/\b(at|add|ad|alt)\b/g, " @ ")
    .replace(/\b(dot|period|point)\b/g, " . ")
    .replace(/\b(dash|hyphen)\b/g, " - ")
    .replace(/\bunderscore\b/g, " _ ")
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*_\s*/g, "_")
    .replace(/\s+/g, "")
    .trim();
}

function formatEmailForSpeech(value = "") {
  return String(value || "")
    .replace(/@/g, " at ")
    .replace(/\./g, " dot ")
    .replace(/_/g, " underscore ")
    .replace(/-/g, " dash ")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseBestTranscript(alternatives = []) {
  const cleanAlternatives = alternatives
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!cleanAlternatives.length) return "";

  const spelledAlternative = cleanAlternatives.find((item) =>
    Boolean(spokenLettersToWord(item))
  );

  return spelledAlternative || cleanAlternatives[0];
}

function formatNumbersForSpeech(text = "") {
  const digitWords = {
    0: "zero",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
  };

  return String(text).replace(/\d+(?:[.,:/-]\d+)*/g, (match) => {
    const digitsOnly = match.replace(/\D/g, "");

    if (!digitsOnly) return match;

    const spokenDigits = [];

    for (const digit of digitsOnly) {
      spokenDigits.push(digitWords[digit] || digit);
    }

    return spokenDigits.join(" ");
  });
}

function getFieldLabelText(el) {
  if (!el) return "this question";

  const id = el.id || "";

  return (
    (id && document.querySelector(`label[for="${id}"]`)?.innerText) ||
    el.closest(".field")?.querySelector("label, .label")?.innerText ||
    el.closest(".form-group")?.querySelector("label, .label")?.innerText ||
    el.closest(".input-group")?.querySelector("label, .label")?.innerText ||
    el.getAttribute("aria-label") ||
    el.placeholder ||
    el.name ||
    "this question"
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getCurrentFormFields() {
  const fields = [];

  for (const el of getVisibleElements("input, textarea, select")) {
    if (el.closest(".accessibility-bubble-wrapper")) continue;
    if (el.type === "hidden" || el.disabled || el.readOnly) continue;

    fields.push(el);
  }

  return fields;
}

function findFieldByKeywords(keywords = []) {
  const fields = getCurrentFormFields();
  const normalizedKeywords = [];

  for (const keyword of keywords) {
    normalizedKeywords.push(normalizeText(keyword));
  }

  return fields.find((el) => {
    const id = el.id || "";
    const name = el.name || "";
    const placeholder = el.placeholder || "";
    const aria = el.getAttribute("aria-label") || "";
    const labelText = getFieldLabelText(el);

    const combined = normalizeText(
      `${id} ${name} ${placeholder} ${aria} ${labelText}`
    );

    return normalizedKeywords.some((keyword) => combined.includes(keyword));
  });
}

function selectOptionByVoice(key, speak) {
  const normalizedKey = normalizeText(key);

  const labels = getVisibleElements("label, button, .opt, .option, .choice");

  const target = labels.find((el) => {
    if (el.closest(".accessibility-bubble-wrapper")) return false;

    const text = normalizeText(getReadableText(el));

    return text.includes(normalizedKey);
  });

  if (target) {
    const input = target.querySelector?.("input");

    if (input) input.click();
    else target.click();

    if (speak) speak(`Selected ${key}.`);
    return true;
  }

  return false;
}

const CHECKABLE_OPTIONS = [
  { key: "text", termPattern: /selecttext|choosetext|textmessage/, labelPattern: /text/ },
  { key: "call", termPattern: /selectcall|choosecall|callme/, labelPattern: /call/ },
  { key: "viber", termPattern: /selectviber|chooseviber|viber/, labelPattern: /viber/ },
  {
    key: "whatsapp",
    termPattern: /selectwhatsapp|choosewhatsapp|whatsapp|whatsup/,
    labelPattern: /whatsapp/,
  },
  { key: "50cups", termPattern: /50cups|fiftycups|select50cups/, labelPattern: /50cups/ },
  { key: "75cups", termPattern: /75cups|seventyfivecups/, labelPattern: /75cups/ },
  { key: "100cups", termPattern: /100cups|onehundredcups/, labelPattern: /100cups/ },
  { key: "150cups", termPattern: /150cups|onehundredfiftycups/, labelPattern: /150cups/ },
  { key: "200cups", termPattern: /200cups|twohundredcups/, labelPattern: /200cups/ },
  { key: "4menu", termPattern: /4menu|fourmenu|4menuitems/, labelPattern: /4menu/ },
  { key: "6menu", termPattern: /6menu|sixmenu|6menuitems/, labelPattern: /6menu/ },
  { key: "8menu", termPattern: /8menu|eightmenu|8menuitems/, labelPattern: /8menu/ },
  { key: "customized", termPattern: /customized|customizedcups/, labelPattern: /customized/ },
  { key: "oatmilk", termPattern: /oatmilk|oat|outmilk/, labelPattern: /oatmilk/ },
  { key: "dairymilk", termPattern: /dairymilk|dairy/, labelPattern: /dairymilk/ },
  { key: "nonfat", termPattern: /nonfat|nonfatmilk/, labelPattern: /nonfat/ },
  { key: "extrastaff", termPattern: /extrastaff|extraboard/, labelPattern: /extrastaff/ },
  { key: "sintra", termPattern: /sintra|sintraboard|sintraboardsign/, labelPattern: /sintra/ },
];

const FORM_FIELDS = [
  {
    spoken: "full name",
    keywords: ["fullname", "full name", "name"],
  },
  {
    spoken: "phone number",
    keywords: ["phonenumber", "phone number", "phone", "mobile", "contact"],
  },
  {
    spoken: "email",
    keywords: ["emailaddress", "email address", "email"],
  },
  {
    spoken: "text",
    keywords: ["text"],
  },
  {
    spoken: "viber",
    keywords: ["viber"],
  },
  {
    spoken: "call",
    keywords: ["call"],
  },
  {
    spoken: "whatsapp",
    keywords: ["whatsapp", "whats app", "whatsup"],
  },
  {
    spoken: "work hours",
    keywords: ["workhours", "workinghours", "work hours", "hours"],
  },
  {
    spoken: "type of event",
    keywords: ["typeofevent", "eventtype", "type of event", "event category", "category"],
  },
  {
    spoken: "event name",
    keywords: ["eventname", "event name"],
  },
  {
    spoken: "location",
    keywords: ["location", "venue", "address"],
  },
  {
    spoken: "estimated number of guests",
    keywords: ["estimatednumberofguest", "estimatednumberofguests", "guests", "guest", "numberofguest"],
  },
  {
    spoken: "request",
    keywords: ["otherrequest", "other request", "request", "message", "notes"],
  },
  {
    spoken: "other request",
    keywords: ["otherrequest", "other request", "request", "message", "notes"],
  },
];

const FORM_FIELD_COMMAND_MAP = new Map();

for (const field of FORM_FIELDS) {
  const command = normalizeText(field.spoken);
  FORM_FIELD_COMMAND_MAP.set(command, field);
  FORM_FIELD_COMMAND_MAP.set(`select${command}`, field);
}

export default function VoiceControl() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [voiceUiState, setVoiceUiState] = useReducer(
    (current, update) => ({
      ...current,
      ...(typeof update === "function" ? update(current) : update),
    }),
    {
      isOpen: false,
      showTools: false,
      showShortcuts: false,
      isListening: false,
      isHearing: false,
      statusMessage: "Microphone is off.",
    }
  );

  const {
    isOpen,
    showTools,
    showShortcuts,
    isListening,
    isHearing,
    statusMessage,
  } = voiceUiState;

  const setIsOpen = useCallback((value) => {
    setVoiceUiState((current) => ({
      isOpen: typeof value === "function" ? value(current.isOpen) : value,
    }));
  }, []);

  const setShowTools = useCallback((value) => {
    setVoiceUiState((current) => ({
      showTools: typeof value === "function" ? value(current.showTools) : value,
    }));
  }, []);

  const setShowShortcuts = useCallback((value) => {
    setVoiceUiState((current) => ({
      showShortcuts:
        typeof value === "function" ? value(current.showShortcuts) : value,
    }));
  }, []);

  const setIsListening = useCallback((value) => {
    setVoiceUiState((current) => ({
      isListening:
        typeof value === "function" ? value(current.isListening) : value,
    }));
  }, []);

  const setIsHearing = useCallback((value) => {
    setVoiceUiState((current) => ({
      isHearing: typeof value === "function" ? value(current.isHearing) : value,
    }));
  }, []);

  const setStatusMessage = useCallback((value) => {
    setVoiceUiState((current) => ({
      statusMessage:
        typeof value === "function" ? value(current.statusMessage) : value,
    }));
  }, []);

  const [isTabReaderOn, setIsTabReaderOn] = useState(
    () => localStorage.getItem("tabReader") === "on"
  );

  const [textScale, setTextScale] = useState(() => {
    const saved = Number(localStorage.getItem("accessTextScale") || 100);
    return Number.isFinite(saved) ? saved : 100;
  });

  const [position, setPosition] = useState(() => {
    return localStorage.getItem("accessButtonPosition") || "right";
  });

  const recognitionRef = useRef(null);
  const activeFieldRef = useRef(null);
  const isListeningRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const spacePressedRef = useRef(false);
  const lastSpokenRef = useRef("");
  const pendingCancelRef = useRef(null);

  const speechQueueRef = useRef([]);
  const speakingIndexRef = useRef(0);
  const lastHelpSpokenAtRef = useRef(0);
  const lastInstructionSpokenAtRef = useRef(0);
  const lastTranscriptRef = useRef({ text: "", time: 0 });
  const hearingTimeoutRef = useRef(null);
  const recognitionRestartTimerRef = useRef(null);

  const isAssistantSpeakingRef = useRef(false);
  const pauseRecognitionForSpeechRef = useRef(false);
  const resumeMicAfterSpeechRef = useRef(false);

  const recognitionActiveRef = useRef(false);
  const recognitionStartingRef = useRef(false);
  const keepListeningRef = useRef(false);
  const manualStopRef = useRef(false);
  const noSpeechRetryRef = useRef(0);
  const lastRecognitionStartRef = useRef(0);
  const activeQuestionIndexRef = useRef(-1);

  const pendingAnswerRef = useRef(null);
  const ignoreVoiceUntilRef = useRef(0);
  const lastSpokenByAssistantRef = useRef("");
  const lastAssistantMessageRef = useRef("");

  const pointerHoldToTalkRef = useRef(false);

  const splitSpeechText = useCallback((text, maxLength = 160) => {
    const cleanText = String(text || "").replace(/\s+/g, " ").trim();

    if (!cleanText) return [];

    const sentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [
      cleanText,
    ];

    const chunks = [];
    let current = "";

    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();

      if (!trimmed) return;

      if ((current + " " + trimmed).trim().length <= maxLength) {
        current = (current + " " + trimmed).trim();
      } else {
        if (current) chunks.push(current);
        current = trimmed;
      }
    });

    if (current) chunks.push(current);

    return chunks;
  }, []);

  const clearHearingTimer = useCallback(() => {
    if (hearingTimeoutRef.current) {
      clearTimeout(hearingTimeoutRef.current);
      hearingTimeoutRef.current = null;
    }
  }, []);

  const markHearing = useCallback(() => {
    setIsHearing(true);
    clearHearingTimer();

    hearingTimeoutRef.current = window.setTimeout(() => {
      setIsHearing(false);
    }, 900);
  }, [clearHearingTimer, setIsHearing]);

  const startRecognitionSafely = useCallback(
    (message = "Listening...", attempt = 0) => {
      if (!recognitionRef.current) {
        setStatusMessage(
          "Voice assistance is not supported in this browser. Please use Chrome or Edge."
        );
        return;
      }

      if (isAssistantSpeakingRef.current || pauseRecognitionForSpeechRef.current) {
        return;
      }

      if (Date.now() < ignoreVoiceUntilRef.current) {
        return;
      }

      if (recognitionActiveRef.current || recognitionStartingRef.current) {
        setIsListening(true);
        setStatusMessage(message);
        return;
      }

      const now = Date.now();

      if (now - lastRecognitionStartRef.current < 120) {
        return;
      }

      lastRecognitionStartRef.current = now;
      recognitionStartingRef.current = true;
      keepListeningRef.current = true;
      manualStopRef.current = false;
      shouldRestartRef.current = true;

      setIsListening(true);
      setIsHearing(true);
      setStatusMessage(message);

      try {
        recognitionRef.current.start();
      } catch {
        recognitionStartingRef.current = false;

        if (attempt < 3) {
          if (recognitionRestartTimerRef.current) {
            clearTimeout(recognitionRestartTimerRef.current);
          }

          recognitionRestartTimerRef.current = window.setTimeout(() => {
            startRecognitionSafely(message, attempt + 1);
          }, 650);

          return;
        }

        setStatusMessage(
          "Microphone is active, but speech recognition did not start properly."
        );
      }
    },
    [setIsHearing, setIsListening, setStatusMessage]
  );

  const speak = useCallback(
    (text, options = {}) => {
      const speechReadyText = formatNumbersForSpeech(text);
      const chunks = splitSpeechText(speechReadyText, options.maxLength || 160);

      if (!chunks.length) return;

      lastAssistantMessageRef.current = String(text || "").trim();
      lastSpokenByAssistantRef.current = String(text || "").toLowerCase();
      ignoreVoiceUntilRef.current = Date.now() + 1200;

      const shouldResumeMic =
        options.startMicAfterSpeech === true ||
        (keepListeningRef.current &&
          !spacePressedRef.current &&
          !manualStopRef.current);

      if (options.startMicAfterSpeech === true) {
        keepListeningRef.current = true;
        manualStopRef.current = false;
        shouldRestartRef.current = true;
      }

      resumeMicAfterSpeechRef.current = shouldResumeMic;

      pauseRecognitionForSpeechRef.current = true;
      shouldRestartRef.current = false;

      if (recognitionRef.current && recognitionActiveRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore stop error
        }
      }

      setIsHearing(false);
      window.speechSynthesis.cancel();

      speechQueueRef.current = chunks;
      speakingIndexRef.current = 0;
      isAssistantSpeakingRef.current = true;

      const resumeMicIfNeeded = () => {
        isAssistantSpeakingRef.current = false;
        pauseRecognitionForSpeechRef.current = false;
        ignoreVoiceUntilRef.current = Date.now() + 900;

        if (
          resumeMicAfterSpeechRef.current &&
          keepListeningRef.current &&
          !manualStopRef.current
        ) {
          resumeMicAfterSpeechRef.current = false;
          shouldRestartRef.current = true;

          window.setTimeout(() => {
            startRecognitionSafely("Listening...");
          }, 900);
        } else {
          setStatusMessage(
            isListeningRef.current ? "Listening..." : "Microphone is off."
          );
        }
      };

      const speakNext = () => {
        const currentText = speechQueueRef.current[speakingIndexRef.current];

        if (!currentText) {
          resumeMicIfNeeded();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(currentText);
        utterance.rate = options.rate || 1.05;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onstart = () => {
          setStatusMessage("Speaking...");
        };

        utterance.onend = () => {
          speakingIndexRef.current += 1;
          speakNext();
        };

        utterance.onerror = () => {
          resumeMicIfNeeded();
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    },
    [splitSpeechText, startRecognitionSafely, setIsHearing, setStatusMessage]
  );

  const speakInstructions = useCallback(() => {
    const now = Date.now();

    if (now - lastInstructionSpokenAtRef.current < 2500) return;

    lastInstructionSpokenAtRef.current = now;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    speak(
      isMobile
        ? "Accessibility menu opened. Voice assistance and tab reader are available. After this message, I will listen for your command. You can say: turn on tab reader, read page, read buttons, what can I say, or stop listening. You can also press and hold the Voice Assistance button to speak anytime."
        : "Accessibility menu opened. Voice assistance and tab reader are available. After this message, I will listen for your command. You can say: turn on tab reader, read page, read buttons, what can I say, or stop listening. You can also hold F9 to speak anytime.",
      { startMicAfterSpeech: true }
    );
  }, [speak]);

  const stopTalking = useCallback(() => {
    const shouldResumeMic =
      resumeMicAfterSpeechRef.current &&
      keepListeningRef.current &&
      !manualStopRef.current;

    speechQueueRef.current = [];
    speakingIndexRef.current = 0;
    isAssistantSpeakingRef.current = false;
    resumeMicAfterSpeechRef.current = false;
    pauseRecognitionForSpeechRef.current = false;

    window.speechSynthesis.cancel();

    if (shouldResumeMic) {
      shouldRestartRef.current = true;

      window.setTimeout(() => {
        startRecognitionSafely("Listening...");
      }, 500);

      return;
    }

    setStatusMessage(
      isListeningRef.current
        ? "Speech stopped. Microphone is still listening."
        : "Speech stopped."
    );
  }, [startRecognitionSafely, setStatusMessage]);

  const stopMicrophone = useCallback(() => {
    shouldRestartRef.current = false;
    keepListeningRef.current = false;
    manualStopRef.current = true;
    spacePressedRef.current = false;
    resumeMicAfterSpeechRef.current = false;
    pauseRecognitionForSpeechRef.current = false;
    recognitionStartingRef.current = false;

    clearHearingTimer();
    setIsHearing(false);

    if (recognitionRestartTimerRef.current) {
      clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }


    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error.
      }
    }

    recognitionActiveRef.current = false;
    setIsListening(false);
    setStatusMessage("Microphone is off.");
  }, [
    clearHearingTimer,
    setIsHearing,
    setIsListening,
    setStatusMessage,
  ]);

  const startMicrophoneOnly = useCallback(() => {
    if (recognitionActiveRef.current || recognitionStartingRef.current) {
      return;
    }

    keepListeningRef.current = true;
    manualStopRef.current = false;
    shouldRestartRef.current = true;

    startRecognitionSafely("Listening...");
  }, [startRecognitionSafely]);

  const toggleTabReader = useCallback(() => {
    setIsTabReaderOn((prev) => {
      const next = !prev;

      if (next) {
        speak("Tab reader is on.");
      } else {
        speak("Tab reader is off.");
      }

      return next;
    });
  }, [speak]);

  const increaseText = useCallback(() => {
    setTextScale((prev) => {
      const next = Math.min(prev + 10, 150);
      speak(`Text size ${next} percent.`);
      return next;
    });
  }, [speak]);

  const decreaseText = useCallback(() => {
    setTextScale((prev) => {
      const next = Math.max(prev - 10, 90);
      speak(`Text size ${next} percent.`);
      return next;
    });
  }, [speak]);

  const moveButton = useCallback(() => {
    setPosition((prev) => {
      const next = prev === "right" ? "left" : "right";
      speak(`Button moved to the ${next}.`);
      return next;
    });
  }, [speak]);

  const readPageContent = useCallback(() => {
    const content =
      document.getElementById("readable-content") || getMainContent();

    if (!content) {
      speak("No readable content found.");
      return;
    }

    const preferredReadable = content.querySelectorAll(".voice-readable");

    const readableElements =
      preferredReadable.length > 0
        ? Array.from(preferredReadable)
        : Array.from(
            content.querySelectorAll(
              "[data-voice-summary], h1, h2, h3, p, li, a, button, img"
            )
          );

    const readableItems = [];

    for (const el of readableElements) {
      if (el.closest(".accessibility-bubble-wrapper")) continue;

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        continue;
      }

      const rawText =
        el.tagName === "IMG"
          ? el.getAttribute("alt") || ""
          : el.getAttribute("aria-label") || el.innerText || el.textContent || "";

      const cleanedText = rawText.replace(/\s+/g, " ").trim();

      if (cleanedText) {
        readableItems.push(cleanedText);
      }
    }

    if (!readableItems.length) {
      speak("No readable content found.");
      return;
    }

    speak(readableItems.join(". "), { rate: 1.0, maxLength: 220 });
  }, [speak]);

  const readButtons = useCallback(() => {
    const buttons = [];

    for (const el of getVisibleElements("button, a")) {
      if (el.closest(".accessibility-bubble-wrapper")) continue;

      const text = getReadableText(el);

      if (text) {
        buttons.push(text);
      }
    }

    if (!buttons.length) {
      speak("No visible buttons or links found.");
      return;
    }

    speak(`Buttons are: ${buttons.slice(0, 15).join(", ")}.`);
  }, [speak]);

  const readFields = useCallback(() => {
    const fields = [];

    for (const el of getCurrentFormFields()) {
      const label = getFieldLabelText(el);

      if (label) {
        fields.push(label);
      }
    }

    if (!fields.length) {
      speak("No visible form fields found.");
      return;
    }

    speak(`Fields are: ${fields.slice(0, 15).join(", ")}.`);
  }, [speak]);

  const readForm = useCallback(() => {
    readFields();
  }, [readFields]);

  const readSummary = useCallback(() => {
    const title = getPageName();

    let buttons = 0;

    for (const el of getVisibleElements("button")) {
      if (!el.closest(".accessibility-bubble-wrapper")) {
        buttons += 1;
      }
    }

    let links = 0;

    for (const el of getVisibleElements("a")) {
      if (!el.closest(".accessibility-bubble-wrapper")) {
        links += 1;
      }
    }

    const fields = getCurrentFormFields().length;

    speak(
      `${title} page. ${buttons} buttons, ${links} links, and ${fields} form fields.`
    );
  }, [speak]);

  const submitCurrentForm = useCallback(() => {
    const readSubmitError = () => {
      const firstError = findFirstFormError();

      if (!firstError) return false;

      const { field, message } = firstError;

      if (field) {
        if (!field.id) field.id = `voice-id-${Date.now()}`;
        field.focus();
        activeFieldRef.current = field.id;

        const fields = getCurrentFormFields();
        const index = fields.findIndex((item) => item === field);
        if (index >= 0) activeQuestionIndexRef.current = index;
      }

      speak(`There is an error. ${message}`);
      return true;
    };

    const active = document.activeElement;
    const form =
      active?.closest?.("form") || document.querySelector("form") || null;

    if (form) {
      const submitButton = form.querySelector(
        "button[type='submit'], input[type='submit']"
      );

      if (submitButton) {
        submitButton.click();

        window.setTimeout(() => {
          if (!readSubmitError()) {
            speak("Form submitted.");
          }
        }, 800);

        return;
      }

      form.requestSubmit?.();

      window.setTimeout(() => {
        if (!readSubmitError()) {
          speak("Form submitted.");
        }
      }, 800);

      return;
    }

    const buttons = getVisibleElements("button");
    const submitButton = buttons.find((btn) => {
      const text = getReadableText(btn).toLowerCase();

      return (
        text.includes("submit") ||
        text.includes("send") ||
        text.includes("save") ||
        text.includes("confirm") ||
        text.includes("next")
      );
    });

    if (submitButton) {
      submitButton.click();

      window.setTimeout(() => {
        if (!readSubmitError()) {
          speak("Form submitted.");
        }
      }, 800);

      return;
    }

    speak("Submit button not found.");
  }, [speak]);

  const goBack = useCallback(() => {
    speak("Going back.");
    navigate(-1);
  }, [navigate, speak]);

  const readHelp = useCallback(() => {
    const now = Date.now();

    if (now - lastHelpSpokenAtRef.current < 2500) return;

    lastHelpSpokenAtRef.current = now;

    speak(
      "Available tools are voice assistance and tab reader. To start voice assistance, press and hold the Voice Assistance button, or hold F9 while speaking. You can say: where am I, read page, read buttons, read fields, current question, clear field, submit form, go back, repeat, or stop talking. For spelling, say spell then the letters, for example: spell h e l l o. I will say the letters back and connect them into a word. Say space to add a space. You can also say upper case h or lower case h when spelling."
    );
  }, [speak]);

  const handleMiniAction = useCallback((action) => {
    action();
  }, []);

  const speakFormVoiceGuide = useCallback(() => {
    const pageName = getPageName();

    if (!isBookingPage(pathname)) {
      speak(`Voice assistance is on. This is ${pageName} page.`);
      return;
    }

    const fields = getCurrentFormFields();

    if (!fields.length) {
      speak(`Voice assistance is on. This is ${pageName} page.`);
      return;
    }

    const firstField = fields[0];

    if (!firstField.id) firstField.id = `voice-id-${Date.now()}`;

    firstField.focus();
    activeFieldRef.current = firstField.id;
    activeQuestionIndexRef.current = 0;

    speak(
      `This is ${pageName} page. First question: ${getFieldLabelText(
        firstField
      )}. Please say your answer.`
    );
  }, [pathname, speak]);

  const readCurrentQuestion = useCallback(() => {
    const activeInput =
      document.getElementById(activeFieldRef.current) || document.activeElement;

    if (
      activeInput &&
      (activeInput.tagName === "INPUT" ||
        activeInput.tagName === "TEXTAREA" ||
        activeInput.tagName === "SELECT")
    ) {
      speak(`Current question: ${getFieldLabelText(activeInput)}.`);
      return;
    }

    const fields = getCurrentFormFields();

    if (!fields.length) {
      speak("No visible form question found.");
      return;
    }

    const firstField = fields[0];

    if (!firstField.id) firstField.id = `voice-id-${Date.now()}`;

    firstField.focus();
    activeFieldRef.current = firstField.id;
    activeQuestionIndexRef.current = 0;

    speak(`Current question: ${getFieldLabelText(firstField)}.`);
  }, [speak]);

  const readNextQuestion = useCallback(() => {
    const fields = getCurrentFormFields();

    if (!fields.length) {
      speak("No visible form question found.");
      return;
    }

    const activeInput =
      document.getElementById(activeFieldRef.current) || document.activeElement;

    let currentIndex = fields.findIndex((field) => field === activeInput);

    if (currentIndex < 0) {
      currentIndex = activeQuestionIndexRef.current;
    }

    const nextIndex = currentIndex + 1;
    const nextField = fields[nextIndex];

    if (!nextField) {
      speak("Last question reached. Say submit form when ready.");
      return;
    }

    if (!nextField.id) nextField.id = `voice-id-${Date.now()}`;

    nextField.focus();
    activeFieldRef.current = nextField.id;
    activeQuestionIndexRef.current = nextIndex;

    speak(
      `Next question: ${getFieldLabelText(nextField)}. Please say your answer.`
    );
  }, [speak]);

  const addSpaceToActiveField = useCallback(() => {
    const inputElement =
      document.getElementById(activeFieldRef.current) || document.activeElement;

    if (
      inputElement &&
      (inputElement.tagName === "INPUT" || inputElement.tagName === "TEXTAREA")
    ) {
      setNativeInputValue(inputElement, `${inputElement.value || ""} `);
      speak("Space added.");
      return true;
    }

    speak("No active text field.");
    return true;
  }, [speak]);

  const clearVoiceInputAndRestart = useCallback(() => {
    pendingAnswerRef.current = null;
    activeQuestionIndexRef.current = -1;

    const activeInput =
      document.getElementById(activeFieldRef.current) || document.activeElement;

    if (
      activeInput &&
      (activeInput.tagName === "INPUT" || activeInput.tagName === "TEXTAREA")
    ) {
      setNativeInputValue(activeInput, "");
    }

    const fields = getCurrentFormFields();

    if (fields.length > 0) {
      const firstField = fields[0];

      if (!firstField.id) {
        firstField.id = `voice-id-${Date.now()}`;
      }

      firstField.focus();
      activeFieldRef.current = firstField.id;
      activeQuestionIndexRef.current = 0;

      setStatusMessage("Cleared. Starting again from the first question.");
      speak(
        `Cleared. Starting again. First question: ${getFieldLabelText(
          firstField
        )}. Please say your answer.`
      );

      return;
    }

    activeFieldRef.current = null;
    setStatusMessage("Cleared.");
    speak("Cleared. You can start again.");
  }, [setStatusMessage, speak]);

  const applyTextScale = useCallback(() => {
    const scalableSelectors = [
      "main",
      "section",
      "article",
      ".page",
      ".container",
      ".card",
      ".panel",
      ".field",
      ".modal",
      ".modal-box",
      ".calendar",
      ".calendar *",
      ".form",
      ".form *",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "span",
      "a",
      "li",
      "label",
      "input",
      "textarea",
      "select",
      "td",
      "th",
      "small",
      "strong",
      "em",
      "button:not(.accessibility-main-button):not(.accessibility-option):not(.accessibility-mini):not(.accessibility-tools-toggle):not(.accessibility-shortcuts-toggle)",
    ].join(",");

    const elements = Array.from(document.querySelectorAll(scalableSelectors));

    elements.forEach((el) => {
      if (el.closest(".accessibility-bubble-wrapper")) return;

      if (!el.dataset.originalFontSize) {
        const computedSize = window.getComputedStyle(el).fontSize;
        el.dataset.originalFontSize = computedSize;
      }

      const originalSize = parseFloat(el.dataset.originalFontSize);

      if (!Number.isFinite(originalSize)) return;

      if (textScale === 100) {
        el.style.fontSize = "";
        delete el.dataset.originalFontSize;
      } else {
        el.style.fontSize = `${(originalSize * textScale) / 100}px`;
      }
    });
  }, [textScale]);

  useEffect(() => {
    document.body.classList.remove("dark-mode");
    localStorage.removeItem("theme");
  }, []);

  useEffect(() => {
    document.body.classList.toggle("screen-reader-on", isTabReaderOn);
    localStorage.setItem("tabReader", isTabReaderOn ? "on" : "off");

    return () => {
      document.body.classList.remove("screen-reader-on");
    };
  }, [isTabReaderOn]);

  useEffect(() => {
    applyTextScale();

    document.body.classList.toggle("access-text-scaled", textScale !== 100);
    localStorage.setItem("accessTextScale", String(textScale));

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        applyTextScale();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [applyTextScale, textScale, pathname]);

  useEffect(() => {
    localStorage.setItem("accessButtonPosition", position);
  }, [position]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const handleGlobalKeyDown = useCallback((event) => {
      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      const key = event.key.toLowerCase();

      const isTypingField =
        tag === "input" || tag === "textarea" || target?.isContentEditable;

      const isOpenShortcut = event.altKey && event.shiftKey && key === "a";
      const isHoldToSpeakShortcut = event.code === "F9" && !event.repeat;

      if (key === "escape") {
        event.preventDefault();

        if (window.speechSynthesis.speaking) {
          stopTalking();
          return;
        }

        if (isOpen) {
          setIsOpen(false);
          setShowTools(false);
          setShowShortcuts(false);
          setStatusMessage("Accessibility panel closed.");
          return;
        }

        stopTalking();
        return;
      }

      if (isOpenShortcut) {
        event.preventDefault();

        setIsOpen((prev) => {
          const next = !prev;

          if (next) {
            setShowTools(false);
            window.setTimeout(speakInstructions, 100);
          } else {
            stopTalking();
            setShowTools(false);
            setShowShortcuts(false);
          }

          return next;
        });

        return;
      }

      if (isHoldToSpeakShortcut) {
        event.preventDefault();

        if (!spacePressedRef.current) {
          spacePressedRef.current = true;
          setIsOpen(true);
          startMicrophoneOnly();

          setStatusMessage(
            "Voice assistance is on. Hold F9 to speak. Release F9 to turn off the microphone only."
          );
        }

        return;
      }

      if (isTypingField) {
        return;
      }

    }, [
      isOpen,
      setIsOpen,
      setShowTools,
      setShowShortcuts,
      setStatusMessage,
      speakInstructions,
      startMicrophoneOnly,
      stopTalking,
    ]);

  const handleGlobalKeyUp = useCallback((event) => {
      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      const key = event.key.toLowerCase();

      const isTypingField =
        tag === "input" || tag === "textarea" || target?.isContentEditable;

      const isReleaseHoldToSpeak = event.code === "F9";

      if (isTypingField && !isReleaseHoldToSpeak) {
        return;
      }

      if (isReleaseHoldToSpeak && spacePressedRef.current) {
        event.preventDefault();
        spacePressedRef.current = false;
        shouldRestartRef.current = false;
        keepListeningRef.current = false;
        manualStopRef.current = true;

        if (recognitionRestartTimerRef.current) {
          clearTimeout(recognitionRestartTimerRef.current);
          recognitionRestartTimerRef.current = null;
        }

        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            // Ignore stop error.
          }
        }

        recognitionActiveRef.current = false;
        recognitionStartingRef.current = false;
        setIsListening(false);
        setIsHearing(false);
        setStatusMessage("Voice assistance is on. Microphone is off.");
      }
    }, [
      setIsHearing,
      setIsListening,
      setStatusMessage,
    ]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      handleGlobalKeyDown(event);
    };

    const handleKeyUp = (event) => {
      handleGlobalKeyUp(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleGlobalKeyDown, handleGlobalKeyUp]);

  const handleTabReaderFocus = useCallback((event) => {
    const el = event.target;

    if (!el || el === document.body || el === document.documentElement) {
      return;
    }

    if (el.closest(".accessibility-bubble-wrapper")) return;

    const textToRead = getReadableText(el);

    if (!textToRead) return;
    if (lastSpokenRef.current === textToRead) return;

    lastSpokenRef.current = textToRead;
    speak(textToRead, { rate: 1.05 });
  }, [speak]);

  useEffect(() => {
    if (!isTabReaderOn) {
      window.speechSynthesis.cancel();
      return undefined;
    }

    const handleFocus = (event) => {
      handleTabReaderFocus(event);
    };

    document.addEventListener("focus", handleFocus, true);

    return () => {
      document.removeEventListener("focus", handleFocus, true);
      window.speechSynthesis.cancel();
    };
  }, [handleTabReaderFocus, isTabReaderOn]);

  useEffect(() => {
    return () => {
      clearHearingTimer();
    };
  }, [clearHearingTimer]);

  const parseTime = (timeStr) => {
    const match = String(timeStr).match(
      /(\d{1,2})[:\s]?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/i
    );

    if (!match) return null;

    let hr = parseInt(match[1], 10);
    const min = match[2] || "00";
    const ampm = match[3] ? match[3].toLowerCase().replace(/\./g, "") : "am";

    if (Number.isNaN(hr) || hr < 1 || hr > 12) return null;

    if (ampm === "pm" && hr < 12) hr += 12;
    if (ampm === "am" && hr === 12) hr = 0;

    return `${String(hr).padStart(2, "0")}:${min}`;
  };

  const parseWorkHours = (text = "") => {
    const lower = text.toLowerCase();

    const matches = Array.from(
      lower.matchAll(/(\d{1,2})[:\s]?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/gi)
    );

    if (matches.length >= 2) {
      const first = parseTime(matches[0][0]);
      const second = parseTime(matches[1][0]);

      if (first && second) return `${first} - ${second}`;
    }

    const fromTo = lower.match(
      /from\s+(.+?)\s+(to|until|hanggang|-)\s+(.+)/i
    );

    if (fromTo) {
      const start = parseTime(fromTo[1]);
      const end = parseTime(fromTo[3]);

      if (start && end) return `${start} - ${end}`;
    }

    return text;
  };

  const setActiveFieldValue = useCallback(
    (inputElement, transcript) => {
      const inputName = (inputElement.name || "").toLowerCase();
      const inputPlaceholder = (inputElement.placeholder || "").toLowerCase();
      const inputId = (inputElement.id || "").toLowerCase();
      const labelText = getFieldLabelText(inputElement);
      const labelIdentity = labelText.toLowerCase();

      const fieldIdentity = normalizeText(
        `${inputName} ${inputPlaceholder} ${inputId} ${labelIdentity}`
      );
      const isEmailField = isEmailFieldElement(inputElement, fieldIdentity, inputName);

      const spelledPreview = getSpelledSpeechPreview(transcript);
      const dictatedValue = formatDictatedText(transcript);
      let finalValue = dictatedValue;
      const confirmationLabel = labelText || "this field";

      if (
        inputName === "full_name" ||
        inputName === "fullname" ||
        inputPlaceholder.includes("full name") ||
        fieldIdentity.includes("fullname")
      ) {
        finalValue = capitalizeWords(dictatedValue);

        if (finalValue.split(/\s+/).length < 2) {
          speak("Please say both first and last name.");
          return;
        }
      } else if (
        inputName.includes("phone") ||
        inputPlaceholder.includes("phone") ||
        inputElement.type === "tel" ||
        fieldIdentity.includes("phonenumber")
      ) {
        finalValue = transcript.replace(/\D/g, "");

        if (finalValue.length !== 11) {
          speak(
            `You said ${finalValue.length} digits. Please say an 11 digit phone number.`
          );
          return;
        }
      } else if (isEmailField) {
        finalValue = formatEmailDictation(transcript);
      } else if (
        inputElement.type === "time" ||
        fieldIdentity.includes("starttime") ||
        fieldIdentity.includes("endtime")
      ) {
        const timeVal = parseTime(transcript);

        if (!timeVal) {
          speak("Please say a valid time, for example 7 A M.");
          return;
        }

        finalValue = timeVal;
      } else if (
        fieldIdentity.includes("workhours") ||
        fieldIdentity.includes("workinghours") ||
        fieldIdentity.includes("hours")
      ) {
        finalValue = parseWorkHours(transcript);
      } else if (
        fieldIdentity.includes("guest") ||
        fieldIdentity.includes("estimatednumberofguest") ||
        fieldIdentity.includes("numberofguest")
      ) {
        finalValue = transcript.replace(/\D/g, "") || transcript;
      } else if (
        fieldIdentity.includes("typeofevent") ||
        fieldIdentity.includes("eventtype") ||
        fieldIdentity.includes("category") ||
        fieldIdentity.includes("eventname") ||
        fieldIdentity.includes("location")
      ) {
        finalValue = capitalizeWords(dictatedValue);
      }

      pendingAnswerRef.current = {
        inputElement,
        value: finalValue,
        label: confirmationLabel,
      };

      const spokenFinalValue = isEmailField
        ? formatEmailForSpeech(finalValue)
        : finalValue;

      if (spelledPreview) {
        speak(
          `You spelled ${spelledPreview.spelledLetters}. The full ${
            isEmailField ? "email" : "word"
          } is ${spokenFinalValue}. Is this correct? Say yes or no.`
        );
      } else {
        speak(`I heard ${spokenFinalValue}. Is this correct? Say yes or no.`);
      }
    },
    [speak]
  );

  const selectField = useCallback(
    (spokenName, keywords) => {
      const targetInput = findFieldByKeywords(keywords);

      if (targetInput) {
        if (!targetInput.id) targetInput.id = `voice-id-${Date.now()}`;

        targetInput.focus();
        activeFieldRef.current = targetInput.id;

        const fields = getCurrentFormFields();
        const index = fields.findIndex((field) => field === targetInput);

        if (index >= 0) activeQuestionIndexRef.current = index;

        const label = getFieldLabelText(targetInput);

        speak(`${label}. Please say your answer.`);
        return true;
      }

      speak(`${spokenName} field not found.`);
      return true;
    },
    [speak]
  );

  const handleTranscript = useCallback(
    async (transcript) => {
      if (isAssistantSpeakingRef.current) return;

      if (Date.now() < ignoreVoiceUntilRef.current) return;

      const assistantText = normalizeText(lastSpokenByAssistantRef.current);
      const heardText = normalizeText(transcript);

      if (
        assistantText &&
        heardText &&
        assistantText.includes(heardText) &&
        heardText.length > 10
      ) {
        return;
      }

      const lowerTranscript = transcript.toLowerCase().trim();
      const cleanTranscript = normalizeText(transcript);

      setIsHearing(false);
      setStatusMessage(`Heard: "${transcript}"`);

      if (pendingAnswerRef.current) {
        if (
          includesAny(lowerTranscript, [
            "yes",
            "correct",
            "okay",
            "ok",
            "confirm",
            "tama",
          ])
        ) {
          const { inputElement, value, label } = pendingAnswerRef.current;

          setNativeInputValue(inputElement, value);
          pendingAnswerRef.current = null;

          const fields = getCurrentFormFields();
          let currentIndex = fields.findIndex((field) => field === inputElement);

          if (currentIndex < 0) {
            currentIndex = activeQuestionIndexRef.current;
          }

          const nextIndex = currentIndex + 1;
          const nextField = fields[nextIndex];

          if (!nextField) {
            activeFieldRef.current = null;
            activeQuestionIndexRef.current = currentIndex;

            speak(
              `${label} confirmed. Last question reached. Say submit form when ready.`
            );
            return;
          }

          if (!nextField.id) nextField.id = `voice-id-${Date.now()}`;

          nextField.focus();
          activeFieldRef.current = nextField.id;
          activeQuestionIndexRef.current = nextIndex;

          speak(
            `${label} confirmed. Next question: ${getFieldLabelText(
              nextField
            )}. Please say your answer.`
          );
          return;
        }

        if (
          includesAny(lowerTranscript, [
            "no",
            "wrong",
            "incorrect",
            "change",
            "mali",
          ])
        ) {
          const { inputElement, label } = pendingAnswerRef.current;

          pendingAnswerRef.current = null;

          if (!inputElement.id) inputElement.id = `voice-id-${Date.now()}`;

          inputElement.focus();
          activeFieldRef.current = inputElement.id;

          const fields = getCurrentFormFields();
          const index = fields.findIndex((field) => field === inputElement);
          if (index >= 0) activeQuestionIndexRef.current = index;

          speak(`Okay. Please say your answer for ${label} again.`);
          return;
        }

        speak("Please say yes if correct, or no to change.");
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "turn on voice assistance",
          "open voice assistance",
          "start voice assistance",
          "voice assistance on",
        ])
      ) {
        speak("Voice assistance is on. Hold F9 while speaking, then release F9.");
        startMicrophoneOnly();
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "turn off voice assistance",
          "close voice assistance",
          "stop voice assistance",
          "voice assistance off",
        ])
      ) {
        stopMicrophone();
        speak("Voice assistance is off.");
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "turn on tab reader",
          "open tab reader",
          "start tab reader",
          "tab reader on",
        ])
      ) {
        if (!isTabReaderOn) {
          toggleTabReader();
        } else {
          speak("Tab reader is already on.");
        }
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "turn off tab reader",
          "close tab reader",
          "stop tab reader",
          "tab reader off",
        ])
      ) {
        if (isTabReaderOn) {
          toggleTabReader();
        } else {
          speak("Tab reader is already off.");
        }
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "repeat",
          "say again",
          "repeat that",
          "ulit",
        ])
      ) {
        if (lastAssistantMessageRef.current) {
          speak(lastAssistantMessageRef.current);
        } else {
          speak("There is nothing to repeat yet.");
        }
        return;
      }

      if (includesAny(lowerTranscript, ["help", "tulong", "what can i say"])) {
        readHelp();
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "where am i",
          "where am i now",
          "what page is this",
          "describe page",
          "describe this page",
          "page description",
          "read summary",
          "page summary",
          "buod",
        ])
      ) {
        readSummary();
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "read content",
          "read page",
          "read this page",
          "read everything",
          "basa content",
          "basahin page",
        ])
      ) {
        readPageContent();
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "read buttons",
          "buttons only",
          "what can i click",
          "available buttons",
          "clickable items",
          "basahin buttons",
        ])
      ) {
        readButtons();
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "read fields",
          "read form fields",
          "read this form",
          "what can i fill out",
          "available fields",
          "basahin fields",
        ])
      ) {
        readForm();
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "submit this form",
          "submit form",
          "send this form",
          "save this form",
          "confirm this form",
        ])
      ) {
        submitCurrentForm();
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "go back",
          "back",
          "previous page",
          "return",
          "go to previous page",
        ])
      ) {
        goBack();
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "screen reader",
          "tab reader",
          "focus reader",
          "reader mode",
        ])
      ) {
        toggleTabReader();
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "stop reading",
          "stop talking",
          "quiet",
          "tumigil",
          "hinto",
        ])
      ) {
        stopTalking();
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "stop listening",
          "turn off microphone",
          "microphone off",
          "patayin microphone",
          "patay mic",
        ])
      ) {
        stopMicrophone();
        return;
      }

      if (
        lowerTranscript === "current question" ||
        lowerTranscript === "read question" ||
        lowerTranscript === "read current question" ||
        lowerTranscript === "what is the question"
      ) {
        readCurrentQuestion();
        return;
      }

      if (
        lowerTranscript === "next question" ||
        lowerTranscript === "read next question" ||
        lowerTranscript === "next field" ||
        lowerTranscript === "next form field"
      ) {
        readNextQuestion();
        return;
      }

      if (
        lowerTranscript === "space" ||
        lowerTranscript === "add space" ||
        lowerTranscript === "insert space"
      ) {
        addSpaceToActiveField();
        return;
      }

      if (
        lowerTranscript === "delete" ||
        lowerTranscript === "clear" ||
        lowerTranscript === "clear field" ||
        lowerTranscript === "clear answer" ||
        lowerTranscript === "start again" ||
        lowerTranscript === "restart answer" ||
        lowerTranscript === "undo" ||
        lowerTranscript === "burahin"
      ) {
        clearVoiceInputAndRestart();
        return;
      }

      if (activeFieldRef.current) {
        const inputElement = document.getElementById(activeFieldRef.current);

        if (inputElement) {
          setActiveFieldValue(inputElement, transcript);
          return;
        }
      }

      const optionLabelMap = new Map();

      for (const label of document.querySelectorAll("label.opt")) {
        const normalizedLabelText = normalizeText(label.innerText);

        for (const option of CHECKABLE_OPTIONS) {
          if (!optionLabelMap.has(option.key) && option.labelPattern.test(normalizedLabelText)) {
            optionLabelMap.set(option.key, label);
          }
        }
      }

      for (const option of CHECKABLE_OPTIONS) {
        if (!option.termPattern.test(cleanTranscript)) continue;

        const { key } = option;
        const targetLabel = optionLabelMap.get(key);

        if (targetLabel) {
          const input = targetLabel.querySelector("input");

          if (input) input.click();
          else targetLabel.click();

          speak(
            `Selected ${key.replace("cups", " cups").replace("menu", " menu")}.`
          );
          return;
        }

        if (selectOptionByVoice(key, speak)) return;
      }

      const directField = FORM_FIELD_COMMAND_MAP.get(cleanTranscript);

      if (directField) {
        selectField(directField.spoken, directField.keywords);
        return;
      }

      if (
        includesAny(lowerTranscript, ["work hours", "working hours"]) &&
        /\d/.test(lowerTranscript)
      ) {
        const targetInput = findFieldByKeywords([
          "workhours",
          "workinghours",
          "work hours",
          "hours",
        ]);

        if (targetInput) {
          const hoursText = lowerTranscript
            .replace("work hours", "")
            .replace("working hours", "")
            .trim();

          pendingAnswerRef.current = {
            inputElement: targetInput,
            value: parseWorkHours(hoursText),
            label: getFieldLabelText(targetInput),
          };

          speak(
            `I heard ${parseWorkHours(hoursText)}. Is this correct? Say yes or no.`
          );
        } else {
          speak("Work hours field not found.");
        }

        return;
      }

      if (
        lowerTranscript === "next" ||
        lowerTranscript.includes("click next") ||
        lowerTranscript.includes("continue") ||
        lowerTranscript.includes("next na")
      ) {
        const btns = getVisibleElements("button");
        const nextBtn = btns.find((button) =>
          button.innerText.toLowerCase().includes("next")
        );

        if (nextBtn) {
          speak("Continuing.");
          nextBtn.click();
        } else {
          speak("Next button not found.");
        }

        return;
      }

      if (lowerTranscript === "cancel action") {
        const modal =
          document.querySelector(".modal-box") ||
          document.querySelector("[role='dialog']");

        const scope = modal || document;
        const btns = Array.from(scope.querySelectorAll("button"));
        const cancelBtn = btns.find((button) =>
          button.innerText.toLowerCase().includes("cancel")
        );

        if (cancelBtn) {
          pendingCancelRef.current = cancelBtn;
          speak("Cancel found. Say confirm cancel.");
        } else {
          speak("Cancel button not found.");
        }

        return;
      }

      if (lowerTranscript === "confirm cancel") {
        if (pendingCancelRef.current) {
          pendingCancelRef.current.click();
          pendingCancelRef.current = null;
          speak("Cancel confirmed.");
        } else {
          speak("No pending cancel action found.");
        }

        return;
      }

      const isOnDayPage = pathname.includes("/day");
      const isOnEventPage =
        pathname.includes("/event") ||
        pathname.includes("/add-booking") ||
        pathname.includes("/booking");

      if (
        lowerTranscript === "event" ||
        lowerTranscript.includes("event page") ||
        lowerTranscript.includes("go to event") ||
        lowerTranscript.includes("open event")
      ) {
        speak("Opening Event page.");
        navigate(EVENT_PAGE_PATH);
        return;
      }

      if (lowerTranscript.includes("book event")) {
        if (isOnDayPage) {
          const btns = Array.from(document.querySelectorAll(".add-pill, button"));
          const btn = btns.find((button) =>
            button.innerText.toLowerCase().includes("event")
          );

          if (btn) {
            speak("Opening event booking form.");
            btn.click();
          } else {
            speak("Event booking button not found.");
          }
        } else if (isOnEventPage) {
          const typeField = findFieldByKeywords([
            "typeofevent",
            "eventtype",
            "type of event",
            "category",
          ]);

          if (typeField) {
            if (!typeField.id) typeField.id = `voice-id-${Date.now()}`;
            typeField.focus();
            activeFieldRef.current = typeField.id;
            speak("Type of event. Please say your answer.");
          } else {
            speak("Event booking form is open.");
          }
        } else {
          speak("Opening Event page.");
          navigate(EVENT_PAGE_PATH);
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
          } else {
            speak("Workshop booking button not found.");
          }
        } else {
          speak("Opening Calendar page.");
          navigate(CALENDAR_PAGE_PATH);
        }

        return;
      }

      if (includesAny(lowerTranscript, ["home", "homepage", "bahay"])) {
        speak("Opening Home page.");
        navigate(HOME_PAGE_PATH);
        return;
      }

      if (includesAny(lowerTranscript, ["about", "about us", "about page"])) {
        speak("Opening About Us page.");
        navigate(ABOUT_PAGE_PATH);
        return;
      }

      if (
        lowerTranscript.includes("public workshop") ||
        lowerTranscript.includes("public workshops") ||
        lowerTranscript.includes("open public workshop") ||
        lowerTranscript.includes("go to public workshop")
      ) {
        speak("Opening Public Workshop page.");
        navigate(PUBLIC_WORKSHOP_PATH);
        return;
      }

      if (
        lowerTranscript.includes("private workshop") ||
        lowerTranscript.includes("open private workshop") ||
        lowerTranscript.includes("go to private workshop")
      ) {
        speak("Opening Private Workshop page.");
        navigate(PRIVATE_WORKSHOP_PATH);
        return;
      }

      if (
        lowerTranscript === "workshop" ||
        lowerTranscript.includes("workshop page") ||
        lowerTranscript.includes("go to workshop") ||
        lowerTranscript.includes("open workshop")
      ) {
        speak("Opening Public Workshop page.");
        navigate(PUBLIC_WORKSHOP_PATH);
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "calendar",
          "book now",
          "booking",
          "book",
          "punta calendar",
        ])
      ) {
        speak("Opening Calendar page.");
        navigate(CALENDAR_PAGE_PATH);
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "profile",
          "my profile",
          "account",
          "my account",
          "open profile",
          "go to profile",
        ])
      ) {
        speak("Opening Profile page.");
        navigate(PROFILE_PAGE_PATH);
        return;
      }

      if (
        includesAny(lowerTranscript, [
          "login",
          "log in",
          "sign in",
          "punta login",
        ])
      ) {
        speak("Opening Login page.");
        navigate("/login");
        return;
      }

      if (
        includesAny(lowerTranscript, ["sign up", "register", "create account"])
      ) {
        speak("Opening Sign Up page.");
        navigate("/sign-up");
        return;
      }

      if (lowerTranscript.includes("forgot")) {
        speak("Opening Forgot Password page.");
        navigate("/forgot-password");
        return;
      }

      const monthRegex =
        /(january|february|march|april|may|june|july|august|september|october|november|december)/;

      const dayRegex = /(\d{1,2})/;
      const foundMonth = lowerTranscript.match(monthRegex);
      const foundDay = lowerTranscript.match(dayRegex);

      if (foundMonth && foundDay) {
        const monthName = foundMonth[1];
        const dayNum = parseInt(foundDay[1], 10);

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

        if (
          targetDate.getMonth() !== monthIndex ||
          targetDate.getDate() !== dayNum
        ) {
          speak("That date is not valid.");
          return;
        }

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
          if (
            err.response?.status === 401 ||
            err.response?.data?.status === "error"
          ) {
            speak("Please log in first.");
            navigate(`/login?redirect=${encodeURIComponent(targetPath)}`);
          } else {
            speak("Sorry, I could not check the calendar status.");
          }
        }

        return;
      }

      speak(
        "Command not recognized. Say current question, read buttons, or submit form."
      );
    },
    [
      navigate,
      pathname,
      speak,
      startMicrophoneOnly,
      stopMicrophone,
      stopTalking,
      toggleTabReader,
      isTabReaderOn,
      readPageContent,
      readButtons,
      readForm,
      readSummary,
      readHelp,
      submitCurrentForm,
      goBack,
      selectField,
      setActiveFieldValue,
      readCurrentQuestion,
      readNextQuestion,
      addSpaceToActiveField,
      clearVoiceInputAndRestart,
      setIsHearing,
      setStatusMessage,
    ]
  );

  const toggleMicrophone = useCallback(() => {
    if (isListeningRef.current || recognitionActiveRef.current) {
      stopMicrophone();
      return;
    }

    keepListeningRef.current = true;
    manualStopRef.current = false;
    shouldRestartRef.current = false;

    setIsListening(true);
    setIsHearing(false);
    setStatusMessage("Voice assistance is starting.");

    speakFormVoiceGuide();

    window.setTimeout(() => {
      startRecognitionSafely("Listening...");
    }, 1300);
  }, [
    speakFormVoiceGuide,
    startRecognitionSafely,
    stopMicrophone,
    setIsHearing,
    setIsListening,
    setStatusMessage,
  ]);

  const startHoldToTalk = useCallback(() => {
    setIsOpen(true);
    spacePressedRef.current = true;
    startMicrophoneOnly();
    setStatusMessage(
      "Voice assistance is on. Hold to speak. Release to turn off the microphone only."
    );
  }, [setIsOpen, setStatusMessage, startMicrophoneOnly]);

  const stopHoldToTalk = useCallback(() => {
    if (!spacePressedRef.current) return;

    spacePressedRef.current = false;
    shouldRestartRef.current = false;
    keepListeningRef.current = false;
    manualStopRef.current = true;

    if (recognitionRestartTimerRef.current) {
      clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error.
      }
    }

    recognitionActiveRef.current = false;
    recognitionStartingRef.current = false;
    setIsListening(false);
    setIsHearing(false);
    setStatusMessage("Voice assistance is on. Microphone is off.");
  }, [setIsHearing, setIsListening, setStatusMessage]);

useEffect(() => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setStatusMessage(
      "Voice assistance is not supported in this browser. Please use Chrome or Edge."
    );
    return undefined;
  }

  const recognition = new SpeechRecognition();
  let restartTimer = null;
  let isEffectCleanedUp = false;

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    if (isEffectCleanedUp) return;

    recognitionStartingRef.current = false;
    recognitionActiveRef.current = true;
    noSpeechRetryRef.current = 0;

    setIsListening(true);
    setStatusMessage("Microphone is active. Speak now.");
  };

  recognition.onresult = async (event) => {
    if (isEffectCleanedUp) return;
    if (isAssistantSpeakingRef.current) return;
    if (Date.now() < ignoreVoiceUntilRef.current) return;

    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const alternatives = Array.from(event.results[i])
        .map((alternative) => alternative.transcript)
        .filter(Boolean);
      const transcript = chooseBestTranscript(alternatives);

      if (event.results[i].isFinal) {
        finalTranscript += ` ${transcript}`;
      } else {
        interimTranscript += ` ${transcript}`;
      }
    }

    if (interimTranscript.trim()) {
      markHearing();
      setStatusMessage(`Hearing: "${interimTranscript.trim()}"`);
    }

    const cleanedFinal = finalTranscript.trim();

    if (!cleanedFinal) return;

    noSpeechRetryRef.current = 0;

    const now = Date.now();

    if (
      lastTranscriptRef.current.text === cleanedFinal &&
      now - lastTranscriptRef.current.time < 1500
    ) {
      return;
    }

    lastTranscriptRef.current = {
      text: cleanedFinal,
      time: now,
    };

    await handleTranscript(cleanedFinal);
  };

  recognition.onerror = (event) => {
    if (isEffectCleanedUp) return;

    recognitionStartingRef.current = false;

    if (
      event.error === "not-allowed" ||
      event.error === "service-not-allowed"
    ) {
      shouldRestartRef.current = false;
      keepListeningRef.current = false;
      manualStopRef.current = true;
      recognitionActiveRef.current = false;

      setIsListening(false);
      setIsHearing(false);
      setStatusMessage("Microphone permission was denied.");
      return;
    }

    if (event.error === "no-speech") {
      noSpeechRetryRef.current += 1;
      setStatusMessage("I did not hear anything.");

      if (noSpeechRetryRef.current <= 3 && keepListeningRef.current) {
        shouldRestartRef.current = true;
        return;
      }

      speak("I did not hear anything. Hold F9 and try again.");
      stopMicrophone();
      return;
    }

    if (event.error === "aborted") {
      setStatusMessage("Voice recognition was interrupted.");
      return;
    }

    if (event.error === "network") {
      setStatusMessage("Voice recognition network error. Trying again.");

      if (keepListeningRef.current) {
        shouldRestartRef.current = true;
      }

      return;
    }

    setStatusMessage(`Voice error: ${event.error}`);
  };

  recognition.onend = () => {
    if (isEffectCleanedUp) return;

    recognitionActiveRef.current = false;
    recognitionStartingRef.current = false;

    if (pauseRecognitionForSpeechRef.current || isAssistantSpeakingRef.current) {
      return;
    }

    if (manualStopRef.current || !keepListeningRef.current) {
      setIsListening(false);
      setIsHearing(false);
      setStatusMessage("Voice assistance is on. Microphone is off.");
      return;
    }

    if (shouldRestartRef.current) {
      if (restartTimer) {
        clearTimeout(restartTimer);
      }

      restartTimer = window.setTimeout(() => {
        startRecognitionSafely("Listening...");
      }, 800);

      return;
    }

    setIsListening(false);
    setIsHearing(false);
    setStatusMessage("Voice assistance is on. Microphone is off.");
  };

  recognitionRef.current = recognition;

  return () => {
    isEffectCleanedUp = true;

    if (restartTimer) {
      clearTimeout(restartTimer);
    }

    if (recognitionRef.current === recognition) {
      recognitionRef.current = null;
    }

    try {
      recognition.stop();
    } catch {
      // ignore stop error
    }

    window.speechSynthesis.cancel();
  };
}, [
  handleTranscript,
  markHearing,
  setIsHearing,
  setIsListening,
  setStatusMessage,
  speak,
  startRecognitionSafely,
  stopMicrophone,
]);

  return (
    <div
      className={`accessibility-bubble-wrapper ${
        position === "left" ? "position-left" : "position-right"
      }`}
    >
      {isOpen && (
        <div
          id="accessibility-menu"
          className="accessibility-menu show"
          aria-hidden="false"
        >
        <div className="accessibility-main-column">
          <button
            type="button"
            className={`accessibility-option ${
              isListening ? "active danger" : ""
            }`}
            onPointerDown={(event) => {
              event.preventDefault();
              pointerHoldToTalkRef.current = true;
              startHoldToTalk();
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              stopHoldToTalk();
            }}
            onPointerCancel={(event) => {
              event.preventDefault();
              stopHoldToTalk();
            }}
            onPointerLeave={(event) => {
              if (pointerHoldToTalkRef.current) {
                event.preventDefault();
                stopHoldToTalk();
              }
            }}
            onClick={(event) => {
              if (pointerHoldToTalkRef.current) {
                event.preventDefault();
                pointerHoldToTalkRef.current = false;
                return;
              }

              toggleMicrophone();
            }}
            aria-label={
              isListening
                ? "Stop voice assistance microphone"
                : "Start voice assistance microphone"
            }
          >
            <span className="accessibility-icon" aria-hidden="true">
              {isListening ? <MicOff size={19} /> : <Mic size={19} />}
            </span>
            <span>
              {isListening ? "Stop Voice Assistance" : "Voice Assistance"}
            </span>
            <kbd>{isListening ? "On" : "Start"}</kbd>
          </button>

          <button
            type="button"
            className={`accessibility-option ${isTabReaderOn ? "active" : ""}`}
            onClick={toggleTabReader}
            aria-label={
              isTabReaderOn ? "Turn off tab reader" : "Turn on tab reader"
            }
          >
            <span className="accessibility-icon" aria-hidden="true">
              {isTabReaderOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </span>
            <span>{isTabReaderOn ? "Tab Reader ON" : "Tab Reader"}</span>
            <kbd>{isTabReaderOn ? "On" : "Start"}</kbd>
          </button>

          <button
            type="button"
            className="accessibility-option"
            onClick={stopTalking}
            aria-label="Stop talking"
          >
            <span className="accessibility-icon" aria-hidden="true">
              <PauseCircle size={19} />
            </span>
            <span>Stop Talking</span>
            <kbd>Esc</kbd>
          </button>

          <button
            type="button"
            className="accessibility-shortcuts-toggle accessibility-shortcuts-below"
            onClick={() => setShowShortcuts((prev) => !prev)}
            aria-expanded={showShortcuts}
            aria-label="Show or hide accessibility guide"
          >
            Accessibility Guide
            <ChevronDown
              size={16}
              className={showShortcuts ? "rotate" : ""}
              aria-hidden="true"
            />
          </button>

          <div
            className="accessibility-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <p>{statusMessage}</p>

            {isListening && (
              <div
                className={`voice-wave ${
                  isHearing || isListening ? "hearing" : ""
                }`}
                aria-hidden="true"
              >
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}

            {showShortcuts && (
              <div className="accessibility-shortcuts">
                <strong>Accessibility Tools</strong>

                <div className="shortcut-table">
                  <span>Voice Assistance</span>
                  <p>After this menu guide, the microphone will automatically listen for your command. You can also press and hold the Voice Assistance button or hold F9 on desktop.</p>

                  <span>Tab Reader</span>
                  <p>Say “turn on tab reader” after the guide, or press the Tab Reader button. Use this to hear focused items while using Tab.</p>

                  <span>Hold F9</span>
                  <p>Speak / Listen anytime</p>

                  <span>Release F9</span>
                  <p>Stop Listening</p>

                  <span>Esc</span>
                  <p>Stop Talking / Close</p>
                </div>
              </div>
            )}

            {isListening && (
              <div className="accessibility-privacy">
                Voice assistance is active and will continue listening after
                each response.
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {isOpen && (
        <div className="accessibility-tools-side">
          {showTools && (
            <div className="accessibility-tools-list">
              <button
                type="button"
                className="accessibility-mini"
                onClick={() => handleMiniAction(decreaseText)}
                aria-label="Decrease text size"
              >
                <Minus size={17} />
                <span>Text</span>
              </button>

              <button
                type="button"
                className="accessibility-mini"
                onClick={() => handleMiniAction(increaseText)}
                aria-label="Increase text size"
              >
                <Plus size={17} />
                <span>Text</span>
              </button>

              <button
                type="button"
                className="accessibility-mini"
                onClick={() => handleMiniAction(moveButton)}
                aria-label="Move accessibility button"
              >
                <MoveDiagonal size={17} />
                <span>Move</span>
              </button>

              <button
                type="button"
                className="accessibility-mini"
                onClick={() => handleMiniAction(readHelp)}
                aria-label="Read accessibility help"
              >
                <HelpCircle size={17} />
                <span>Help</span>
              </button>

              <button
                type="button"
                className="accessibility-mini"
                onClick={() => handleMiniAction(readButtons)}
                aria-label="Read visible buttons and links"
              >
                <MousePointerClick size={17} />
                <span>Buttons</span>
              </button>

              <button
                type="button"
                className="accessibility-mini"
                onClick={() => handleMiniAction(readFields)}
                aria-label="Read visible form fields"
              >
                <ListChecks size={17} />
                <span>Fields</span>
              </button>

              <button
                type="button"
                className="accessibility-mini"
                onClick={() => handleMiniAction(readSummary)}
                aria-label="Describe current page"
              >
                <Type size={17} />
                <span>Summary</span>
              </button>

              <button
                type="button"
                className="accessibility-mini"
                onClick={() => handleMiniAction(readPageContent)}
                aria-label="Read page content"
              >
                <Volume2 size={17} />
                <span>Read</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className="accessibility-tools-toggle"
            onClick={() => setShowTools((prev) => !prev)}
            aria-label={
              showTools ? "Hide accessibility tools" : "Show accessibility tools"
            }
          >
            {showTools ? "Hide" : "Tools"}
          </button>
        </div>
      )}

      <button
        type="button"
        className={`accessibility-main-button ${isOpen ? "open" : ""} ${
          isListening ? "listening" : ""
        }`}
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev;

            if (next) {
              setShowTools(false);
              window.setTimeout(speakInstructions, 100);
            } else {
              stopTalking();
              setShowTools(false);
              setShowShortcuts(false);
            }

            return next;
          });
        }}
        aria-label={
          isOpen ? "Close accessibility options" : "Open accessibility options"
        }
        aria-expanded={isOpen}
        aria-controls="accessibility-menu"
      >
        {isOpen ? <X size={30} /> : <Accessibility size={31} />}
      </button>
    </div>
  );
}