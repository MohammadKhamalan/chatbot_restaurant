import "dotenv/config";
import express from "express";
import Stripe from "stripe";
import cors from "cors";

const app = express();
app.use(cors());

// RAW body REQUIRED for Stripe webhook
app.use("/stripe-webhook", express.raw({ type: "application/json" }));

// JSON for all other routes
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ======== CONFIG ========
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const WHATSAPP_FROM = "whatsapp:+1 864 351 6969";

const N8N_SAVE_ORDER = "https://n8n.srv1004057.hstgr.cloud/webhook/save-order";
const N8N_KITCHEN_WEBHOOK = "https://n8n.srv1004057.hstgr.cloud/webhook/kitchen_order";
const INVOICE_WEBHOOK_URL = "https://zuccess.app.n8n.cloud/webhook/send-invoice";
const INVOICE_URL = "https://res.cloudinary.com/dfp9gwmpp/raw/upload/v1765975728/result_z3xpko.pdf";

// ======== HELPERS ========
function formatOrderItemsString(orderItems) {
  const itemCounts = {};
  for (const item of orderItems) {
    const name = String(item?.name || "Unknown Item").trim();
    if (!name) continue;
    itemCounts[name] = (itemCounts[name] || 0) + 1;
  }

  return Object.entries(itemCounts)
    .map(([name, count]) => (count > 1 ? `${name} x${count}` : name))
    .join(", ");
}

function formatKitchenText({ customerName, customerNumber, sessionId, orderItems, totalPrice }) {
  const itemsText = orderItems.map((i) => `- ${i.name} — ${i.price} SAR`).join("\n");
  return `
New Order Received 🍽️

👤 Customer: ${customerName}
📞 Phone: ${customerNumber}
🧾 Session ID: ${sessionId}

🛒 Items:
${itemsText}

💰 Total: ${totalPrice} SAR

Sent from Zuccess Restaurant AI Assistant 🤖
  `.trim();
}

async function saveOrderToDB({ customerName, customerNumber, totalPrice, orderItems, sessionId }) {
  const r = await fetch(N8N_SAVE_ORDER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_name: customerName,
      customer_number: customerNumber,
      total_price: totalPrice,
      order_items: orderItems,
      session_id: sessionId,
    }),
  });

  const t = await r.text();
  if (!r.ok) throw new Error(`save-order failed: ${r.status} ${t}`);
  return true;
}

async function notifyKitchen({ customerName, customerNumber, totalPrice, orderItems, sessionId, orderText }) {
  const r = await fetch(N8N_KITCHEN_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_name: customerName,
      customer_number: customerNumber,
      total_price: totalPrice,
      order_items: orderItems,
      order_text: orderText,
      session_id: sessionId,
    }),
  });

  const t = await r.text();
  if (!r.ok) throw new Error(`kitchen_order failed: ${r.status} ${t}`);
  return true;
}

async function sendInvoiceToCustomer({ customerName, customerNumber, orderItems, totalPrice }) {
  let toNumber = String(customerNumber || "").trim();
  if (!toNumber.startsWith("whatsapp:")) toNumber = `whatsapp:${toNumber}`;

  const orderItemsString = formatOrderItemsString(orderItems);
  if (!orderItemsString) throw new Error("Invoice items string is empty");

  const payload = {
    To: toNumber,
    From: WHATSAPP_FROM,
    ContentVariables: {
      "1": String(customerName || "").trim(),
      "2": orderItemsString.trim(),
      "3": String(totalPrice || "0").trim(),
      "4": INVOICE_URL.trim(),
    },
  };

  const r = await fetch(INVOICE_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const t = await r.text();
  if (!r.ok) throw new Error(`send-invoice failed: ${r.status} ${t}`);
  return true;
}

// ======== CREATE CHECKOUT SESSION ========
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { customer_name, customer_number, order_items, total_price, session_id } = req.body;

    if (!customer_name || !customer_number || !Array.isArray(order_items) || order_items.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (typeof total_price !== "number" || total_price <= 0) {
      return res.status(400).json({ error: "total_price must be a positive number" });
    }

    // Store minimal order in metadata (Stripe limit)
    const orderItemsForMetadata = order_items.map(({ id, name, price }) => ({ id, name, price }));
    let orderMetadata = JSON.stringify(orderItemsForMetadata);

    if (orderMetadata.length > 450) {
      // fallback to minimal
      const minimal = order_items.map(({ id, name }) => ({ id, name }));
      orderMetadata = JSON.stringify(minimal);
      if (orderMetadata.length > 450) {
        return res.status(400).json({ error: "Order too large for Stripe metadata" });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sar",
            product_data: { name: "Zuccess Restaurant Order" },
            unit_amount: Math.round(total_price * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        customer_name,
        customer_number,
        session_id,
        order: orderMetadata,
        processed: "false", // ✅ idempotency flag
      },
      success_url: `${FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/payment-cancel`,
    });

    res.json({ checkout_url: session.url });
  } catch (err) {
    console.error("Create checkout error:", err);
    res.status(500).json({ error: "Stripe error", details: err.message });
  }
});

