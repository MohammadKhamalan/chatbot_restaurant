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

// Static invoice URL
const INVOICE_URL = "https://res.cloudinary.com/dfp9gwmpp/raw/upload/v1765975728/result_z3xpko.pdf";
const INVOICE_WEBHOOK_URL = "https://zuccess.app.n8n.cloud/webhook/send-invoice";
const WHATSAPP_FROM = "whatsapp:+1 864 351 6969";

// Helper function to format order items as a string (e.g., "Pizza Margherita x3, Drink x2")
function formatOrderItemsString(orderItems) {
  // Count items by name
  const itemCounts = {};
  orderItems.forEach(item => {
    const name = item.name || "Unknown Item";
    itemCounts[name] = (itemCounts[name] || 0) + 1;
  });

  // Format as "Item Name x2, Another Item x3"
  return Object.entries(itemCounts)
    .map(([name, count]) => count > 1 ? `${name} x${count}` : name)
    .join(", ");
}

// Helper function to send invoice to customer via WhatsApp
async function sendInvoiceToCustomer(customerName, customerNumber, orderItems, totalPrice, context = "") {
  try {
    console.log(`📧 [${context}] Sending invoice to customer...`);
    
    // Format customer number - ensure it starts with whatsapp:
    let toNumber = customerNumber.trim();
    if (!toNumber.startsWith("whatsapp:")) {
      toNumber = `whatsapp:${toNumber}`;
    }

    // Format order items string
    const orderItemsString = formatOrderItemsString(orderItems);

    // Prepare the request body
    const invoiceData = {
      To: toNumber,
      From: WHATSAPP_FROM,
      ContentVariables: {
        "1": customerName,
        "2": orderItemsString,
        "3": totalPrice.toString(),
        "4": INVOICE_URL
      }
    };

    console.log(`📧 [${context}] Invoice data:`, JSON.stringify(invoiceData, null, 2));

    const invoiceResponse = await fetch(INVOICE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoiceData),
    });

    const invoiceResponseText = await invoiceResponse.text();
    console.log(`📧 [${context}] Invoice response status: ${invoiceResponse.status}`);
    console.log(`📧 [${context}] Invoice response body: ${invoiceResponseText}`);

    if (!invoiceResponse.ok) {
      console.error(`❌ [${context}] Failed to send invoice:`, invoiceResponse.status, invoiceResponseText);
      return false;
    }

    console.log(`✅ [${context}] Invoice sent successfully!`);
    return true;
  } catch (err) {
    console.error(`❌ [${context}] Error sending invoice:`, err);
    return false;
  }
}

