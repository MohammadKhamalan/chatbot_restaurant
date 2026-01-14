import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { startVoiceCapture, stopVoiceCapture } from "./voice/useVoiceInput";
import logo from "./assets/trio.png";

// Icons as SVG components
const ClipboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
  </svg>
);

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

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
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
      // Static heights when not listening
      setHeights(Array.from({ length: barCount }, () => Math.random() * 30 + 10));
      
      // Cleanup audio resources
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      return;
    }

    // Setup audio analysis when listening
    const setupAudioAnalysis = async () => {
      try {
        // Get microphone stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        streamRef.current = stream;

        // Create audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        // Create analyser
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // Smaller FFT for smoother bars
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // Connect microphone to analyser
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        // Analyze audio data
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateWaveform = () => {
          if (!isListening || !analyserRef.current) {
            return;
          }

          analyserRef.current.getByteFrequencyData(dataArray);

          // Map frequency data to bar heights
          const newHeights = [];
          const step = Math.floor(dataArray.length / barCount);
          
          for (let i = 0; i < barCount; i++) {
            const index = i * step;
            const value = dataArray[index] || 0;
            // Map 0-255 to 10-90% height
            const height = Math.max(10, (value / 255) * 80 + 10);
            newHeights.push(height);
          }

          setHeights(newHeights);
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        };

        updateWaveform();
      } catch (error) {
        console.error("Error accessing microphone for waveform:", error);
        // Fallback to random animation if microphone access fails
        // Don't show error to user - waveform is just visual
        const interval = setInterval(() => {
          setHeights(Array.from({ length: barCount }, () => Math.random() * 80 + 20));
        }, 150);
        return () => clearInterval(interval);
      }
    };

    setupAudioAnalysis();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
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

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const CreditCardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
    <line x1="1" y1="10" x2="23" y2="10"></line>
  </svg>
);


/* =======================
   STATIC MENU (INITIAL)
======================= */
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
  appetizers: "مقبلات",
};

const CATEGORY_MAP = {
  "ساندويشات": "sandwiches",
  "وجبات": "meals",
  "صوصات": "sauces",
  "مشروبات": "drinks",
  "مقبلات": "appetizers",
};

// Reverse map for category detection
const CATEGORY_KEYWORDS = {
  "مشروبات": ["مشروبات", "مشروب", "شراب", "كولا", "كابي", "عصير"],
  "ساندويشات": ["ساندويشات", "ساندويش", "رول", "سندويش"],
  "وجبات": ["وجبات", "وجبة", "بلدوزر", "كرين"],
  "صوصات": ["صوصات", "صوص", "متومة", "طحينة"],
  "مقبلات": ["مقبلات", "مقبل"],
};

/* =======================
   CONFIG
======================= */
const N8N_VOICE_WEBHOOK = "https://n8n.srv1004057.hstgr.cloud/webhook/trio";
const N8N_CHAT_WEBHOOK = "https://n8n.srv1004057.hstgr.cloud/webhook/restaurant";
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
    image_url: null,
    category_name: categoryName,
  }));
};
/* 🔴 normalize n8n order */
const normalizeN8nOrder = (rawOrder) => {
  if (!rawOrder) return [];

  const list = Array.isArray(rawOrder)
    ? rawOrder
    : Object.values(rawOrder);

  return list.map((item, index) => ({
    id: Date.now() + index,
    name: item.title || item.name || "عنصر",
    price: Number(item.price || 0),
    image_url: null,
  }));
};

let audioContext = null;

/* =======================
   APP
======================= */
function App() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text:
        "مرحبًا بك في زَكسِس ✨\n" +
        "اسألني عن الساندويشات، الوجبات، المشروبات أو أي شيء في القائمة.",
    },
  ]);
const openModal = () => {
  setModalStep("method");
};

const [customerName, setCustomerName] = useState("");
const [customerPhone, setCustomerPhone] = useState("");
const [isPaying, setIsPaying] = useState(false);
const BACKEND_API = "http://localhost:4242"; // change if deployed

  const [menuState, setMenuState] = useState(INITIAL_MENU);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [order, setOrder] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [webhookItems, setWebhookItems] = useState([]);
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [micPermissionStatus, setMicPermissionStatus] = useState(null); // 'granted', 'denied', 'prompt', null
  const [paymentMethod, setPaymentMethod] = useState(null); // "cash" | "card"
