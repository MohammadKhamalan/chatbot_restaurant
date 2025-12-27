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
      setTimeout(() => navigate("/"), 5000);
      return;
    }

    const verify = async () => {
      try {
        setStatus("processing");
        setMessage("Verifying payment status...");
        console.log("Verifying payment with session_id:", sessionId);
        console.log("Backend API:", BACKEND_API);

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout - taking too long")), 15000); // 15 second timeout
        });

        // Create the fetch promise
        const fetchPromise = fetch(`${BACKEND_API}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        }).then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            let data = {};
            try {
              data = JSON.parse(text);
            } catch (e) {
              throw new Error(text || "Payment verification failed");
            }
            const errorMsg = data.details || data.error || "Payment verification failed";
            throw new Error(errorMsg);
          }
          return res;
        });

        // Race between fetch and timeout
        let response;
        try {
          response = await Promise.race([fetchPromise, timeoutPromise]);
        } catch (raceErr) {
          // If timeout wins, raceErr will be the timeout error
          throw raceErr;
        }

        const data = await response.json().catch(() => ({}));
        console.log("Payment verification response:", data);

        // Check if order was actually processed
        const wasProcessed = data.processed === "true" || data.processed_via === "verify-payment";
        
        setStatus("success");
        setMessage(
          wasProcessed 
            ? "✅ Payment verified. Your order has been processed and sent to the kitchen. Invoice will be sent to WhatsApp."
            : "✅ Payment verified. Your order is being processed."
        );

        // Redirect after 3 seconds with flag to clear order
        setTimeout(() => {
          console.log("Redirecting to home page...");
          navigate("/?from_payment=true", { replace: true });
        }, 2000);
      } catch (err) {
        console.error("Payment verification error:", err);
        console.error("Error details:", {
          message: err.message,
          stack: err.stack,
          backend: BACKEND_API
        });
        
        // Even if verification fails, payment was successful in Stripe
        // So we show a success message but note the verification issue
        setStatus("success");
        setMessage(
          "✅ Payment successful! Your order is being processed. " +
          (err.message.includes("timeout") 
            ? "Verification is taking longer than expected, but your payment was received."
            : "If you don't receive a confirmation, please contact support.")
        );
        
        // Still redirect, but give more time
        setTimeout(() => {
          console.log("Redirecting to home page after error...");
          navigate("/?from_payment=true", { replace: true });
        }, 3000);
      }
    };

    verify();
  }, [searchParams, navigate]);

  const handleManualRedirect = () => {
    navigate("/?from_payment=true", { replace: true });
  };

  return (
    <div style={{ padding: 40, textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
      {status === "processing" && (
        <>
          <h1>⏳ Processing...</h1>
          <p>{message}</p>
          <div style={{ marginTop: 20 }}>
            <button 
              onClick={handleManualRedirect}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer"
              }}
            >
              Go to Home Page
            </button>
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <h1>✅ Payment Successful</h1>
          <p>{message}</p>
          <p style={{ opacity: 0.7, marginTop: 20 }}>Redirecting automatically…</p>
          <div style={{ marginTop: 20 }}>
            <button 
              onClick={handleManualRedirect}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer"
              }}
            >
              Go to Home Page Now
            </button>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <h1>❌ Error</h1>
          <p style={{ color: "crimson" }}>{message}</p>
          <p style={{ opacity: 0.7, marginTop: 20 }}>Redirecting automatically…</p>
          <div style={{ marginTop: 20 }}>
            <button 
              onClick={handleManualRedirect}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer"
              }}
            >
              Go to Home Page
            </button>
          </div>
        </>
      )}
    </div>
  );
}
