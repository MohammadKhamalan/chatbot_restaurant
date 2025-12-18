import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const BACKEND_API = process.env.REACT_APP_BACKEND_API || "http://localhost:4242";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("processing"); // processing, success, error
  const [message, setMessage] = useState("Processing your payment...");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setMessage("No session ID found. Please contact support.");
      return;
    }

    // Call verify-payment endpoint
    const verifyPayment = async () => {
      try {
        setStatus("processing");
        setMessage("Verifying payment and processing your order...");

        const response = await fetch(`${BACKEND_API}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Payment verification failed");
        }

        setStatus("success");
        setMessage("Order processed successfully! Your invoice will be sent to you on WhatsApp shortly.");

        // Redirect back home after 5 seconds
        setTimeout(() => {
          navigate("/");
        }, 5000);

      } catch (err) {
        console.error("Payment verification error:", err);
        setStatus("error");
        setMessage(`Error: ${err.message}. Please contact support if the issue persists.`);
        
        // Still redirect after error, but give more time
        setTimeout(() => {
          navigate("/");
        }, 8000);
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        padding: 40,
        textAlign: "center",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {status === "processing" && (
        <>
          <h1>⏳ Processing...</h1>
          <p style={{ fontSize: "18px", marginTop: "20px" }}>{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <h1>✅ Payment Successful</h1>
          <p style={{ fontSize: "18px", marginTop: "20px" }}>
            Thank you! Your order has been received.
          </p>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "10px" }}>
            📄 {message}
          </p>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "10px" }}>
            Redirecting you back…
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <h1>❌ Error</h1>
          <p style={{ fontSize: "18px", marginTop: "20px", color: "#d32f2f" }}>
            {message}
          </p>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "10px" }}>
            Redirecting you back…
          </p>
        </>
      )}
    </div>
  );
}