const [orderType, setOrderType] = useState(null); // "delivery" | "pickup"
const [address, setAddress] = useState("");
const [notes, setNotes] = useState("");
const [modalStep, setModalStep] = useState(null); 
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
  }, []);

  /* =======================
     CHECK MICROPHONE PERMISSION ON MOUNT
  ======================= */
  useEffect(() => {
    // Check microphone permission status on mount
    const checkPermission = async () => {
      if (!navigator.permissions || !navigator.permissions.query) {
        return;
      }
      
      try {
        const result = await navigator.permissions.query({ name: 'microphone' });
        setMicPermissionStatus(result.state);
      } catch (error) {
        console.error("Error checking microphone permission:", error);
      }
    };
    
    checkPermission();
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
    setMessages((m) => [...m, { id: Date.now(), sender: "bot", text }]);
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
     CHAT
  ======================= */
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const callChatbot = async (userText) => {
    setMessages((m) => [...m, { id: Date.now(), sender: "user", text: userText }]);

    // Detect category from user text
    const detectedCategory = detectCategoryFromText(userText);

    try {
      const r = await fetch(N8N_CHAT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_message: userText,
          conversation: messagesRef.current,
          session_id: sessionId,
        }),
      });

      const raw = await r.json();

      // 🔥 unwrap array if exists
      const data = Array.isArray(raw) ? raw[0] : raw;
      const output = data?.output || data;

      console.log("CHAT DATA:", output);

      if (output?.response) botReply(output.response, true);

      if (output?.items) {
        const normalized = normalizeN8nItems(output.items, detectedCategory);
        const categoryToUse = detectedCategory || 
          (normalized[0]?.category_name ? CATEGORY_MAP[normalized[0].category_name] : null);
        updateDynamicMenu(normalized, categoryToUse);
      }
    } catch {
      botReply("تعذر الاتصال بالخدمة، حاول مرة أخرى.");
    }
  };
const handleCashPayment = () => {
  setModalStep("method");

  if (orderType === "delivery") {
    setModalStep("delivery"); // next modal asks for address & notes
  } else if (orderType === "pickup") {
    setModalStep("notes"); // ask only for notes
  }
};
const handleCardPayment = async () => {
  if (!customerName || !customerPhone) {
    alert("Enter name and phone");
    return;
  }

  setIsPaying(true);

  try {
    const res = await fetch(`${BACKEND_API}/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: customerName,
        customer_number: customerPhone,
        total_price: total,
        order_items: order,
        session_id: sessionId,
      }),
    });

    const data = await res.json();

    if (!data.checkout_url) throw new Error("No checkout URL received");

    window.location.href = data.checkout_url; // Redirect to Stripe
  } catch (err) {
    console.error(err);
    alert("Failed to start card payment");
    setIsPaying(false);
  }
};

const finalizeCashOrder = async () => {
  // Prepare payload
  const payload = {
    customer_name: customerName,
    customer_number: customerPhone,
    order_items: order,
    total_price: total,
    session_id: sessionId,
    order_type: orderType,
    address,
    notes,
  };

  try {
    const res = await fetch(`${BACKEND_API}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.success) {
      botReply("✅ Your order has been placed successfully!");
      setModalStep(null);
      setOrder([]);
    } else {
      botReply("❌ Something went wrong with your order, please try again.");
    }
  } catch (err) {
    console.error(err);
    botReply("❌ Could not finalize your order, try again.");
  }
};

  /* =======================
     VOICE
  ======================= */
  const audioRef = useRef(null);

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

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



  const callWebhook = async (transcript = "") => {
    if (!sessionId) return;
    
    setIsLoadingWebhook(true);
    
    // Detect category from transcript
    const detectedCategory = detectCategoryFromText(transcript);
    console.log("Detected category from transcript:", detectedCategory, transcript);
    
    try {
      const r = await fetch(N8N_VOICE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, transcript }),
      });

      const raw = await r.json();

      // 🔥 n8n returns ARRAY or object
      const data = Array.isArray(raw) ? raw[0] : raw;

      console.log("WEBHOOK DATA:", data);
      console.log("Audio field:", data?.audio);
      console.log("Items field:", data?.items);

      // Play audio if available (play first, then show items)
      // Check multiple possible locations for audio
      const audioUrl = data?.audio || data?.output?.audio || data?.response?.audio;
      if (audioUrl) {
        console.log("🎵 Found audio URL:", audioUrl);
        // Small delay to ensure UI is ready
        setTimeout(() => {
          playAudioFromUrl(audioUrl);
        }, 100);
      } else {
        console.warn("⚠️ No audio found in response");
      }

      // Handle items - check multiple possible locations
      const items = data?.items || data?.output?.items || data?.response?.items;
      // 🔥 Handle ORDER from voice