// Helper function to save order and notify kitchen - using EXACT same format as original working code
async function saveOrderAndNotifyKitchen(orderItems, customerName, customerNumber, totalPrice, sessionId, orderText, context = "") {
  try {
    // Step 1: Save order to database - EXACT same format as original working code
    console.log(`💾 [${context}] Saving order to database...`);
    const saveOrderResponse = await fetch("https://n8n.srv1004057.hstgr.cloud/webhook/save-order", {
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

    const saveOrderResponseText = await saveOrderResponse.text();
    console.log(`💾 [${context}] Save order response status: ${saveOrderResponse.status}`);
    console.log(`💾 [${context}] Save order response body: ${saveOrderResponseText}`);

    if (!saveOrderResponse.ok) {
      console.error(`❌ [${context}] Failed to save order:`, saveOrderResponse.status, saveOrderResponseText);
      return { saveOrderSuccess: false, kitchenNotifySuccess: false };
    }

    console.log(`✅ [${context}] Order saved successfully!`);

    // Step 2: Notify kitchen - EXACT same format as original working code
    console.log(`📱 [${context}] Sending WhatsApp message to kitchen...`);
    const kitchenResponse = await fetch("https://n8n.srv1004057.hstgr.cloud/webhook/kitchen_order", {
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

    const kitchenResponseText = await kitchenResponse.text();
    console.log(`📱 [${context}] Kitchen response status: ${kitchenResponse.status}`);
    console.log(`📱 [${context}] Kitchen response body: ${kitchenResponseText}`);

    if (!kitchenResponse.ok) {
      console.error(`❌ [${context}] Failed to notify kitchen:`, kitchenResponse.status, kitchenResponseText);
      return { saveOrderSuccess: true, kitchenNotifySuccess: false };
    }

    console.log(`✅ [${context}] Kitchen notified successfully!`);
    console.log(`🎉 [${context}] Both operations completed successfully!`);

    return { saveOrderSuccess: true, kitchenNotifySuccess: true };
  } catch (err) {
    console.error(`❌ [${context}] Error:`, err);
    return { saveOrderSuccess: false, kitchenNotifySuccess: false };
  }
}

// CREATE CHECKOUT SESSION
app.post("/create-checkout-session", async (req, res) => {
  const {
    customer_name,
    customer_number,
    order_items,
    total_price,
    session_id,
  } = req.body;

  try {
    // Store only essential order data (without image_urls) to fit Stripe's 500 char metadata limit
    const orderItemsForMetadata = order_items.map(({ id, name, price }) => ({
      id,
      name,
      price,
    }));
    
    let orderMetadata = JSON.stringify(orderItemsForMetadata);
    
    // If still too long, truncate further (shouldn't happen, but safety check)
    if (orderMetadata.length > 450) {
      console.warn(`Order metadata is ${orderMetadata.length} chars, using minimal format...`);
      // Store only IDs and names as fallback
      const minimalOrder = order_items.map(({ id, name }) => ({ id, name }));
      orderMetadata = JSON.stringify(minimalOrder);
      if (orderMetadata.length > 450) {
        throw new Error("Order data too large for Stripe metadata. Please reduce order size.");
      }
      // Use minimal format
      orderItemsForMetadata.splice(0, orderItemsForMetadata.length, ...minimalOrder);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sar",
            product_data: { name: "Zuccess Restaurant Order" },
            unit_amount: total_price * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        customer_name,
        customer_number,
        session_id,
        order: JSON.stringify(orderItemsForMetadata),
        // Store full order with images separately if needed (we'll get it from the original request)
      },
      success_url: "http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:3000/payment-cancel",
    });

    res.json({ checkout_url: session.url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe error" });
  }
});

// VERIFY PAYMENT AND SAVE ORDER (called from frontend after redirect)
app.post("/verify-payment", async (req, res) => {
  const { session_id } = req.body;

  console.log("🔍 [Verify Payment] Received request with session_id:", session_id);

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("🔍 [Verify Payment] Session retrieved. Payment status:", session.payment_status);

    if (session.payment_status !== "paid") {
      console.error("❌ [Verify Payment] Payment not completed. Status:", session.payment_status);
      return res.status(400).json({ error: "Payment not completed" });
    }

    // Check if already processed (prevent duplicate processing)
    if (session.metadata?.processed === "true") {
      console.log("⚠️ [Verify Payment] Order already processed");
      return res.json({ 
        success: true, 
        message: "Order already processed",
        session_id: session.id 
      });
    }

    // If processing, wait a bit and retry (webhook might be processing)
    if (session.metadata?.processed === "processing") {
      console.log("⏳ [Verify Payment] Order is being processed, waiting...");
      return res.status(202).json({ 
        success: false, 
        message: "Order is being processed, please wait",
        session_id: session.id 
      });
    }

    console.log("📋 [Verify Payment] Session metadata:", JSON.stringify(session.metadata, null, 2));
    
    if (!session.metadata || !session.metadata.order) {
      console.error("❌ [Verify Payment] Missing order data in session metadata");
      console.error("❌ [Verify Payment] Available metadata keys:", Object.keys(session.metadata || {}));
      return res.status(400).json({ error: "Missing order data in payment session" });
    }

    if (!session.metadata.customer_name || !session.metadata.customer_number) {
      console.error("❌ [Verify Payment] Missing customer data");
      return res.status(400).json({ error: "Missing customer data in payment session" });
    }

    let orderItems;
    try {
      orderItems = JSON.parse(session.metadata.order);
      console.log("✅ [Verify Payment] Parsed order items:", JSON.stringify(orderItems, null, 2));
      
      // Validate order items
      if (!Array.isArray(orderItems) || orderItems.length === 0) {
        throw new Error("Order items must be a non-empty array");
      }
      
      // Ensure all items have required fields
      orderItems = orderItems.map(item => ({
        id: item.id || "unknown",
        name: item.name || "Unknown Item",
        price: item.price || 0
      }));
      
    } catch (parseErr) {
      console.error("❌ [Verify Payment] Failed to parse order items:", parseErr);
      console.error("❌ [Verify Payment] Raw order metadata:", session.metadata.order);
      return res.status(400).json({ error: "Invalid order data format" });
    }

    const totalPrice = session.amount_total / 100;
    console.log("💰 [Verify Payment] Total price:", totalPrice);
    console.log("👤 [Verify Payment] Customer:", session.metadata.customer_name);
    console.log("📞 [Verify Payment] Customer number:", session.metadata.customer_number);
    
    // Format WhatsApp message for kitchen - EXACT same format as original working code
    const itemsText = orderItems.map((i) => `- ${i.name} — ${i.price} SAR`).join("\n");
    const orderText = `
New Order Received 🍽️

👤 Customer: ${session.metadata.customer_name}
📞 Phone: ${session.metadata.customer_number}
🧾 Session ID: ${session.metadata.session_id}

🛒 Items:
${itemsText}

💰 Total: ${totalPrice} SAR

Sent from Zuccess Restaurant AI Assistant 🤖
    `;

    console.log("🚀 [Verify Payment] Starting to save order and notify kitchen...");
    
    // Save order and notify kitchen using EXACT same format as original working code
    const result = await saveOrderAndNotifyKitchen(
      orderItems,
      session.metadata.customer_name,
      session.metadata.customer_number,
      totalPrice,
      session.metadata.session_id,
      orderText,
      "Verify Payment"
    );
    
    console.log("📊 [Verify Payment] Result:", JSON.stringify(result, null, 2));

    if (!result.saveOrderSuccess) {
      return res.status(500).json({ 
        error: "Failed to save order to database"
      });
    }

    if (!result.kitchenNotifySuccess) {
      // Order was saved but kitchen notification failed - still return success with warning
      console.warn("⚠️ Order saved but kitchen notification failed");
    }

    // Send invoice to customer (with duplicate prevention)
    // Check if already sent or being sent by another process
    if (session.metadata?.invoice_sent === "true") {
      console.log("ℹ️ [Verify Payment] Invoice already sent, skipping...");
    } else if (session.metadata?.invoice_sending === "true") {
      console.log("ℹ️ [Verify Payment] Invoice is being sent by another process (webhook), skipping...");
    } else {
      // Mark as sending to prevent race condition
      try {
        await stripe.checkout.sessions.update(session_id, {
          metadata: { ...session.metadata, invoice_sending: "true" },
        });
      } catch (updateErr) {
        console.error("⚠️ [Verify Payment] Failed to set invoice_sending flag:", updateErr);
        // Continue anyway - better to send duplicate than not send at all
      }

      console.log("📧 [Verify Payment] Sending invoice to customer...");
      const invoiceSent = await sendInvoiceToCustomer(
        session.metadata.customer_name,
        session.metadata.customer_number,
        orderItems,
        totalPrice,
        "Verify Payment"
      );

      if (invoiceSent) {
        console.log("✅ [Verify Payment] Invoice sent successfully!");
        // Mark invoice as sent in metadata
        try {
          await stripe.checkout.sessions.update(session_id, {
            metadata: { ...session.metadata, invoice_sent: "true", invoice_sending: "false" },
          });
        } catch (updateErr) {
          console.error("⚠️ [Verify Payment] Failed to update invoice_sent metadata:", updateErr);
        }
      } else {
        console.warn("⚠️ [Verify Payment] Invoice sending failed");
        // Reset sending flag on failure so webhook can retry
        try {
          await stripe.checkout.sessions.update(session_id, {
            metadata: { ...session.metadata, invoice_sending: "false" },
          });
        } catch (updateErr) {
          console.error("⚠️ [Verify Payment] Failed to reset invoice_sending flag:", updateErr);
        }
      }
    }

    // Mark as processed in metadata to prevent duplicate processing
    try {
      await stripe.checkout.sessions.update(session_id, {
        metadata: { ...session.metadata, processed: "true" },
      });
    } catch (updateErr) {
      console.error("⚠️ [Verify Payment] Failed to update metadata:", updateErr);
      // Continue anyway
    }

    res.json({ 
      success: true, 
      message: "Order saved and kitchen notified",
      session_id: session.id
    });

  } catch (err) {
    console.error("❌ [Verify Payment] Error:", err);
    res.status(500).json({ error: "Payment verification failed", details: err.message });
  }
});

// STRIPE WEBHOOK
app.post("/stripe-webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(400).send("Webhook Error");
  }

  if (event.type === "checkout.session.completed") {
    console.log("✅ [Webhook] Payment successful! Processing order...");
    const session = event.data.object;
    console.log("🔍 [Webhook] Session ID:", session.id);
    console.log("🔍 [Webhook] Payment status:", session.payment_status);

    // Check if already processed (prevent duplicate processing)
    if (session.metadata?.processed === "true") {
      console.log("⚠️ [Webhook] Order already processed, skipping webhook handler");
      return res.json({ received: true, message: "Already processed" });
    }

    try {
      // Mark as processing to prevent race conditions
      const currentMetadata = session.metadata || {};
      await stripe.checkout.sessions.update(session.id, {
        metadata: { ...currentMetadata, processed: "processing" },
      });

      console.log("📋 [Webhook] Session metadata:", JSON.stringify(session.metadata, null, 2));
      
      if (!session.metadata || !session.metadata.order) {
        console.error("❌ [Webhook] Missing order data in session metadata");
        console.error("❌ [Webhook] Available metadata keys:", Object.keys(session.metadata || {}));
        throw new Error("Missing order data in payment session");
      }

      if (!session.metadata.customer_name || !session.metadata.customer_number) {
        console.error("❌ [Webhook] Missing customer data");
        throw new Error("Missing customer data in payment session");
      }

      let orderItems;
      try {
        orderItems = JSON.parse(session.metadata.order);
        console.log("✅ [Webhook] Parsed order items:", JSON.stringify(orderItems, null, 2));
        
        // Validate order items
        if (!Array.isArray(orderItems) || orderItems.length === 0) {
          throw new Error("Order items must be a non-empty array");
        }
        
        // Ensure all items have required fields
        orderItems = orderItems.map(item => ({
          id: item.id || "unknown",
          name: item.name || "Unknown Item",
          price: item.price || 0
        }));
        
      } catch (parseErr) {
        console.error("❌ [Webhook] Failed to parse order items:", parseErr);
        console.error("❌ [Webhook] Raw order metadata:", session.metadata.order);
        throw new Error("Invalid order data format");
      }

      const totalPrice = session.amount_total / 100;
      console.log("💰 [Webhook] Total price:", totalPrice);
      console.log("👤 [Webhook] Customer:", session.metadata.customer_name);
      console.log("📞 [Webhook] Customer number:", session.metadata.customer_number);
      
      // Format WhatsApp message for kitchen - EXACT same format as original working code
      const itemsText = orderItems.map((i) => `- ${i.name} — ${i.price} SAR`).join("\n");
      const orderText = `
New Order Received 🍽️

👤 Customer: ${session.metadata.customer_name}
📞 Phone: ${session.metadata.customer_number}
🧾 Session ID: ${session.metadata.session_id}

🛒 Items:
${itemsText}

💰 Total: ${totalPrice} SAR

Sent from Zuccess Restaurant AI Assistant 🤖
      `;

      console.log("🚀 [Webhook] Starting to save order and notify kitchen...");
      
      // Save order and notify kitchen using EXACT same format as original working code
      const result = await saveOrderAndNotifyKitchen(
        orderItems,
        session.metadata.customer_name,
        session.metadata.customer_number,
        totalPrice,
        session.metadata.session_id,
        orderText,
        "Webhook"
      );

      console.log("📊 [Webhook] Result:", JSON.stringify(result, null, 2));

      // Send invoice to customer after successful order save (only if not already sent or being sent)
      if (result.saveOrderSuccess) {
        if (session.metadata?.invoice_sent === "true") {
          console.log("ℹ️ [Webhook] Invoice already sent, skipping...");
        } else if (session.metadata?.invoice_sending === "true") {
          console.log("ℹ️ [Webhook] Invoice is being sent by another process, skipping...");
        } else {
          // Mark as sending to prevent race condition
          try {
            const currentMetadata = session.metadata || {};
            await stripe.checkout.sessions.update(session.id, {
              metadata: { ...currentMetadata, invoice_sending: "true" },
            });
          } catch (updateErr) {
            console.error("⚠️ [Webhook] Failed to set invoice_sending flag:", updateErr);
          }

          console.log("📧 [Webhook] Sending invoice to customer...");
          const invoiceSent = await sendInvoiceToCustomer(
            session.metadata.customer_name,
            session.metadata.customer_number,
            orderItems,
            totalPrice,
            "Webhook"
          );

          if (invoiceSent) {
            console.log("✅ [Webhook] Invoice sent successfully!");
            // Mark invoice as sent in metadata
            try {
              const currentMetadata = session.metadata || {};
              await stripe.checkout.sessions.update(session.id, {
                metadata: { ...currentMetadata, invoice_sent: "true", invoice_sending: "false" },
              });
            } catch (updateErr) {
              console.error("⚠️ [Webhook] Failed to update invoice_sent metadata:", updateErr);
            }
          } else {
            console.warn("⚠️ [Webhook] Order processed but invoice sending failed");
            // Reset sending flag on failure
            try {
              const currentMetadata = session.metadata || {};
              await stripe.checkout.sessions.update(session.id, {
                metadata: { ...currentMetadata, invoice_sending: "false" },
              });
            } catch (updateErr) {
              console.error("⚠️ [Webhook] Failed to reset invoice_sending flag:", updateErr);
            }
          }
        }
      } else {
        console.error("❌ [Webhook] Order not saved, skipping invoice");
      }

      // Mark as fully processed (even if there were errors, we tried)
      try {
        const finalMetadata = session.metadata || {};
        await stripe.checkout.sessions.update(session.id, {
          metadata: { ...finalMetadata, processed: "true" },
        });
      } catch (updateErr) {
        console.error("⚠️ [Webhook] Failed to update metadata:", updateErr);
        // Continue anyway
      }

    } catch (err) {
      console.error("❌ [Webhook] Error processing order after payment:", err);
      console.error("❌ [Webhook] Error stack:", err.stack);
      // Don't throw - we still want to acknowledge the webhook to Stripe
      // Mark as error so verify-payment can retry
      try {
        const errorMetadata = session.metadata || {};
        await stripe.checkout.sessions.update(session.id, {
          metadata: { ...errorMetadata, processed: "error" },
        });
      } catch (updateErr) {
        console.error("⚠️ [Webhook] Failed to update error metadata:", updateErr);
      }
    }
  }

  // Always respond to Stripe, even if processing failed
  res.json({ received: true });
});

// TEST ENDPOINT - to verify save and notify functions work
app.post("/test-save-notify", async (req, res) => {
  try {
    const testData = {
      orderItems: [{ name: "Test Pizza", price: 25 }],
      customerName: "Test Customer",
      customerNumber: "1234567890",
      totalPrice: 25,
      sessionId: "test_session_" + Date.now(),
      orderText: "Test order message"
    };

    console.log("🧪 Testing save and notify functions...");
    const result = await saveOrderAndNotifyKitchen(
      testData.orderItems,
      testData.customerName,
      testData.customerNumber,
      testData.totalPrice,
      testData.sessionId,
      testData.orderText,
      "Test"
    );

    res.json({
      success: true,
      result: result,
      message: "Test completed - check console logs"
    });
  } catch (err) {
    console.error("❌ Test error:", err);
    res.status(500).json({ error: err.message });
  }
});
const PORT = process.env.PORT || 4242;

app.listen(PORT, () => {
  console.log(`🚀 Stripe backend running on port ${PORT}`);
});

export default app;

// app.listen(4242, () =>
//   console.log("🚀 Stripe backend running on http://localhost:4242")
// );