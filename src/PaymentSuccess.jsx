import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const BACKEND_API = process.env.REACT_APP_BACKEND_API || "http://localhost:4242";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing your payment...");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setMessage("No session ID found. Please contact support.");
      return;
    }

    const verify = async () => {
      try {
        setStatus("processing");
        setMessage("Verifying payment status...");

        const response = await fetch(`${BACKEND_API}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errorMsg = data.details || data.error || "Payment verification failed";
          console.error("Payment verification error:", data);
          throw new Error(errorMsg);
        }

        // Check if order was actually processed
        const wasProcessed = data.processed === "true" || data.processed_via === "fallback";
        
        setStatus("success");
        setMessage(
          wasProcessed 
            ? "✅ Payment verified. Your order has been processed and sent to the kitchen. Invoice will be sent to WhatsApp."
            : "✅ Payment verified. Your order is being processed."
        );

        setTimeout(() => navigate("/"), 4000);
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage(`Error: ${err.message}`);
        setTimeout(() => navigate("/"), 7000);
      }
    };

    verify();
  }, [searchParams, navigate]);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      {status === "processing" && (
        <>
          <h1>⏳ Processing...</h1>
          <p>{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <h1>✅ Payment Successful</h1>
          <p>{message}</p>
          <p style={{ opacity: 0.7 }}>Redirecting…</p>
        </>
      )}

      {status === "error" && (
        <>
          <h1>❌ Error</h1>
          <p style={{ color: "crimson" }}>{message}</p>
          <p style={{ opacity: 0.7 }}>Redirecting…</p>
        </>
      )}
    </div>
  );
}