const voiceOrder =
  data?.order || data?.output?.order || data?.response?.order;

if (voiceOrder && voiceOrder.length > 0) {
  console.log("🛒 Found order from voice:", voiceOrder);

  const normalizedOrder = normalizeN8nOrder(voiceOrder);

  setOrder((prev) => [...prev, ...normalizedOrder]);
}

      if (items) {
        console.log("📦 Found items:", items);
        const normalized = normalizeN8nItems(items, detectedCategory);
        const categoryToUse = detectedCategory || 
          (normalized[0]?.category_name ? CATEGORY_MAP[normalized[0].category_name] : null);
        
        updateDynamicMenu(normalized, categoryToUse);
      } else {
        setWebhookItems([]);
        // If no items but category was detected, still switch to that category
        if (detectedCategory) {
          setCurrentCategory(detectedCategory);
        }
      }
    } catch (error) {
      console.error("Webhook error:", error);
      botReply("Failed to connect to service, please try again.", false);
    } finally {
      setIsLoadingWebhook(false);
    }
  };

  const sendVoiceToWorkflow = async (text) => {
    await callWebhook(text);
  };

  // Check microphone permission status
  const checkMicrophonePermissionStatus = async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      // Fallback for browsers that don't support permissions API
      return null;
    }
    
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      setMicPermissionStatus(result.state);
      return result.state;
    } catch (error) {
      console.error("Error checking microphone permission:", error);
      return null;
    }
  };

  // Check and request microphone permission explicitly
  const checkMicrophonePermission = async () => {
    try {
      // Request permission explicitly using getUserMedia
      // This ensures the permission prompt appears on mobile
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionStatus('granted');
      return true;
    } catch (error) {
      console.error("Microphone permission error:", error);
      
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setMicPermissionStatus('denied');
        alert(
          "Microphone permission is required for voice input.\n\n" +
          "Please:\n" +
          "1. Click 'Allow' when your browser asks for microphone permission\n" +
          "2. Check your browser settings if the prompt doesn't appear\n" +
          "3. Make sure no other apps are using the microphone\n" +
          "4. Try refreshing the page and clicking the microphone again"
        );
        return false;
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        alert("No microphone found. Please connect a microphone and try again.");
        return false;
      } else {
        alert(`Microphone access error: ${error.message}. Please try again.`);
        return false;
      }
    }
  };

  const handleMicClick = async () => {
    // 🔓 unlock audio on user gesture
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (isListening) {
      setIsListening(false);
      await stopVoiceCapture();
      return;
    }

    // On mobile, explicitly request permission first
    // This ensures the permission prompt appears
    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    
    try {
      await startVoiceCapture(async (text) => {
        await sendVoiceToWorkflow(text);
        setIsListening(false);
        await stopVoiceCapture();
      });
    } catch (error) {
      console.error("Failed to start voice capture:", error);
      setIsListening(false);
      // Error message already shown in startVoiceCapture
    }
  };


  /* =======================
     ORDER
  ======================= */
 const addToOrder = (item) => {
  setOrder((o) => [...o, item]);
};


  const removeFromOrder = (index) => {
    setOrder((o) => o.filter((_, i) => i !== index));
  };

  const total = useMemo(
    () => order.reduce((sum, i) => sum + (i.price || 0), 0),
    [order]
  );
/* =======================
   MODAL RENDERERS
======================= */

const renderCustomerModal = () => (
  <>
    <h2>Customer Information</h2>

    <input
      placeholder="Name"
      value={customerName}
      onChange={(e) => setCustomerName(e.target.value)}
    />

    <input
      placeholder="Phone"
      value={customerPhone}
      onChange={(e) => setCustomerPhone(e.target.value)}
    />

   <button className="cash-btn" onClick={() => finalizeOrder("cash")}>💵 Pay Cash</button>
<button className="pay-btn" onClick={() => finalizeOrder("card")}>💳 Pay Card</button>

  </>
);

const goBack = () => {
  if (modalStep === "method") setModalStep("customer");
  else if (modalStep === "delivery" || modalStep === "notes") setModalStep("method");
};