// ======== VERIFY PAYMENT (READ-ONLY) ========
app.post("/verify-payment", async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed", status: session.payment_status });
    }

    // IMPORTANT: no saving, no kitchen, no invoice here
    return res.json({
      success: true,
      paid: true,
      processed: session.metadata?.processed || "unknown",
      message: "Payment verified",
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ error: "Verification failed", details: err.message });
  }
});

// ======== STRIPE WEBHOOK (THE ONLY PROCESSOR) ========
app.post("/stripe-webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send("Webhook Error");
  }

  if (event.type !== "checkout.session.completed") {
    return res.json({ received: true });
  }

  const session = event.data.object;

  try {
    // Re-fetch session to read latest metadata
    const full = await stripe.checkout.sessions.retrieve(session.id);

    // ✅ hard idempotency
    if (full.metadata?.processed === "true") {
      console.log("✅ Webhook: already processed, skipping", full.id);
      return res.json({ received: true, skipped: true });
    }

    // Mark processing ASAP
    await stripe.checkout.sessions.update(full.id, {
      metadata: { ...full.metadata, processed: "processing" },
    });

    // Parse metadata
    if (!full.metadata?.order) throw new Error("Missing order metadata");
    if (!full.metadata?.customer_name || !full.metadata?.customer_number) throw new Error("Missing customer metadata");

    let orderItems = JSON.parse(full.metadata.order);
    if (!Array.isArray(orderItems) || orderItems.length === 0) throw new Error("Empty order items");

    orderItems = orderItems.map((x) => ({
      id: x.id || "unknown",
      name: x.name || "Unknown Item",
      price: Number(x.price || 0),
    }));

    const customerName = full.metadata.customer_name;
    const customerNumber = full.metadata.customer_number;
    const restaurantSessionId = full.metadata.session_id || "no-session";
    const totalPrice = (full.amount_total || 0) / 100;

    const orderText = formatKitchenText({
      customerName,
      customerNumber,
      sessionId: restaurantSessionId,
      orderItems,
      totalPrice,
    });

    // ✅ DO WORK ONCE HERE
    await saveOrderToDB({ customerName, customerNumber, totalPrice, orderItems, sessionId: restaurantSessionId });
    await notifyKitchen({ customerName, customerNumber, totalPrice, orderItems, sessionId: restaurantSessionId, orderText });
    await sendInvoiceToCustomer({ customerName, customerNumber, orderItems, totalPrice });

    // Mark processed
    await stripe.checkout.sessions.update(full.id, {
      metadata: { ...full.metadata, processed: "true" },
    });

    console.log("✅ Webhook processed order once:", full.id);
    return res.json({ received: true, processed: true });
  } catch (err) {
    console.error("❌ Webhook processing error:", err);

    // Mark error so you can reprocess manually later if needed
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id);
      await stripe.checkout.sessions.update(full.id, {
        metadata: { ...full.metadata, processed: "error" },
      });
    } catch (e) {
      console.error("Failed to mark webhook error:", e);
    }

    // Always ACK Stripe
    return res.json({ received: true, processed: false, error: true });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, name: "Zuccess Backend", port: process.env.PORT || 4242 });
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
