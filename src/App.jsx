
import React, { useState, useEffect } from "react";
import "./App.css";

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
const N8N_SAVE_ORDER = "https://n8n.srv1004057.hstgr.cloud/webhook/save-order";
const N8N_KITCHEN_WEBHOOK = "https://n8n.srv1004057.hstgr.cloud/webhook/kitchen_order";

// Backend API (Stripe)
const BACKEND_API = process.env.REACT_APP_BACKEND_API || "http://localhost:4242";


// Session key
const SESSION_KEY = "zacses_session_id";

const generateRandomSessionId = () => {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

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

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [modalError, setModalError] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = generateRandomSessionId();
      localStorage.setItem(SESSION_KEY, sid);
    }
    setSessionId(sid);
  }, []);

  const botReply = (text) => {
    setMessages((prev) => [...prev, { id: Date.now(), sender: "bot", text }]);
  };

  // ---------------------- SEND MESSAGE TO AI ----------------------
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setMessages((prev) => [...prev, { id: Date.now(), sender: "user", text: userMessage }]);
    setInput("");

    try {
      const response = await fetch(N8N_CHAT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_message: userMessage,
          conversation: messages,
          session_id: sessionId,
        }),
      });

      const data = await response.json();
      const output = data?.output;
      if (!output) return botReply("⚠️ Unexpected AI response.");

      if (output.response) botReply(output.response);

      if (output["menu items"]?.length > 0) updateDynamicMenu(output["menu items"]);

    } catch (err) {
      console.error(err);
      botReply("❌ AI service unavailable.");
    }
  };

  const updateDynamicMenu = (items) => {
    let cat = items[0]?.catigory?.toLowerCase() || "custom";

    MENU[cat] = items.map((i) => ({
      id: i.id,
      name: i.name,
      price: parseInt(i.price),
      image_url: i.image_url || null,
    }));

    setCurrentCategory(cat);
  };

  const addToOrder = (item) => {
    setOrder((prev) => [...prev, item]);
    botReply(`Added ${item.name} (${item.price} SAR) to your order.`);
  };

  const total = order.reduce((sum, x) => sum + x.price, 0);

  // ---------------------- OPEN MODAL ----------------------
  const handleConfirmOrder = () => {
    setShowModal(true);
  };

  // ---------------------- FORMAT WHATSAPP MESSAGE ----------------------
  const formatOrderMessage = () => {
    const itemsText = order.map((i) => `- ${i.name} — ${i.price} SAR`).join("\n");

    return `
New Order Received 🍽️

👤 Customer: ${customerName}
📞 Phone: ${customerNumber}
🧾 Session ID: ${sessionId}

🛒 Items:
${itemsText}

💰 Total: ${total} SAR

Sent from Zuccess Restaurant AI Assistant 🤖
    `;
  };

  // ---------------------- NOTIFY KITCHEN ----------------------
  const notifyKitchen = async () => {
    try {
      const order_text = formatOrderMessage();

      await fetch(N8N_KITCHEN_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName,
          customer_number: customerNumber,
          total_price: total,
          order_items: order,
          order_text,
          session_id: sessionId,
        }),
      });
    } catch (err) {
      console.error("WhatsApp send failed:", err);
    }
  };

  // ---------------------- PROCESS PAYMENT & SAVE ORDER ----------------------
  const saveOrder = async () => {
    setModalSuccess("");
    setModalError("");

    // Validate customer details
    if (!customerName.trim()) {
      setModalError("❌ Please enter customer name.");
      return;
    }

    if (!customerNumber.trim()) {
      setModalError("❌ Please enter customer number.");
      return;
    }

    if (total <= 0) {
      setModalError("❌ Order total must be greater than 0.");
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Step 1: Create Stripe Checkout Session
      const response = await fetch(`${BACKEND_API}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName,
          customer_number: customerNumber,
          total_price: total,
          order_items: order,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setModalError("❌ Failed to initialize payment. Please try again.");
        setIsProcessingPayment(false);
        return;
      }

      const data = await response.json();
      const checkoutUrl = data.checkout_url;

      if (!checkoutUrl) {
        setModalError("❌ Payment initialization failed. Please try again.");
        setIsProcessingPayment(false);
        return;
      }

      // Step 2: Redirect to Stripe Checkout
      // The webhook will handle saving order and notifying kitchen after successful payment
      window.location.href = checkoutUrl;

    } catch (err) {
      console.error("Payment error:", err);
      setModalError("❌ Network error. Please check your connection and try again.");
      setIsProcessingPayment(false);
    }
  };

  // ---------------------- UI ----------------------
  return (
    <div className="app-shell">
      {/* HEADER */}
      <header className="top-bar">
        <div>
          <h1 className="brand">Zuccess (زَكسِس) – Order AI</h1>
          <p className="subtitle">AI ordering system with Airtable support.</p>
        </div>
        <div className="status-pill">Online</div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="main-layout">

        {/* LEFT SIDE */}
        <div className="left-pane">

          {/* MENU */}
          <section className="panel menu-panel">
            <div className="panel-header"><h2>🍽️ Menu</h2></div>

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
              <div className="menu-placeholder"><p>Ask the bot: "Show me pizzas"</p></div>
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
                placeholder="اكتب طلبك هنا..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="submit">Send</button>
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
                  <li key={idx}>{item.name} — {item.price} SAR</li>
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

            {modalSuccess && <p className="modal-success">{modalSuccess}</p>}
            {modalError && <p className="modal-error">{modalError}</p>}

            <div style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
              Total to pay: <strong>{total} SAR</strong>
            </div>

            <button 
              className="save-btn" 
              onClick={saveOrder}
              disabled={isProcessingPayment}
              style={{ opacity: isProcessingPayment ? 0.6 : 1, cursor: isProcessingPayment ? "not-allowed" : "pointer" }}
            >
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