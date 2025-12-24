import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { startVoiceCapture, stopVoiceCapture } from "./voice/useVoiceInput";

// STATIC MENU DATA
const MENU = {
  pizzas: [],
  appetizers: [],
  drinks: [],
  desserts: [],
};

const CATEGORY_LABELS = {
  pizzas: "Pizzas",
  appetizers: "Appetizers (مُقَبَّلات)",
  drinks: "Drinks",
  desserts: "Desserts",
  custom: "Menu",
};

// Webhooks
const N8N_CHAT_WEBHOOK = "https://n8n.srv1004057.hstgr.cloud/webhook/restaurant";

// Backend API (Stripe)
const BACKEND_API = process.env.REACT_APP_BACKEND_API || "http://localhost:4242";

// Session key
const SESSION_KEY = "zacses_session_id";

const generateRandomSessionId = () => {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// Detect Arabic
const isArabicText = (text) => /[\u0600-\u06FF]/.test(text || "");

// Pick lang for STT/TTS
const detectLang = (text) => (isArabicText(text) ? "ar-SA" : "en-US");

function App() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: "Welcome to Zuccess (زَكسِس)! ✨\nAsk me anything… drinks, desserts, pizzas, etc.",
    },
  ]);

  const [input, setInput] = useState("");
  const [currentCategory, setCurrentCategory] = useState(null);
  const [order, setOrder] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isListening, setIsListening] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [modalError, setModalError] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Keep latest messages for fetch payload (avoid stale state)
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = generateRandomSessionId();
      localStorage.setItem(SESSION_KEY, sid);
    }
    setSessionId(sid);
  }, []);

  const speak = (text) => {
    if (!("speechSynthesis" in window) || !text) return;

    const lang = detectLang(text);

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onerror = (err) => console.error("Speech synthesis error:", err);
    window.speechSynthesis.speak(utterance);
  };

  const botReply = (text, speakIt = true) => {
    setMessages((prev) => [...prev, { id: Date.now(), sender: "bot", text }]);
    if (speakIt) speak(text);
  };

  const updateDynamicMenu = (items) => {
    const cat = items[0]?.catigory?.toLowerCase() || "custom";

    MENU[cat] = items.map((i) => ({
      id: i.id,
      name: i.name,
      price: parseInt(i.price, 10),
      image_url: i.image_url || null,
    }));

    setCurrentCategory(cat);

    // Optional: Speak a short menu summary in correct language
    const lang = detectLang(items.map((x) => x.name).join(" "));
    const sample = items.slice(0, 5).map((x) => x.name).join("، ");
    const summary =
      lang === "ar-SA"
        ? `هذه بعض عناصر القائمة: ${sample}${items.length > 5 ? ` وغيرها ${items.length - 5} عناصر` : ""}.`
        : `Here are some items: ${sample}${items.length > 5 ? ` and ${items.length - 5} more` : ""}.`;

    speak(summary);
  };

  const callChatbot = async (userText) => {
    const lang = detectLang(userText);

    // Add user msg once here (IMPORTANT: don’t add it somewhere else too)
    setMessages((prev) => [...prev, { id: Date.now(), sender: "user", text: userText }]);

    try {
      const response = await fetch(N8N_CHAT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_message: userText,
          conversation: messagesRef.current, // latest
          session_id: sessionId,
          // optional hint for n8n prompt routing:
          language: lang,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("Chatbot error:", response.status, t);
        botReply(lang === "ar-SA" ? "❌ حدث خطأ في الخدمة." : "❌ Service error.");
        return;
      }

      const data = await response.json();
      const output = data?.output || data;

      const responseText = output?.response || output?.message || output?.text;
      const menuItems = output?.["menu items"] || output?.menuItems || output?.items;

      if (responseText) botReply(responseText, true);
      else botReply(lang === "ar-SA" ? "لم أفهم، هل يمكنك إعادة المحاولة؟" : "I didn’t understand. Please try again.", true);

      if (menuItems && menuItems.length > 0) updateDynamicMenu(menuItems);
    } catch (err) {
      console.error("Chatbot request failed:", err);
      botReply(lang === "ar-SA" ? "❌ تعذر الاتصال بالخدمة." : "❌ Cannot connect to service.");
    }
  };

  // ---------------------- SEND MESSAGE (TEXT) ----------------------
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput("");
    await callChatbot(userMessage);
  };

  const addToOrder = (item) => {
    setOrder((prev) => [...prev, item]);

    const msg =
      detectLang(item.name) === "ar-SA"
        ? `تمت إضافة ${item.name} (${item.price} ريال) إلى طلبك.`
        : `Added ${item.name} (${item.price} SAR) to your order.`;

    botReply(msg, true);
  };

  const total = useMemo(() => order.reduce((sum, x) => sum + (x.price || 0), 0), [order]);

  const handleConfirmOrder = () => setShowModal(true);

  // ---------------------- PAYMENT ----------------------
  const saveOrder = async () => {
    setModalError("");

    if (!customerName.trim()) return setModalError("❌ Please enter customer name.");
    if (!customerNumber.trim()) return setModalError("❌ Please enter customer number.");
    if (total <= 0) return setModalError("❌ Order total must be greater than 0.");

    setIsProcessingPayment(true);

    try {
      const response = await fetch(`${BACKEND_API}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_number: customerNumber.trim(),
          total_price: total,
          order_items: order,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("Checkout error:", response.status, t);
        setModalError("❌ Failed to initialize payment.");
        setIsProcessingPayment(false);
        return;
      }

      const data = await response.json();
      if (!data.checkout_url) {
        setModalError("❌ Payment initialization failed.");
        setIsProcessingPayment(false);
        return;
      }

      window.location.href = data.checkout_url;
    } catch (err) {
      console.error("Payment error:", err);
      setModalError("❌ Network error. Please try again.");
      setIsProcessingPayment(false);
    }
  };

  // ---------------------- VOICE BUTTON ----------------------
  const handleMicClick = async () => {
    if (isListening) {
      setIsListening(false);
      await stopVoiceCapture();
      return;
    }

    setIsListening(true);

    // We’ll listen in Arabic by default (better for your region),
    // but we still auto-detect per phrase for TTS + chatbot.
    const sttLang = "ar-SA";

    await startVoiceCapture(
      async (finalText) => {
        // IMPORTANT: do NOT add user msg here (callChatbot does it once)
        await callChatbot(finalText);
        setIsListening(false);
        await stopVoiceCapture();
      },
      sessionId,
      sttLang
    );
  };

  // ---------------------- UI ----------------------
  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1 className="brand">Zuccess (زَكسِس) – Order AI</h1>
          <p className="subtitle">AI ordering system with Airtable support.</p>
        </div>
        <div className="status-pill">Online</div>
      </header>

      <div className="main-layout">
        {/* LEFT SIDE */}
        <div className="left-pane">
          {/* MENU */}
          <section className="panel menu-panel">
            <div className="panel-header">
              <h2>🍽️ Menu</h2>
            </div>

            <div className="category-pills">
              {Object.keys(CATEGORY_LABELS).map((key) => (
                <button
                  key={key}
                  onClick={() => setCurrentCategory(key)}
                  className={`pill ${currentCategory === key ? "pill-active" : ""}`}
                >
                  {CATEGORY_LABELS[key]}
                </button>
              ))}
            </div>

            {currentCategory && MENU[currentCategory]?.length > 0 ? (
              <div className="menu-grid">
                {MENU[currentCategory].map((item) => (
                  <div key={item.id} className="menu-card">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="menu-img" />
                    )}

                    <div className="menu-card-main">
                      <h3>{item.name}</h3>
                      <p className="price">{item.price} SAR</p>
                    </div>

                    <button className="add-btn" onClick={() => addToOrder(item)}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="menu-placeholder">
                <p>Ask the bot: "Show me pizzas" أو "ورّيني البيتزا"</p>
              </div>
            )}
          </section>

          {/* CHAT */}
          <section className="panel chat-panel">
            <h2>💬 Conversation</h2>

            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={`message-row ${m.sender}`}>
                  <div className="avatar">{m.sender === "bot" ? "🤖" : "🧑"}</div>
                  <div className="bubble">{m.text}</div>
                </div>
              ))}
            </div>

            <form className="input-row" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Speak or type... / تكلم أو اكتب..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />

              <button type="submit">Send</button>

              <button
                type="button"
                className={`mic-btn ${isListening ? "listening" : ""}`}
                onClick={handleMicClick}
              >
                {isListening ? "⏹️" : "🎤"}
              </button>
            </form>
          </section>
        </div>

        {/* ORDER SUMMARY */}
        <aside className="panel order-panel">
          <h2>🧾 Your Order</h2>

          {order.length === 0 ? (
            <p>No items yet.</p>
          ) : (
            <>
              <ul className="order-list">
                {order.map((item, idx) => (
                  <li key={idx}>
                    {item.name} — {item.price} SAR
                  </li>
                ))}
              </ul>

              <div className="order-footer">
                <p>Total: {total} SAR</p>
                <button className="checkout-btn" onClick={handleConfirmOrder}>
                  Confirm Order
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Enter Customer Details</h2>

            <input
              type="text"
              placeholder="Customer Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Customer Number start with +"
              value={customerNumber}
              onChange={(e) => setCustomerNumber(e.target.value)}
            />

            {modalError && <p className="modal-error">{modalError}</p>}

            <div style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
              Total to pay: <strong>{total} SAR</strong>
            </div>

            <button className="save-btn" onClick={saveOrder} disabled={isProcessingPayment}>
              {isProcessingPayment ? "Processing Payment..." : "Pay & Confirm Order"}
            </button>

            <button
              className="cancel-btn"
              onClick={() => setShowModal(false)}
              disabled={isProcessingPayment}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
