import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const BACKEND_API = "http://localhost:4242";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing your order...");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setMessage("No payment session found.");
      return;
    }

    // Verify payment and trigger order save/notification
    const verifyPayment = async () => {
      try {
        console.log("🔍 Verifying payment for session:", sessionId);
        const response = await fetch(`${BACKEND_API}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        console.log("📡 Response status:", response.status);
        const data = await response.json();
        console.log("📦 Response data:", data);

        if (response.ok && data.success) {
          setStatus("success");
          setMessage("✅ Payment successful! Your order has been saved and sent to the kitchen!");
          
          // Redirect to home after 3 seconds
          setTimeout(() => {
            navigate("/");
          }, 3000);
        } else {
          setStatus("error");
          setMessage(data.error || "Failed to process order. Please contact support.");
          console.error("❌ Error response:", data);
        }
      } catch (err) {
        console.error("❌ Payment verification error:", err);
        setStatus("error");
        setMessage(`Network error: ${err.message}. Please check if your order was processed.`);
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  return (
    <div style={{ padding: 40, textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <h1>
        {status === "processing" && "⏳ Processing..."}
        {status === "success" && "✅ Payment Successful"}
        {status === "error" && "❌ Error"}
      </h1>
      <p style={{ fontSize: "18px", marginTop: "20px" }}>{message}</p>
      {status === "success" && (
        <p style={{ fontSize: "14px", color: "#666", marginTop: "10px" }}>
          Redirecting you back...
        </p>
      )}
    </div>
  );
}
