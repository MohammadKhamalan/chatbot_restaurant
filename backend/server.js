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

const N8N_SAVE_ORDER = "https://n8n.srv1004057.hstgr.cloud/webhook/trio_orders";

// ======== HELPERS ========
// formatOrderItemsString removed - not needed anymore
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


// Kitchen notification removed - only save to DB
// Invoice sending removed - only save to DB

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
  const totalPrice = (session.amount_total || 0) / 100;

  const results = {
    saved: false,
    errors: []
  };

  // Save to DB
  try {
    await saveOrderToDB({
      customerName,
      customerNumber,
      orderItems,
      orderType: session.metadata.order_type,
      paymentMethod: "card",
      notes: "",
      address: "",
      totalPrice,
    });
    console.log("✅ Order saved to DB");
    results.saved = true;
  } catch (err) {
    console.error("❌ Failed to save order to DB:", err.message);
    results.errors.push(`DB save failed: ${err.message}`);
    throw err; // Throw error if DB save fails
  }

  // Log final results
  console.log("📊 Processing results:", results);

  return { success: true, results };
}

// // ======== VERIFY PAYMENT (with fallback processing) ========
// app.post("/verify-payment", async (req, res) => {
//   console.log("🔍 Verify payment called with session_id:", req.body?.session_id);
  
//   try {
//     const { session_id } = req.body;
//     if (!session_id) {
//       console.error("❌ Missing session_id in request");
//       return res.status(400).json({ error: "Missing session_id" });
//     }

//     console.log("🔍 Retrieving Stripe session:", session_id);
//     const session = await stripe.checkout.sessions.retrieve(session_id);

//     console.log("🔍 Session status:", {
//       payment_status: session.payment_status,
//       processed: session.metadata?.processed,
//       has_metadata: !!session.metadata
//     });

//     if (session.payment_status !== "paid") {
//       console.warn("⚠️ Payment not completed, status:", session.payment_status);
//       return res.status(400).json({ error: "Payment not completed", status: session.payment_status });
//     }

//     const processed = session.metadata?.processed;
//     console.log("🔍 Current processed status:", processed);

//     // ✅ ALWAYS PROCESS: If not successfully processed yet, process it here
//     // This ensures DB save ALWAYS happens after payment
//     // We check only for "true" - if it's "processing" or "error", we'll retry
//     if (processed !== "true") {
//       console.log("⚠️ Order not processed yet (status: " + processed + "), processing now via verify-payment");
      
//       try {
//         // Mark as processing to prevent duplicate processing
//         await stripe.checkout.sessions.update(session_id, {
//           metadata: { ...session.metadata, processed: "processing" },
//         }).catch(err => console.warn("Warning: Could not update metadata:", err.message));

//         // Process the order (save to DB)
//         console.log("🚀 Starting order processing...");
//         const processResult = await processOrder(session);

//         // Mark as processed
//         await stripe.checkout.sessions.update(session_id, {
//           metadata: { ...session.metadata, processed: "true" },
//         }).catch(err => console.warn("Warning: Could not update metadata to processed:", err.message));

//         console.log("✅ Order processed successfully via verify-payment:", session_id);
//         console.log("✅ Process result:", processResult);
        
//         return res.json({
//           success: true,
//           paid: true,
//           processed: "true",
//           message: "Payment verified and order processed successfully",
//           processed_via: "verify-payment",
//           results: processResult.results,
//         });
//       } catch (processErr) {
//         console.error("❌ Processing error:", processErr);
//         console.error("❌ Full error stack:", processErr.stack);
        
//         // Mark error with detailed message but don't fail the response
//         try {
//           await stripe.checkout.sessions.update(session_id, {
//             metadata: { 
//               ...session.metadata, 
//               processed: "error",
//               error_message: String(processErr.message || "Unknown error").substring(0, 100)
//             },
//           });
//         } catch (updateErr) {
//           console.error("❌ Failed to update session metadata:", updateErr);
//         }
        
//         // Still return success but with error details
//         return res.status(500).json({
//           success: false,
//           paid: true,
//           error: "Payment verified but order processing failed",
//           details: processErr.message,
//           processed: "error",
//         });
//       }
//     }

//     // Already successfully processed
//     console.log("✅ Order already processed successfully");
//     return res.json({
//       success: true,
//       paid: true,
//       processed: "true",
//       message: "Payment verified and order already processed",
//     });
//   } catch (err) {
//     console.error("Verify payment error:", err);
//     res.status(500).json({ error: "Verification failed", details: err.message });
//   }
// });

// ======== STRIPE WEBHOOK (THE ONLY PROCESSOR) ========
app.post("/stripe-webhook", async (req, res) => {
  console.log("🔥 STRIPE WEBHOOK HIT");

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send("Webhook Error");
  }

  // نسمع فقط لحدث الدفع المكتمل
  if (event.type !== "checkout.session.completed") {
    return res.json({ received: true });
  }

  const session = event.data.object;

  try {
    // 🔒 تأكيد الدفع
    if (session.payment_status !== "paid") {
      console.log("⚠️ Payment not paid yet");
      return res.json({ received: true });
    }

    console.log("💰 Payment successful for session:", session.id);

    // 🔑 تأكد أن metadata موجودة
    if (!session.metadata?.order) {
      throw new Error("Missing order metadata");
    }

    const orderItems = JSON.parse(session.metadata.order);

    const totalPrice = (session.amount_total || 0) / 100;

    // 💾 الحفظ الإجباري
    await saveOrderToDB({
      customerName: session.metadata.customer_name,
      customerNumber: session.metadata.customer_number,
      orderItems,
      orderType: session.metadata.order_type,
      paymentMethod: "card",
      notes: "",
      address: "",
      totalPrice,
    });

    console.log("✅ ORDER SAVED TO DB SUCCESSFULLY");

    return res.json({ received: true, saved: true });
  } catch (err) {
    console.error("❌ Failed to save order:", err);
    return res.status(500).json({ received: true, error: err.message });
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
      total_price,
      session_id,
    } = req.body;

    if (!customer_name || !customer_number || !order_items?.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Save to DB
    await saveOrderToDB({
      customerName: customer_name,
      customerNumber: customer_number,
      orderItems: order_items,
      orderType: order_type,
      paymentMethod: "cash",
      notes: notes || "",
      address: address || "",
      totalPrice: total_price || 0,
    });
    console.log("✅ Cash order saved to DB");

    // Kitchen notification removed - only save to DB

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Cash order failed:", err);
    return res.status(500).json({ error: "Cash order failed", details: err.message });
  }
});


const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));