const renderMethodModal = () => (
  <>
    <h2>Order Type</h2>

    <button
      className="method-btn"
      onClick={() => {
        setOrderType("delivery");
        setModalStep("delivery");
      }}
    >
      🚚 Delivery
    </button>

    <button
      className="method-btn"
      onClick={() => {
        setOrderType("pickup");
        setModalStep("notes");
      }}
    >
      🏠 Take from Restaurant
    </button>
  </>
);



const renderDeliveryModal = () => (
  <>
    <h2>Delivery Details</h2>

    <input
      placeholder="Delivery Address"
      value={address}
      onChange={(e) => setAddress(e.target.value)}
    />

    <textarea
      placeholder="Notes (optional)"
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
    />

    <button
      className="confirm-btn"
      onClick={() => setModalStep("customer")}
    >
      Continue
    </button>
  </>
);


const renderNotesModal = () => (
  <>
    <h2>Order Notes</h2>

    <textarea
      placeholder="Notes (optional)"
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
    />

    <button
      className="confirm-btn"
      onClick={() => setModalStep("customer")}
    >
      Continue
    </button>
  </>
);


const resetOrder = () => {
  setOrder([]);
  setCustomerName("");
  setCustomerPhone("");
  setAddress("");
  setNotes("");
  setPaymentMethod(null);
  setOrderType(null);
  setModalStep(null);
};

const finalizeOrder = async (method) => {
  if (!customerName || !customerPhone) {
    alert("Please enter name and phone");
    return;
  }

  const payload = {
    customer_name: customerName,
    customer_number: customerPhone,
    order_items: order,
    total_price: total,
    session_id: sessionId,
    order_type: orderType,
    address: orderType === "delivery" ? address : null,
    notes,
  };

  try {
    // 💵 CASH — DIRECT SAVE
    if (method === "cash") {
      await fetch(`${BACKEND_API}/cash-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      alert("✅ Order placed. Pay cash on delivery.");
      resetOrder();
      return;
    }

    // 💳 CARD — STRIPE ONLY
    const res = await fetch(`${BACKEND_API}/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.checkout_url) throw new Error("No Stripe URL");

    window.location.href = data.checkout_url;

  } catch (err) {
    console.error(err);
    alert("Failed to place order");
  }
};


  /* =======================
     UI
  ======================= */
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
    <span className="navbar-status">Online</span>
  </div>
</header>

      <div className="main-layout">
        <div className="left-pane purple-panel">
          {/* Searched Items Section - Above waveform */}
          {webhookItems.length > 0 && (
            <div className="searched-items-section">
              <div className="searched-items-grid">
                {webhookItems.map((item) => (
                  <div key={item.id} className="searched-item-card">
                    <h3>{item.name}</h3>
                    <p className="item-price">{item.price} SAR</p>
                    <button 
                      className="add-item-btn"
                      onClick={() => addToOrder(item)}
                    >
                      <PlusIcon /> Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voice Recording Section */}
          <div className="voice-center">
            {/* Audio Waveform - Always visible */}
            <AudioWaveform isListening={isListening} />
            
            {/* Microphone Icon */}
            <button
              className={`voice-circle ${isListening ? "listening" : ""}`}
              onClick={handleMicClick}
            >
              {isListening ? <StopIcon /> : <MicIcon />}
            </button>
            
            {/* Audio Playing Indicator */}
            {isPlayingAudio && (
              <div className="audio-indicator">
                <span className="audio-wave"><SpeakerIcon /></span>
                <span>Playing audio...</span>
              </div>
            )}
            
            {/* Refresh Menu Button */}
            <button
              className="webhook-btn refresh-menu-btn"
              onClick={() => callWebhook()}
              disabled={isLoadingWebhook || !sessionId}
            >
              {isLoadingWebhook ? <><LoaderIcon /> Loading...</> : <><RefreshIcon /> Refresh Menu</>}
            </button>
          </div>
        </div>

       <aside className="panel order-panel yellow-panel">
  <h2><ReceiptIcon /> Your Order</h2>

  {order.length === 0 ? (
    <p className="empty-order">Order is empty</p>
  ) : (
    <>
      <div className="order-items">
        {order.map((i, idx) => (
          <div key={idx} className="order-item">
            <span>{i.name} — {i.price} SAR</span>
<button
  className="remove-item-btn"
  onClick={() => removeFromOrder(idx)}
>
  <DeleteIcon />
</button>
          </div>
        ))}
      </div>

      <div className="order-total">
        <strong>Total: {total} SAR</strong>
      </div>

     <button className="confirm" onClick={openModal}>
  Confirm Order
</button>

    </>
  )}
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
