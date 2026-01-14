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
console.log("STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ======== CONFIG ========
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const WHATSAPP_FROM = "whatsapp:+1 864 351 6969";

const N8N_SAVE_ORDER = "https://n8n.srv1004057.hstgr.cloud/webhook/trio_orders";
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
function formatOrdersText(orderItems) {
  const counts = {};

  for (const item of orderItems) {
    const name = String(item?.name || "").trim();
    if (!name) continue;
    counts[name] = (counts[name] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([name, qty]) => (qty > 1 ? `${name} x${qty}` : name))
    .join(", ");
}




async function saveOrderToDB({
  customerName,
  customerNumber,
  orderItems,
  orderType,
  paymentMethod,
  notes,
  address,
  totalPrice, // ✅ NEW
}) {
  console.log("💾 Saving order to DB");

  const payload = {
    Name: customerName,
    phone_number: customerNumber,
    Status: orderType === "delivery" ? "delivery" : "on site",
    payment_method: paymentMethod,
    total_price: totalPrice,                 // ✅ NEW
    Notes: notes || "",
    address: orderType === "delivery" ? address || "" : "",
    orders: formatOrdersText(orderItems),    // ✅ TEXT ONLY
    created_at: new Date().toISOString(),
  };

  const r = await fetch(N8N_SAVE_ORDER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`save-order failed: ${r.status} ${t}`);
  }

  return true;
}


async function notifyKitchen({ customerName, customerNumber, totalPrice, orderItems, sessionId, orderText }) {
  console.log("📤 Sending to kitchen webhook:", N8N_KITCHEN_WEBHOOK);
  
  const payload = {
    customer_name: customerName,
    customer_number: customerNumber,
    total_price: totalPrice,
    order_items: orderItems,
    order_text: orderText,
    session_id: sessionId,
  };
  
  console.log("📤 Kitchen payload:", JSON.stringify(payload, null, 2));
  
  const r = await fetch(N8N_KITCHEN_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const t = await r.text();
  console.log(`📤 Kitchen response: ${r.status} ${r.statusText}`, t);
  
  if (!r.ok) {
    throw new Error(`kitchen_order failed: ${r.status} ${r.statusText} - ${t}`);
  }
  return true;
}

// Normalize phone number to E.164 format for WhatsApp
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  let normalized = String(phoneNumber).trim();
  
  // Remove spaces, dashes, parentheses
  normalized = normalized.replace(/[\s\-()]/g, "");
  
  // If it already starts with whatsapp:, remove it first
  if (normalized.startsWith("whatsapp:")) {
    normalized = normalized.substring(9);
  }
  
  // Ensure it starts with + for E.164 format
  if (!normalized.startsWith("+")) {
    // If it starts with 0, assume Saudi Arabia (replace 0 with +966)
    if (normalized.startsWith("0")) {
      normalized = "+966" + normalized.substring(1);
    } else if (normalized.startsWith("966")) {
      // Already has country code but missing +
      normalized = "+" + normalized;
    } else {
      // Assume Saudi Arabia and add +966
      normalized = "+966" + normalized;
    }
  }
  
  // Validate E.164 format (starts with +, followed by 1-15 digits)
  if (!/^\+[1-9]\d{1,14}$/.test(normalized)) {
    console.warn("⚠️ Phone number may not be in valid E.164 format:", normalized);
  }
  
  return normalized;
}

async function sendInvoiceToCustomer({ customerName, customerNumber, orderItems, totalPrice }) {
  console.log("📧 Sending invoice to customer:", customerNumber);
  
  // Normalize phone number to E.164 format
  let normalizedPhone = normalizePhoneNumber(customerNumber);
  
  if (!normalizedPhone) {
    throw new Error("Invalid phone number: phone number is empty or null");
  }
  
  const toNumber = `whatsapp:${normalizedPhone}`;
  console.log("📧 Normalized phone number:", toNumber);

  const orderItemsString = formatOrderItemsString(orderItems);
  if (!orderItemsString) {
    console.error("❌ Invoice items string is empty for orderItems:", orderItems);
    throw new Error("Invoice items string is empty");
  }

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

  console.log("📧 Invoice payload:", JSON.stringify(payload, null, 2));
  console.log("📧 Invoice webhook URL:", INVOICE_WEBHOOK_URL);

  try {
    const r = await fetch(INVOICE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    const t = await r.text();
    console.log(`📧 Invoice response status: ${r.status} ${r.statusText}`);
    console.log(`📧 Invoice response body:`, t);
    
    if (!r.ok) {
      const errorMsg = `send-invoice failed: ${r.status} ${r.statusText} - ${t}`;
      console.error("❌ Invoice webhook error:", errorMsg);
      throw new Error(errorMsg);
    }
    
    console.log("✅ Invoice sent successfully to:", toNumber);
    return true;
  } catch (err) {
    console.error("❌ Invoice sending exception:", err.message);
    console.error("❌ Full error:", err);
    throw err;
  }
}

// ======== CREATE CHECKOUT SESSION ========
app.post("/create-checkout-session", async (req, res) => {
  try {
    const {  customer_name,
  customer_number,
  order_items,
  total_price,
  session_id,
  order_type, } = req.body;

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
  order_type,          // ✅ IMPORTANT
  payment_method: "card",
  order: orderMetadata,
  processed: "false",
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

// ======== PROCESS ORDER (shared logic) ========
async function processOrder(session) {
  // Parse metadata
  if (!session.metadata?.order) throw new Error("Missing order metadata");
  if (!session.metadata?.customer_name || !session.metadata?.customer_number) throw new Error("Missing customer metadata");

  let orderItems = JSON.parse(session.metadata.order);
  if (!Array.isArray(orderItems) || orderItems.length === 0) throw new Error("Empty order items");

  orderItems = orderItems.map((x) => ({
    id: x.id || "unknown",
    name: x.name || "Unknown Item",
    price: Number(x.price || 0),
  }));

  const customerName = session.metadata.customer_name;
  const customerNumber = session.metadata.customer_number;
  const restaurantSessionId = session.metadata.session_id || "no-session";
  const totalPrice = (session.amount_total || 0) / 100;

 
  const results = {
    saved: false,
    kitchenNotified: false,
    invoiceSent: false,
    errors: []
  };

  // Process all steps with individual error handling
  try {
    await saveOrderToDB({
  customerName,
  customerNumber,
  orderItems,
  orderType: session.metadata.order_type,
  paymentMethod: "card",
  notes: "",
  address: "",
  totalPrice, // ✅ ADD
});


    console.log("✅ Order saved to DB");
    results.saved = true;
  } catch (err) {
    console.error("❌ Failed to save order to DB:", err.message);
    results.errors.push(`DB save failed: ${err.message}`);
    // Continue processing even if DB save fails
  }

 

  try {
    await sendInvoiceToCustomer({ customerName, customerNumber, orderItems, totalPrice });
    console.log("✅ Invoice sent to customer");
    results.invoiceSent = true;
  } catch (err) {
    console.error("❌ Failed to send invoice:", err.message);
    console.error("❌ Invoice error details:", err);
    results.errors.push(`Invoice send failed: ${err.message}`);
    // Continue processing even if invoice send fails
  }

  // Log final results
  console.log("📊 Processing results:", results);

  // If all steps failed, throw an error
  if (!results.saved && !results.kitchenNotified && !results.invoiceSent) {
    throw new Error(`All processing steps failed: ${results.errors.join(", ")}`);
  }

  // If some steps failed, log warning but don't throw
  if (results.errors.length > 0) {
    console.warn("⚠️ Some steps failed but continuing:", results.errors);
  }

  return { success: true, results };
}

// ======== VERIFY PAYMENT (with fallback processing) ========
app.post("/verify-payment", async (req, res) => {
  console.log("🔍 Verify payment called with session_id:", req.body?.session_id);
  
  try {
    const { session_id } = req.body;
    if (!session_id) {
      console.error("❌ Missing session_id in request");
      return res.status(400).json({ error: "Missing session_id" });
    }

    console.log("🔍 Retrieving Stripe session:", session_id);
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log("🔍 Session status:", {
      payment_status: session.payment_status,
      processed: session.metadata?.processed,
      has_metadata: !!session.metadata
    });

    if (session.payment_status !== "paid") {
      console.warn("⚠️ Payment not completed, status:", session.payment_status);
      return res.status(400).json({ error: "Payment not completed", status: session.payment_status });
    }

    const processed = session.metadata?.processed;
    console.log("🔍 Current processed status:", processed);

    // ✅ ALWAYS PROCESS: If not successfully processed yet, process it here
    // This ensures invoice and kitchen notification ALWAYS happen after payment
    // We check only for "true" - if it's "processing" or "error", we'll retry
    if (processed !== "true") {
      console.log("⚠️ Order not processed yet (status: " + processed + "), processing now via verify-payment");
      
      try {
        // Mark as processing to prevent duplicate processing
        await stripe.checkout.sessions.update(session_id, {
          metadata: { ...session.metadata, processed: "processing" },
        }).catch(err => console.warn("Warning: Could not update metadata:", err.message));

        // Process the order (save DB, notify kitchen, send invoice)
        console.log("🚀 Starting order processing...");
        const processResult = await processOrder(session);

        // Mark as processed
        await stripe.checkout.sessions.update(session_id, {
          metadata: { ...session.metadata, processed: "true" },
        }).catch(err => console.warn("Warning: Could not update metadata to processed:", err.message));

        console.log("✅ Order processed successfully via verify-payment:", session_id);
        console.log("✅ Process result:", processResult);
        
        return res.json({
          success: true,
          paid: true,
          processed: "true",
          message: "Payment verified and order processed successfully",
          processed_via: "verify-payment",
          results: processResult.results,
        });
      } catch (processErr) {
        console.error("❌ Processing error:", processErr);
        console.error("❌ Full error stack:", processErr.stack);
        
        // Mark error with detailed message but don't fail the response
        try {
          await stripe.checkout.sessions.update(session_id, {
            metadata: { 
              ...session.metadata, 
              processed: "error",
              error_message: String(processErr.message || "Unknown error").substring(0, 100)
            },
          });
        } catch (updateErr) {
          console.error("❌ Failed to update session metadata:", updateErr);
        }
        
        // Still return success but with error details
        return res.status(500).json({
          success: false,
          paid: true,
          error: "Payment verified but order processing failed",
          details: processErr.message,
          processed: "error",
        });
      }
    }

    // Already successfully processed
    console.log("✅ Order already processed successfully");
    return res.json({
      success: true,
      paid: true,
      processed: "true",
      message: "Payment verified and order already processed",
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ error: "Verification failed", details: err.message });
  }
});

// ======== STRIPE WEBHOOK (THE ONLY PROCESSOR) ========
app.post("/stripe-webhook", async (req, res) => {
  console.log("🔥 STRIPE WEBHOOK HIT");

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

    // Skip if already processing (avoid race condition with verify-payment fallback)
    if (full.metadata?.processed === "processing") {
      console.log("⚠️ Webhook: order is being processed elsewhere, skipping", full.id);
      return res.json({ received: true, skipped: true, reason: "already_processing" });
    }

    // Mark processing ASAP
    await stripe.checkout.sessions.update(full.id, {
      metadata: { ...full.metadata, processed: "processing" },
    });

    console.log("🔥 Webhook: Starting order processing for session:", full.id);

    // ✅ DO WORK ONCE HERE using shared function
    await processOrder(full);

    // Mark processed
    await stripe.checkout.sessions.update(full.id, {
      metadata: { ...full.metadata, processed: "true" },
    });

    console.log("✅ Webhook processed order successfully:", full.id);
    return res.json({ received: true, processed: true });
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    console.error("❌ Error details:", {
      message: err.message,
      stack: err.stack,
      sessionId: session.id,
    });

    // Mark error so you can reprocess manually later if needed
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id);
      await stripe.checkout.sessions.update(full.id, {
        metadata: { ...full.metadata, processed: "error", error_message: err.message },
      });
    } catch (e) {
      console.error("Failed to mark webhook error:", e);
    }

    // Always ACK Stripe (return 200 to prevent retries if it's a permanent error)
    return res.json({ received: true, processed: false, error: true, error_message: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, name: "Zuccess Backend", port: process.env.PORT || 4242 });
});
app.post("/cash-order", async (req, res) => {
  try {
    const {
      customer_name,
      customer_number,
      order_items,
      order_type,
      notes,
      address,
    } = req.body;

    if (!customer_name || !customer_number || !order_items?.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    await saveOrderToDB({
  customerName: customer_name,
  customerNumber: customer_number,
  orderItems: order_items,
  orderType: order_type,
  paymentMethod: "cash",
  notes,
  address,
  totalPrice: req.body.total_price, // ✅ ADD
});


   
    await sendInvoiceToCustomer({
      customerName: customer_name,
      customerNumber: customer_number,
      orderItems: order_items,
      totalPrice: req.body.total_price,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Cash order failed:", err);
    return res.status(500).json({ error: "Cash order failed" });
  }
});


const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));