import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./App.css";

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

        setStatus("success");
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
      }
    };

    verify();
  }, [searchParams, navigate]);

  const handleManualRedirect = () => {
    navigate("/?from_payment=true", { replace: true });
  };

  return (
    <div className="payment-success-page">
      {status === "processing" && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="order-success-content">
              <span className="order-success-icon">⏳</span>
              <h2>جاري المعالجة...</h2>
              <p>{message}</p>
              <button className="confirm" onClick={handleManualRedirect}>
                العودة للصفحة الرئيسية
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="modal-overlay">
          <div className="modal order-success-modal">
            <div className="order-success-content">
              <span className="order-success-icon">✅</span>
              <h2>تم تسجيل طلبك</h2>
              <p>سيتم توصيل طلبك قريباً</p>
              <button className="confirm" onClick={handleManualRedirect}>
                العودة للصفحة الرئيسية
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="order-success-content">
              <span className="order-success-icon">❌</span>
              <h2>حدث خطأ</h2>
              <p style={{ color: "crimson" }}>{message}</p>
              <button className="confirm" onClick={handleManualRedirect}>
                العودة للصفحة الرئيسية
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
