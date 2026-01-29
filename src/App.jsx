import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { startVoiceCapture, stopVoiceCapture } from "./voice/useVoiceInput";
import logo from "./assets/trio.png";
import imgRoler from "./assets/roler.jpg";
import imgBobkat from "./assets/bobkat.jpg";
import imgBaldozer from "./assets/baldozer.jpg";
import imgBashka from "./assets/bashka.jpg";


// Icons as SVG components
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const MicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);

const StopIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2"></rect>
  </svg>
);

const SpeakerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  </svg>
);



const LoaderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin">
    <line x1="12" y1="2" x2="12" y2="6"></line>
    <line x1="12" y1="18" x2="12" y2="22"></line>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
    <line x1="2" y1="12" x2="6" y2="12"></line>
    <line x1="18" y1="12" x2="22" y2="12"></line>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
  </svg>
);

// Audio Waveform Component
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const AudioWaveform = ({ isListening }) => {
  const barCount = 20;
  const [heights, setHeights] = useState(() => 
    Array.from({ length: barCount }, () => Math.random() * 30 + 10)
  );
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

 useEffect(() => {
  if (!isListening) {
    setHeights(
      Array.from({ length: barCount }, () => Math.random() * 30 + 10)
    );
    return;
  }

  if (isMobile) {
    const interval = setInterval(() => {
      setHeights(
        Array.from({ length: barCount }, () => Math.random() * 80 + 20)
      );
    }, 120);

    return () => clearInterval(interval);
  }

  const setupAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateWaveform = () => {
        if (!isListening || !analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        const step = Math.floor(dataArray.length / barCount);
        const newHeights = [];

        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i * step] || 0;
          newHeights.push(Math.max(10, (value / 255) * 80 + 10));
        }

        setHeights(newHeights);
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };

      updateWaveform();
    } catch (err) {
      console.error("Waveform mic error:", err);
    }
  };

  setupAudioAnalysis();

  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (
      audioContextRef.current &&
      audioContextRef.current.state !== "closed"
    ) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };
}, [isListening]);


  return (
    <div className="audio-waveform">
      {heights.map((height, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
};
const DeleteIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ReceiptIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

/* =======================
   STATIC MENU (INITIAL)
======================= */
const IMAGE_MAP = {
  "رول دجاج": imgRoler,
  "بوب كات": imgBobkat,
  "بلدوزر": imgBaldozer,
  "كرين باشكا": imgBashka,
  

};

const INITIAL_MENU = {
  sandwiches: [
    { id: 4, name: "رول دجاج", price: 16, image_url: null },
    { id: 5, name: "بوب كات", price: 17, image_url: null },
  ],
  meals: [
    { id: 6, name: "بلدوزر", price: 21, image_url: null },
    { id: 7, name: "كرين باشكا", price: 27, image_url: null },
  ],
  drinks: [
    { id: 8, name: "كولا", price: 3, image_url: null },
    { id: 9, name: "كابي", price: 3, image_url: null },
  ],
  sauces: [
    { id: 10, name: "متومة", price: 2, image_url: null },
    { id: 11, name: "طحينة", price: 1, image_url: null },
  ],
  appetizers: [],
};

const CATEGORY_LABELS = {
  sandwiches: "ساندويشات",
  meals: "وجبات",
  sauces: "صوصات",
  drinks: "مشروبات",
};

const CATEGORY_MAP = {
  "ساندويشات": "sandwiches",
  "وجبات": "meals",
  "صوصات": "sauces",
  "مشروبات": "drinks",
};

// Reverse map for category detection
const CATEGORY_KEYWORDS = {
  "مشروبات": ["مشروبات", "مشروب", "شراب", "كولا", "كابي", "عصير"],
  "ساندويشات": ["ساندويشات", "ساندويش", "رول", "سندويش"],
  "وجبات": ["وجبات", "وجبة", "بلدوزر", "كرين"],
  "صوصات": ["صوصات", "صوص", "متومة", "طحينة"],
};

/* =======================
   CONFIG
======================= */
const N8N_VOICE_WEBHOOK = "https://n8n.srv1004057.hstgr.cloud/webhook/trio";
const N8N_PHONE_WEBHOOK = "https://n8n.srv1004057.hstgr.cloud/webhook/triophone";
const SESSION_KEY = "zacses_session_id";

/* =======================
   HELPERS
======================= */

const generateRandomSessionId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/* Detect category from Arabic text */
const detectCategoryFromText = (text) => {
  if (!text) return null;
  
  const lowerText = text.toLowerCase();
  
  // Check each category's keywords
  for (const [arabicCategory, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return CATEGORY_MAP[arabicCategory] || null;
      }
    }
  }
  
  return null;
};

/* 🔴 CRITICAL FIX: normalize n8n items */
const normalizeN8nItems = (rawItems, detectedCategory = null) => {
  if (!rawItems) return [];

  // If object → array
  const list = Array.isArray(rawItems)
    ? rawItems
    : Object.values(rawItems);

  // Determine category name
  let categoryName = "مشروبات"; // default
  if (detectedCategory) {
    // Find Arabic name from category key
    const arabicName = Object.entries(CATEGORY_MAP).find(
      ([_, key]) => key === detectedCategory
    )?.[0];
    if (arabicName) categoryName = arabicName;
  } else if (list[0]?.category_name) {
    categoryName = list[0].category_name;
  }

  return list.map((item, index) => ({
    id: index + 1000,
    name: item.title || item.name || "عنصر",
    price: Number(item.price || 0),
    image_url: item.image_url || item.image || null, // ✅

    category_name: categoryName,
  }));
};
/* 🔴 normalize n8n order — support quantity; merge duplicates into one line */
const normalizeN8nOrder = (rawOrder, menuState) => {
  if (!rawOrder) return [];

  const list = Array.isArray(rawOrder)
    ? rawOrder
    : Object.values(rawOrder);

  const allMenuItems = Object.values(menuState).flat();

 const normalize = (s = "") =>
  s
    .replace(/\s+/g, "")
    .replace(/[ةه]/g, "ه")
    .replace(/[يى]/g, "ي")
    .replace("طحينه", "طحينية")
    .replace("طحينيه", "طحينية")
    .replace("متومه", "متومة")
    .replace("مثومة", "متومة")
    .replace("ثومة", "متومة")
    .replace("تومة", "متومة")
    .replace("كابي", "كابي")
    .replace("كبي", "كابي")
    .replace("قابي", "كابي")
    .replace("كافي", "كابي")
    .replace("قهوة", "كابي")
    .replace("عصير", "كابي")
    .toLowerCase();


  return list
    .map((item, index) => {
      const matched = allMenuItems.find(
        (m) => normalize(m.name) === normalize(item.title || item.name)
      );

      // ❌ إذا ما في match → نرجّع null
      if (!matched) return null;

      return {
        id: matched.id,
        lineId: `${Date.now()}-${index}-${Math.random()}`,
        name: matched.name,
        price: matched.price,
        quantity: Math.max(1, Number(item.quantity || 1)),
  image_url: matched.image_url || null, // ✅
      };
    })
    .filter(Boolean); // 🔥 نحذف أي صنف غير موجود
};


let audioContext = null;

/* =======================
   APP
======================= */
const getImageForItem = (item) => {
  return item.image_url || IMAGE_MAP[item.name] || null;
};

function App() {
 
const openModal = () => {
  setModalStep("method");
};

const [customerName, setCustomerName] = useState("");
const [customerPhone, setCustomerPhone] = useState("");
// Use environment variable for production, fallback to localhost for development
const BACKEND_API = process.env.REACT_APP_BACKEND_API || "http://localhost:4242";

// Debug: Log backend API URL (helpful for mobile debugging)
console.log("🔧 Backend API URL:", BACKEND_API);
console.log("🔧 Environment:", process.env.NODE_ENV);
console.log("🔧 REACT_APP_BACKEND_API:", process.env.REACT_APP_BACKEND_API);

  const [menuState, setMenuState] = useState(INITIAL_MENU);
  const [currentCategory, setCurrentCategory] = useState("sandwiches");
  const [order, setOrder] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [webhookItems, setWebhookItems] = useState([]);
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [, setPaymentMethod] = useState(null); // "cash" | "card"
const [orderType, setOrderType] = useState(null); // "delivery" | "pickup"
const [isCardPaymentInProgress, setIsCardPaymentInProgress] = useState(false);

const [address, setAddress] = useState("");
const [notes, setNotes] = useState("");
const [modalStep, setModalStep] = useState(null);
const [, setHasPlayedWelcome] = useState(false);
const [itemNotes, setItemNotes] = useState({}); // { [lineId]: "note text" }
const [noteTargetLineId, setNoteTargetLineId] = useState(null);
const [isNoteListening, setIsNoteListening] = useState(false);
const noteTargetLineIdRef = useRef(null);
const isNoteListeningRef = useRef(false);
const [conversationStarted, setConversationStarted] = useState(false); // Track if user started the conversation 
const [lookupPhone, setLookupPhone] = useState("");
const [previousOrders, setPreviousOrders] = useState([]);
const [isLoadingPreviousOrders, setIsLoadingPreviousOrders] = useState(false);
const [previousOrdersError, setPreviousOrdersError] = useState("");
const [showPhoneModal, setShowPhoneModal] = useState(true);
// customer | method | delivery | notes


  /* =======================
     SESSION
  ======================= */
  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = generateRandomSessionId();
      localStorage.setItem(SESSION_KEY, sid);
    }
    setSessionId(sid);
    
    // Don't play welcome audio automatically - wait for user to click "ابدأ المحادثة"
    // The audio will play when user clicks the start button
  }, []);

  /* =======================
     FIX 4: Clear order after Stripe success
  ======================= */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("from_payment") === "true") {
      console.log("✅ Payment success detected - clearing order");
      resetOrder();
      // Remove query param from URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);


  /* =======================
     AUDIO CLEANUP
  ======================= */
  useEffect(() => {
    return () => {
      // Cleanup audio on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  /* =======================
     SPEECH
  ======================= */
  const speak = (text) => {
    if (!("speechSynthesis" in window) || !text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const ar = voices.find((v) => v.lang.startsWith("ar"));
    if (ar) utterance.voice = ar;

    window.speechSynthesis.speak(utterance);
  };

  const botReply = (text, speakIt = true) => {
  if (speakIt) speak(text);
};


  /* =======================
     MENU UPDATE
  ======================= */
  const updateDynamicMenu = (items = [], categoryKey = null) => {
    if (!items.length) return;

    // Determine category
    let cat = categoryKey;
    let arabicCategory = "مشروبات";
    
    if (cat && CATEGORY_MAP[Object.keys(CATEGORY_MAP).find(key => CATEGORY_MAP[key] === cat)]) {
      // Category key is valid, find Arabic name
      const entry = Object.entries(CATEGORY_MAP).find(([_, key]) => key === cat);
      if (entry) arabicCategory = entry[0];
    } else {
      // Use category from items
      arabicCategory = items[0]?.category_name || "مشروبات";
      cat = CATEGORY_MAP[arabicCategory] || "drinks";
    }

    setMenuState((prev) => ({
      ...prev,
      [cat]: items.map((i, idx) => ({
        id: i.id || idx + 1,
        name: i.name,
        price: Number(i.price),
        image_url: i.image_url || null,
      })),
    }));

    // Automatically switch to show this category
    setCurrentCategory(cat);
    setWebhookItems(items); // Also store in webhook items for the special panel
    
    botReply(`هذه قائمة ${arabicCategory}`, false); // Don't speak, audio will play
  };

  /* =======================
     VOICE
  ======================= */
  const audioRef = useRef(null);
  const NOTE_PROMPT_AUDIO_URL =
    "https://svrgtdigntwgepklbyav.supabase.co/storage/v1/object/public/nmar/item_notes.mp3";

  const ensureMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (e) {
      console.error("❌ getUserMedia failed:", e);
      alert("الرجاء السماح باستخدام الميكروفون");
      return false;
    }
  };

  // Stop all playing audio and speech
  const stopAllAudio = () => {
    // Stop audio playback
    if (audioRef.current) {
      const a = audioRef.current;
      try {
        a.pause();
        a.currentTime = 0;
        // Resolve any awaiting "ended" listeners (used by note prompt)
        if (typeof a.onended === "function") a.onended();
      } catch {}
      audioRef.current = null;
    }
    
    // Cancel speech synthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    setIsPlayingAudio(false);
    console.log("🔇 All audio stopped");
  };

 const playAudioFromUrlAndWait = async (url) => {
  if (!url) return;

  try {
    // 🔓 Unlock audio context
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    // Stop previous audio
    stopAllAudio();

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.crossOrigin = "anonymous";

    await audio.play();
    setIsPlayingAudio(true);

    await new Promise((resolve) => {
      audio.onended = () => {
        setIsPlayingAudio(false);
        resolve();
      };
      audio.onerror = () => {
        setIsPlayingAudio(false);
        resolve();
      };
    });
  } catch (err) {
    console.error("❌ Audio playback failed:", err);
  }
 };

 const playAudioFromUrl = async (url) => {
  if (!url) return;

  try {
    // 🔓 Unlock audio context
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    // Stop previous audio
    stopAllAudio();

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.crossOrigin = "anonymous";

    await audio.play(); // ✅ WILL PLAY NOW
    console.log("🔊 Audio playing");
    setIsPlayingAudio(true);

    audio.onended = () => {
      setIsPlayingAudio(false);
    };

  } catch (err) {
    console.error("❌ Audio playback failed:", err);
  }
};

const fetchPreviousOrdersByPhone = async (phone) => {
  const clean = (phone || "").replace(/[^\d+]/g, "").trim();
  if (!clean) return;

  setPreviousOrdersError("");
  setIsLoadingPreviousOrders(true);
  setPreviousOrders([]); // reset before fetching

  const cleanNoLeadingZero = clean.replace(/^0+/, "") || clean;
  const formatted =
    /^059\d{7}$/.test(clean) ? `(059) ${clean.slice(3, 6)}-${clean.slice(6)}` : null;

  // Airtable often stores 059 as "(059) XXX-XXXX"; short numbers as plain digits.
  // Send primary filter value in Airtable's format so n8n exact match works.
  const primary = formatted ?? clean;

  const variants = [clean, primary];
  if (cleanNoLeadingZero !== clean) variants.push(cleanNoLeadingZero);
  const phone_variants = [...new Set(variants)];

  try {
    const payload = {
      phone_number: primary,
      phone: primary,
      customer_number: primary,
      phone_number_digits: clean,
      phone_number_alt: cleanNoLeadingZero !== clean ? cleanNoLeadingZero : undefined,
      phone_number_formatted: formatted || undefined,
      phone_variants,
      returnAll: true,
      return_all: true,
      all: true,
      fetch_all: true,
      limit: 50,
    };

    const res = await fetch(N8N_PHONE_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawText = await res.text().catch(() => "");
    let raw;
    try {
      raw = rawText ? JSON.parse(rawText) : null;
    } catch (e) {
      console.warn("triophone invalid JSON:", rawText);
      throw new Error("Invalid JSON");
    }

    if (!res.ok) {
      console.warn("triophone non-OK:", res.status, raw);
      throw new Error(`HTTP ${res.status}`);
    }

    // n8n may return:
    // - Array of orders
    // - Array of { json: order }
    // - Single order object (common when n8n responds with "First item")
    // - {} when no results
    let list = [];
    if (Array.isArray(raw)) {
      // Some n8n setups return [{ json: {...} }, ...]
      if (raw.length > 0 && raw.every((x) => x && typeof x === "object" && "json" in x)) {
        list = raw.map((x) => x.json).filter(Boolean);
      } else {
        list = raw;
      }
    } else {
      let output = raw?.output || raw?.response || raw?.result || raw;
      if (raw?.json && typeof raw.json === "object" && !Array.isArray(raw.json)) {
        output = raw.json;
      }
      if (!output && raw && typeof raw === "object" && !Array.isArray(raw)) {
        output = raw;
      }

      const isLikelyOrderRecord =
        output &&
        typeof output === "object" &&
        !Array.isArray(output) &&
        Object.keys(output).length > 0 &&
        (output.id || output.created_at || output.createdTime) &&
        (output.phone_number != null || output.total_price != null || output.orders != null || output.Orders != null || output.fields != null);

      if (isLikelyOrderRecord) {
        list = [output];
      } else {
        const candidate =
          output?.orders ||
          output?.previous_orders ||
          output?.order_history ||
          output?.data ||
          output?.result ||
          output;
        list = Array.isArray(candidate) ? candidate : [];
      }
    }

    // Always store plain objects (unwrap { json } if present)
    const normalized = list
      .map((x) => (x && typeof x === "object" && "json" in x ? x.json : x))
      .filter((x) => x && typeof x === "object" && Object.keys(x).length > 0);

    // Sort newest first if date exists
    const sorted = [...normalized].sort((a, b) => {
      const da = new Date(a?.created_at || a?.createdTime || a?.date || 0).getTime();
      const db = new Date(b?.created_at || b?.createdTime || b?.date || 0).getTime();
      return db - da;
    });

    console.log("📞 triophone raw:", Array.isArray(raw) ? `array[${raw.length}]` : "object", raw && typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw) : "");
    if (Array.isArray(raw) && raw.length > 0) {
      const e = raw[0];
      console.log("📞 raw[0] keys:", e && typeof e === "object" ? Object.keys(e) : typeof e, "has json?", e && typeof e === "object" && "json" in e);
      if (e?.json) console.log("📞 raw[0].json keys:", Object.keys(e.json || {}));
    }
    console.log("📞 triophone orders count:", sorted.length, "phone:", clean);
    if (sorted.length > 0) {
      const first = sorted[0];
      console.log("📞 first order keys:", Object.keys(first || {}));
      console.log("📞 first order.orders:", first?.orders, "Orders:", first?.Orders, "fields:", first?.fields);
    }
    setPreviousOrders(sorted);
  } catch (e) {
    console.warn("Previous orders fetch failed:", e);
    setPreviousOrders([]);
    setPreviousOrdersError("تعذر جلب الطلبات السابقة. تأكد من أن الويبهوك يعمل ويُرجع JSON.");
    throw e;
  } finally {
    setIsLoadingPreviousOrders(false);
  }
};



  const callWebhook = async (transcript = "") => {
    if (!sessionId) {
      console.error("❌ No session ID available");
      return;
    }
    
    console.log("🔵 ========== WEBHOOK CALL START ==========");
    console.log("🔵 Transcript:", transcript);
    console.log("🔵 Session ID:", sessionId);
    console.log("🔵 Webhook URL:", N8N_VOICE_WEBHOOK);
    console.log("🔵 User Agent:", navigator.userAgent);
    console.log("🔵 Protocol:", window.location.protocol);
    console.log("🔵 Hostname:", window.location.hostname);
    console.log("🔵 Is Mobile:", /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    
    setIsLoadingWebhook(true);
    
    // Detect category from transcript
    const detectedCategory = detectCategoryFromText(transcript);
    console.log("🔵 Detected category:", detectedCategory);
    
    try {
      const requestBody = { session_id: sessionId, transcript };
      console.log("🔵 Request body:", JSON.stringify(requestBody));
      
      const r = await fetch(N8N_VOICE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      console.log("🔵 Response status:", r.status, r.statusText);
      console.log("🔵 Response headers:", Object.fromEntries(r.headers.entries()));

      if (!r.ok) {
        const errorText = await r.text().catch(() => "Unknown error");
        console.error("❌ HTTP error:", r.status, r.statusText);
        console.error("❌ Error response:", errorText);
        throw new Error(`HTTP error! status: ${r.status} - ${errorText}`);
      }

      const raw = await r.json().catch(async (err) => {
        const text = await r.text().catch(() => "Could not read response");
        console.error("❌ Failed to parse JSON response:", err);
        console.error("❌ Response text:", text);
        throw new Error(`Invalid JSON response: ${text}`);
      });

      // 🔥 n8n returns ARRAY or object
      const data = Array.isArray(raw) ? raw[0] : raw;

      console.log("✅ ========== WEBHOOK RESPONSE RECEIVED ==========");
      console.log("✅ Response type:", Array.isArray(raw) ? "Array" : "Object");
      console.log("✅ WEBHOOK DATA:", JSON.stringify(data, null, 2));
      console.log("✅ Audio field:", data?.audio);
      console.log("✅ Items field:", data?.items);
      console.log("✅ Order field:", data?.order);

      // Handle items - check multiple possible locations
      const items = data?.items || data?.output?.items || data?.response?.items;
      // 🔥 Handle ORDER from voice
const voiceOrder =
  data?.order || data?.output?.order || data?.response?.order;
  // 🚨 حالة: المستخدم طلب صنف غير موجود نهائيًا
if (voiceOrder && voiceOrder.length > 0) {
  const normalizedOrder = normalizeN8nOrder(voiceOrder, menuState);

  if (normalizedOrder.length === 0) {
    stopAllAudio();
    playAudioFromUrl(
      "https://puwpdltpzxlbqphnhswz.supabase.co/storage/v1/object/public/Trio_voices/unavailable.mp3"
    );
    setIsLoadingWebhook(false);
    return;
  }
}


      // Check if we have items but no order - this means showing menu items
      const hasItems = items && items.length > 0;
      const hasOrder = voiceOrder && voiceOrder.length > 0;
      
      // Play audio if available (play first, then show items)
      // Check multiple possible locations for audio
      const audioUrl = data?.audio || data?.output?.audio || data?.response?.audio;
      
      // If showing items (menu) without order, play welcome.mp3
      if (hasItems && !hasOrder) {
        console.log("🎵 Playing welcome voice for items display");
        setTimeout(() => {
          playAudioFromUrl("https://puwpdltpzxlbqphnhswz.supabase.co/storage/v1/object/public/Trio_voices/welcome.mp3");
        }, 300);
      } else if (audioUrl && !hasOrder) {
        // Only play audioUrl if there's no order being added
        // IMPORTANT: Don't play welcome_voice.mp3 from n8n - it should only play once at app start
        if (audioUrl.includes('welcome_voice.mp3')) {
          console.log("⏸️ Skipping welcome_voice.mp3 from n8n - already played at app start");
        } else {
          console.log("🎵 Found audio URL:", audioUrl);
          setTimeout(() => {
            playAudioFromUrl(audioUrl);
          }, 300);
        }
      } else if (!hasOrder) {
        console.warn("⚠️ No audio found in response");
      }
      // If hasOrder, don't play menu/welcome audio while adding to order

if (voiceOrder && voiceOrder.length > 0) {
  // 🔒 FIX 3: Block adding items during card payment
  if (isCardPaymentInProgress) {
    console.log("🚫 Order ignored — card payment in progress");
    setIsLoadingWebhook(false);
    return;
  }

  const normalizedOrder = normalizeN8nOrder(voiceOrder, menuState);

  // 🚨 ولا صنف تطابق
  if (normalizedOrder.length === 0) {
    stopAllAudio();
    playAudioFromUrl(
      "https://puwpdltpzxlbqphnhswz.supabase.co/storage/v1/object/public/Trio_voices/unavailable.mp3"
    );
    setIsLoadingWebhook(false);
    return;
  }

  setOrder((prev) => [...prev, ...normalizedOrder]);

  setTimeout(() => {
    playAudioFromUrl(
      "https://puwpdltpzxlbqphnhswz.supabase.co/storage/v1/object/public/Trio_voices/added.mp3"
    );
  }, 300);
}

      if (items && items.length > 0) {
        console.log("📦 Found items:", items);
        const normalized = normalizeN8nItems(items, detectedCategory);
        const categoryToUse = detectedCategory || 
          (normalized[0]?.category_name ? CATEGORY_MAP[normalized[0].category_name] : null);
        
        console.log("📦 Normalized items:", normalized);
        console.log("📦 Setting webhookItems:", normalized);
        
        // Update webhook items for display
        setWebhookItems(normalized);
        
        // Update dynamic menu
        updateDynamicMenu(normalized, categoryToUse);
      } else {
        console.log("⚠️ No items found in response");
        setWebhookItems([]);
        // If no items but category was detected, still switch to that category
        if (detectedCategory) {
          setCurrentCategory(detectedCategory);
        }
      }
    } catch (error) {
      console.error("❌ Webhook error:", error);
      console.error("Error details:", error.message, error.stack);
      botReply("فشل الاتصال بالخدمة، الرجاء المحاولة مرة أخرى.", false);
    } finally {
      // Ensure loading state is reset even if there's an error
      console.log("🔄 Resetting loading state");
      setIsLoadingWebhook(false);
    }
  };
const sendVoiceToWorkflow = (text) => {
  if (!text?.trim()) return;

  console.log("📤 Sending voice to webhook:", text);

  callWebhook(text).catch((err) => {
    console.error("❌ Webhook failed:", err);
    botReply("فشل الاتصال بالخدمة", false);
  });
};


  const handleStartConversation = async () => {
    // Play welcome audio
    await playAudioFromUrl("https://wvaovsjwzdlyjcsyfvtk.supabase.co/storage/v1/object/public/Trio/welcome_trio.mp3");
    // Mark conversation as started
    setConversationStarted(true);
    setHasPlayedWelcome(true);
  };
const handleMicClick = async () => {
  // 🔓 unlock audio (required on mobile)
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  if (isListening) {
    setIsListening(false);
    stopVoiceCapture();
    return;
  }

  // ⏹️ Stop all playing audio when starting to record
  stopAllAudio();

  // Notes are captured via the per-item note button, not the main mic.
  if (isNoteListening) return;

  const hasPermission = await ensureMicrophonePermission();
  if (!hasPermission) return;

  console.log("🎤 Start voice capture (mobile safe)");
setIsListening(true);
setIsLoadingWebhook(true); // 🔥 SHOW "يفكر..." IMMEDIATELY

  // IMPORTANT: startVoiceCapture callback MUST NOT be async
startVoiceCapture((text) => {
  if (text?.trim()) {
    sendVoiceToWorkflow(text);
  } else {
    setIsLoadingWebhook(false);
    botReply("لم يتم التعرف على الصوت", false);
  }

  // ⏳ MOBILE-SAFE CLEANUP
  setTimeout(() => {
    setIsListening(false);
    stopVoiceCapture();
  }, 300);
});

};

  // const handleMicClick = async () => {
  //   // 🔓 unlock audio on user gesture
  //   if (!audioContext) {
  //     audioContext = new (window.AudioContext || window.webkitAudioContext)();
  //   }
  //   if (audioContext.state === "suspended") {
  //     await audioContext.resume();
  //   }

  //   if (isListening) {
  //     setIsListening(false);
  //     await stopVoiceCapture();
  //     return;
  //   }

  //   // On mobile, explicitly request permission first
  //   // This ensures the permission prompt appears
  //   const hasPermission = await checkMicrophonePermission();
  //   if (!hasPermission) {
  //     setIsListening(false);
  //     return;
  //   }

  //   console.log("🎤 Starting voice capture...");
  //   console.log("🎤 User Agent:", navigator.userAgent);
  //   console.log("🎤 Protocol:", window.location.protocol);
  //   console.log("🎤 Hostname:", window.location.hostname);
  //   console.log("🎤 Is Mobile:", /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    
  //   setIsListening(true);
    
  //   try {
  //     await startVoiceCapture(async (text) => {
  //       console.log("🎤 Voice text received:", text);
  //       console.log("🎤 Text length:", text ? text.length : 0);
  //       if (text && text.trim().length > 0) {
  //         await sendVoiceToWorkflow(text);
  //       } else {
  //         console.warn("⚠️ Empty text received from voice capture");
  //         botReply("لم يتم التعرف على الصوت، الرجاء المحاولة مرة أخرى.", false);
  //       }
  //       setIsListening(false);
  //       await stopVoiceCapture();
  //     });
  //   } catch (error) {
  //     console.error("❌ Failed to start voice capture:", error);
  //     console.error("❌ Error name:", error.name);
  //     console.error("❌ Error message:", error.message);
  //     console.error("❌ Error stack:", error.stack);
  //     setIsListening(false);
  //     // Error message already shown in startVoiceCapture
  //     // On mobile, sometimes we need to retry
  //     if (error.message && error.message.includes("permission")) {
  //       // Permission issue - user needs to grant access
  //       console.log("🔒 Permission issue detected, user needs to grant access");
  //     }
  //   }
  // };


  /* =======================
     ORDER
  ======================= */
 const addToOrder = (item, quantity = 1) => {
  // 🔒 FIX 3: Block adding items during card payment
  if (isCardPaymentInProgress) {
    console.log("🚫 Cannot add item — card payment in progress");
    return;
  }

  const qty = Math.max(1, Number(quantity));
  setOrder((o) => {
    const key = (i) => `${i.id ?? ""}|${i.name}|${i.price}`;
    const itemKey = `${item.id ?? ""}|${item.name}|${item.price}`;
    const existingIdx = o.findIndex((i) => key(i) === itemKey);
    if (existingIdx >= 0) {
      const next = [...o];
      const prev = next[existingIdx];
      next[existingIdx] = {
        ...prev,
        quantity: (prev.quantity ?? 1) + qty,
      };
      return next;
    }
    const lineId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return [...o, { ...item, lineId, quantity: qty }];
  });

  // Play "تم إضافة الصنف" audio only (no auto notes prompt)
  const playAddConfirmation = async () => {
    stopAllAudio();
    try {
      const addedAudio = new Audio("https://puwpdltpzxlbqphnhswz.supabase.co/storage/v1/object/public/Trio_voices/added.mp3");
      addedAudio.crossOrigin = "anonymous";
      await addedAudio.play();
    } catch (err) {
      console.error("Error playing added audio:", err);
    }
  };

  setTimeout(() => {
    playAddConfirmation();
  }, 250);
};


  const removeFromOrder = (index) => {
    setOrder((o) => {
      const removed = o[index];
      if (removed?.lineId) {
        setItemNotes((prev) => {
          const next = { ...prev };
          delete next[removed.lineId];
          return next;
        });
      }
      return o.filter((_, i) => i !== index);
    });
  };

  const total = useMemo(
    () =>
      order.reduce(
        (sum, i) => sum + (i.price || 0) * (i.quantity ?? 1),
        0
      ),
    [order]
  );
/* =======================
   MODAL RENDERERS
======================= */

const renderCustomerModal = () => (
  <>
    <h2>معلومات العميل</h2>

    <input
      placeholder="الاسم"
      value={customerName}
      onChange={(e) => setCustomerName(e.target.value)}
    />

    <input
      placeholder="الهاتف"
      value={customerPhone}
      onChange={(e) => setCustomerPhone(e.target.value)}
    />

   <button className="cash-btn" onClick={() => finalizeOrder("cash")}>💵 دفع نقدي</button>
<button className="pay-btn" onClick={() => finalizeOrder("card")}>💳 دفع بالبطاقة</button>

    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
      <button className="cancel-btn" onClick={() => setModalStep(null)}>
        إلغاء
      </button>
    </div>
  </>
);

const renderMethodModal = () => (
  <>
    <h2>نوع الطلب</h2>

    <button
      className="method-btn"
      onClick={() => {
        setOrderType("delivery");
        setModalStep("delivery");
      }}
    >
      🚚 توصيل
    </button>

    <button
      className="method-btn"
      onClick={() => {
        setOrderType("pickup");
        setModalStep("notes");
      }}
    >
      🏠 استلام من المطعم
    </button>

    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
      <button className="cancel-btn" onClick={() => setModalStep(null)}>
        إلغاء
      </button>
    </div>
  </>
);



const renderDeliveryModal = () => (
  <>
    <h2>تفاصيل التوصيل</h2>

    <input
      placeholder="عنوان التوصيل"
      value={address}
      onChange={(e) => setAddress(e.target.value)}
    />

    <textarea
      placeholder="ملاحظات (اختياري)"
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
    />

    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
      <button className="cancel-btn" onClick={() => setModalStep(null)}>
        إلغاء
      </button>
      <button
        className="confirm-btn"
        onClick={() => setModalStep("customer")}
      >
        متابعة
      </button>
    </div>
  </>
);


const renderNotesModal = () => (
  <>
    <h2>ملاحظات الطلب</h2>

    <textarea
      placeholder="ملاحظات (اختياري)"
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
    />

    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
      <button className="cancel-btn" onClick={() => setModalStep(null)}>
        إلغاء
      </button>
      <button
        className="confirm-btn"
        onClick={() => setModalStep("customer")}
      >
        متابعة
      </button>
    </div>
  </>
);


const resetOrder = () => {
  setOrder([]);
  setCustomerName("");
  setCustomerPhone("");
  setAddress("");
  setNotes("");
  setItemNotes({});
  setPaymentMethod(null);
  setOrderType(null);
  setModalStep(null);
  setIsCardPaymentInProgress(false);
};

const finalizeOrder = async (method) => {
  if (!customerName || !customerPhone) {
    alert("الرجاء إدخال الاسم والهاتف");
    return;
  }

  // Prepare order items with notes
  // Prepare order items (no individual item notes)
  const orderItemsWithNotes = order.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity ?? 1,
  }));

  const itemNotesLines = order
    .map((item) => {
      const lineId = item?.lineId;
      const note = lineId ? itemNotes[lineId] : "";
      if (!note) return null;
      return `- ${item.name}: ${note}`;
    })
    .filter(Boolean)
    .join("\n");

  const combinedNotes = [notes?.trim(), itemNotesLines ? `ملاحظات على الأصناف:\n${itemNotesLines}` : ""]
    .filter(Boolean)
    .join("\n\n");

  const payload = {
    customer_name: customerName,
    customer_number: customerPhone,
    order_items: orderItemsWithNotes,
    total_price: total,
    session_id: sessionId,
    order_type: orderType,
    address: orderType === "delivery" ? address : null,
    notes: combinedNotes, // General + per-item notes
  };

  try {
    // 💵 CASH — DIRECT SAVE
    if (method === "cash") {
      console.log("💰 CASH PAYMENT - Saving order");
      console.log("💰 URL:", `${BACKEND_API}/cash-order`);
      console.log("💰 Payload:", JSON.stringify(payload, null, 2));
      
      const res = await fetch(`${BACKEND_API}/cash-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("💰 Response status:", res.status);
      const responseText = await res.text();
      console.log("💰 Response body:", responseText);

      if (!res.ok) {
        console.error("❌ Cash order failed:", res.status, responseText);
        throw new Error(`HTTP ${res.status}: ${responseText || "فشل إرسال الطلب"}`);
      }

      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = responseText;
      }
      
      console.log("✅ Cash order success:", data);

      alert("✅ تم تقديم الطلبك بنجاح!\nرقم الجلسة: " + sessionId + "\nسيتم توصيل طلبك قريباً");
      setModalStep(null);
      resetOrder();
      return;
    }

    // 💳 CARD — STRIPE ONLY (DO NOT SAVE - ONLY CREATE SESSION)
    console.log("💳 CARD PAYMENT - Creating Stripe session only (NO save)");
    console.log("💳 URL:", `${BACKEND_API}/create-checkout-session`);
    console.log("💳 Payload:", JSON.stringify(payload, null, 2));
    
    // ⚠️ IMPORTANT: Do NOT save order here!
    // Backend /create-checkout-session should ONLY create Stripe session
    // Webhook will save the order after successful payment
    const res = await fetch(`${BACKEND_API}/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("❌ Create checkout session failed:", res.status, errorData);
      throw new Error(`HTTP ${res.status}: ${errorData.message || "فشل إنشاء جلسة الدفع"}`);
    }

    const data = await res.json();
    console.log("✅ Checkout session created:", data);
    
    if (!data.checkout_url) {
      throw new Error("لم يتم استلام رابط الدفع من الخادم");
    }

    console.log("💳 Redirecting to Stripe checkout...");
   setIsCardPaymentInProgress(true); // 🔒 LOCK ORDER
window.location.href = data.checkout_url;


  } catch (err) {
    console.error("❌ Error in handleSubmitOrder:", err);
    alert(`فشل تقديم الطلب: ${err.message || "حدث خطأ غير متوقع"}`);
  }
};


  const handlePhoneModalSubmit = async () => {
    const phone = lookupPhone.trim();
    if (!phone) return;
    setPreviousOrdersError("");
    try {
      await fetchPreviousOrdersByPhone(phone);
      setShowPhoneModal(false);
    } catch {
      /* Error already set in fetchPreviousOrdersByPhone; stay in modal */
    }
  };

  /* =======================
     UI
  ======================= */
  if (showPhoneModal) {
    return (
      <div className="app-shell">
        <div className="phone-modal-overlay">
          <div className="phone-modal">
            <h2>مرحباً بك</h2>
            <p className="phone-modal-sub">أدخل رقم الجوال لمتابعة وعرض آخر الطلبات</p>
            <input
              className="phone-modal-input"
              placeholder="رقم الجوال"
              value={lookupPhone}
              onChange={(e) => {
                setLookupPhone(e.target.value);
                setPreviousOrdersError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePhoneModalSubmit();
              }}
              inputMode="tel"
              autoFocus
            />
            {previousOrdersError && (
              <div className="phone-modal-error">{previousOrdersError}</div>
            )}
            <button
              className="phone-modal-btn"
              onClick={handlePhoneModalSubmit}
              disabled={!lookupPhone.trim() || isLoadingPreviousOrders}
            >
              {isLoadingPreviousOrders ? (
                <>
                  <LoaderIcon /> جاري جلب الطلبات...
                </>
              ) : (
                "متابعة"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="navbar">
  <div className="navbar-left">
    <img src={logo} alt="Trio Shawarma" className="navbar-logo" />
    <div className="navbar-brand">
      <span className="brand-name">Trio shawrma</span>
      <span className="brand-sub">where food is engineering</span>
    </div>
  </div>
  <div className="navbar-right">
    <span className="navbar-status">متصل</span>
  </div>
</header>

      <div className="main-layout">
        <div className="left-pane purple-panel">
        {/* Categories Bar */}
<div className="categories-bar">
  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
    <button
      key={key}
      className={`category-btn ${currentCategory === key ? "active" : ""}`}
      onClick={() => {
        setCurrentCategory(key);
        setWebhookItems([]); // hide searched items
      }}
    >
      {label}
    </button>
  ))}
</div>
{/* Static Menu Items */}
{currentCategory && webhookItems.length === 0 && (
  <div className="menu-items-grid">
    {menuState[currentCategory]?.map((item) => (
     <div className="menu-item-card">
 {getImageForItem(item) && (
  <img
    src={getImageForItem(item)}
    alt={item.name}
    className="menu-item-image"
    loading="lazy"
  />
)}

  <h3>{item.name}</h3>
  <p className="item-price">{item.price} شيكل</p>

        <button
          className="add-item-btn"
          onClick={() => addToOrder(item)}
        >
          <PlusIcon /> إضافة
        </button>
      </div>
    ))}
  </div>
)}

          {/* Searched Items Section - Above waveform */}
          {webhookItems.length > 0 && (
            <div className="searched-items-section">
              <div className="searched-items-grid">
                {webhookItems.map((item) => (
                  <div className="searched-item-card">
  {getImageForItem(item) && (
  <img
    src={getImageForItem(item)}
    alt={item.name}
    className="menu-item-image"
    loading="lazy"
  />
)}


  <h3>{item.name}</h3>
  <p className="item-price">{item.price} شيكل</p>

                    <button 
                      className="add-item-btn"
                      onClick={() => addToOrder(item)}
                    >
                      <PlusIcon /> إضافة
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voice Recording Section */}
          <div className="voice-center">
            {!conversationStarted ? (
              /* Start Conversation Button - shown before conversation starts */
              <button
                className="start-conversation-btn"
                onClick={handleStartConversation}
              >
                ابدأ المحادثة
              </button>
            ) : (
              <>
                {/* Loading Indicator - Show when processing voice */}
                {isLoadingWebhook && (
                  <div className="audio-indicator" style={{ background: 'linear-gradient(135deg, #3b1a7a, #5b21b6)' }}>
                    <LoaderIcon />
                    <span>🤔 يفكرر...</span>
                  </div>
                )}
                
                {/* Audio Waveform - Always visible */}
                {!isLoadingWebhook && <AudioWaveform isListening={isListening} />}
                
                {/* Microphone Icon */}
                <button
                  className={`voice-circle ${isListening ? "listening" : ""}`}
                  onClick={handleMicClick}
                  disabled={isLoadingWebhook || isNoteListening || isCardPaymentInProgress}
                >
                  {isListening ? <StopIcon /> : <MicIcon />}
                </button>
                
                {/* Audio Playing Indicator */}
                {isPlayingAudio && !isLoadingWebhook && (
                  <div className="audio-indicator">
                    <span className="audio-wave"><SpeakerIcon /></span>
                    <span>جاري تشغيل الصوت...</span>
                  </div>
                )}
                
              
              </>
            )}
          </div>
        </div>

       <aside className="panel order-panel yellow-panel">
  <h2><ReceiptIcon /> طلبك</h2>

  <div className="order-split">
    <div className="order-col current-order-col">
      {order.length === 0 ? (
        <p className="empty-order">الطلب فارغ</p>
      ) : (
        <>
          <div className="order-items">
            {order.map((i, idx) => (
              <div key={i.lineId || idx} className="order-item">
                <div className="order-item-main">
                  <div className="order-item-title">
                    <span>
                      {i.name}
                      {(i.quantity ?? 1) > 1 ? ` × ${i.quantity}` : ""}
                      {" — "}
                      {(i.price || 0) * (i.quantity ?? 1)} شيكل
                    </span>
                  </div>
                  {i.lineId && itemNotes[i.lineId] && (
                    <div className="order-item-note">
                      ملاحظة: {itemNotes[i.lineId]}
                    </div>
                  )}
                </div>

                <div className="order-item-actions">
                  <button
                    className={`item-note-btn ${
                      isNoteListening && noteTargetLineId === i.lineId ? "listening" : ""
                    } ${itemNotes[i.lineId] ? "has-note" : ""}`}
                    onClick={async () => {
                      const lineId = i.lineId;
                      if (!lineId) return;

                      // Toggle off if same item is currently listening
                      if (isNoteListening && noteTargetLineId === lineId) {
                        setIsNoteListening(false);
                        setNoteTargetLineId(null);
                        isNoteListeningRef.current = false;
                        noteTargetLineIdRef.current = null;
                        stopVoiceCapture();
                        stopAllAudio();
                        return;
                      }

                      // Don't start note capture if main mic/webhook is busy
                      if (isLoadingWebhook || isListening) return;

                      // Stop any current audio before prompting
                      stopAllAudio();

                      const hasPermission = await ensureMicrophonePermission();
                      if (!hasPermission) return;

                      setNoteTargetLineId(lineId);
                      setIsNoteListening(true);
                      noteTargetLineIdRef.current = lineId;
                      isNoteListeningRef.current = true;

                      // Play STATIC prompt audio, then start capture from this button
                      await playAudioFromUrlAndWait(NOTE_PROMPT_AUDIO_URL);
                      if (!isNoteListeningRef.current || noteTargetLineIdRef.current !== lineId) return;

                      startVoiceCapture((text) => {
                        const t = text?.trim();
                        if (t) {
                          setItemNotes((prev) => {
                            const existing = (prev?.[lineId] || "").trim();
                            const nextText = existing ? `${existing}\n${t}` : t;
                            return { ...prev, [lineId]: nextText };
                          });
                        }

                        setTimeout(() => {
                          setIsNoteListening(false);
                          setNoteTargetLineId(null);
                          isNoteListeningRef.current = false;
                          noteTargetLineIdRef.current = null;
                          stopVoiceCapture();
                        }, 300);
                      });
                    }}
                    disabled={
                      isLoadingWebhook ||
                      isListening ||
                      (isNoteListening && noteTargetLineId !== i.lineId)
                    }
                    title="تسجيل ملاحظة على هذا الصنف"
                  >
                   اضف ملاحظة
                  </button>

                  <button
                    className="remove-item-btn"
                    onClick={() => removeFromOrder(idx)}
                  >
                    <DeleteIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="order-total">
            <strong>المجموع: {total} شيكل</strong>
          </div>
        </>
      )}

      <button className="confirm" onClick={openModal} disabled={order.length === 0}>
        تأكيد الطلب
      </button>
    </div>

    <div className="order-col previous-orders-col">
      <div className="previous-orders-header">
        <strong>آخر الطلبات</strong>
        <span className="previous-orders-sub">حسب رقم الجوال</span>
      </div>
      {previousOrdersError && (
        <div className="previous-orders-error">{previousOrdersError}</div>
      )}
      {isLoadingPreviousOrders ? (
        <div className="previous-orders-loading">
          <LoaderIcon /> جاري جلب الطلبات...
        </div>
      ) : previousOrders.length === 0 ? (
        <div className="previous-orders-empty">
          لا يوجد طلبات سابقة
        </div>
      ) : (
        <div className="previous-orders-list">
          <div className="previous-orders-count">
            عدد الطلبات: {previousOrders.length}
          </div>
          {previousOrders.map((o, index) => {
            const order = o?.json ?? o;
            const raw =
              order?.orders ??
              order?.Orders ??
              order?.order ??
              order?.order_items ??
              order?.items ??
              order?.fields?.orders ??
              order?.fields?.Orders ??
              order?.fields?.order ??
              [];
            const items =
              typeof raw === "string"
                ? raw
                    .split(/[,،\n]+/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                : Array.isArray(raw)
                  ? raw
                      .map((it) => (typeof it === "string" ? it : (it?.name || it?.title || "")))
                      .map((s) => String(s).trim())
                      .filter(Boolean)
                  : [];

            return (
              <div key={order?.id ?? o?.id ?? index} className="previous-order-line">
                {items.length > 0 ? (
                  <div className="previous-orders-chips">
                    {items.map((name, idx) => (
                      <span key={`${order?.id ?? index}-${name}-${idx}`} className="order-chip">
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="previous-orders-empty inline" title={JSON.stringify(Object.keys(order || {}))}>
                    — {index === 0 && previousOrders.length > 0 ? `(مفاتيح: ${Object.keys(order || {}).join(", ")})` : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
</aside>
{modalStep && (
  <div className="modal-overlay">
    <div className="modal">
      {modalStep === "customer" && renderCustomerModal()}
      {modalStep === "method" && renderMethodModal()}
      {modalStep === "delivery" && renderDeliveryModal()}
      {modalStep === "notes" && renderNotesModal()}
    </div>
  </div>
)}


      </div>
    </div>
  );
}

export default App;
