// export async function startVoiceCapture(onFinalText, sessionId, sttLang = "ar-SA") {
//   // Browser Speech Recognition ONLY (simple & stable)
//   const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

//   if (!SpeechRecognition) {
//     const errorMsg = "التعرف على الصوت غير مدعوم. الرجاء استخدام متصفح Chrome أو Edge.";
//     alert(errorMsg);
//     throw new Error("SpeechRecognition not supported");
//   }

//   // Check if HTTPS (required for getUserMedia on mobile)
//   if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
//     const errorMsg = "الوصول للميكروفون يتطلب HTTPS. الرجاء استخدام اتصال آمن.";
//     alert(errorMsg);
//     throw new Error("HTTPS required");
//   }

//   // Stop any previous
//   await stopVoiceCapture();

//   const recognition = new SpeechRecognition();
//   recognition.lang = sttLang; // ✅ ar-SA by default
//   recognition.interimResults = false;
//   recognition.continuous = false;
//   recognition.maxAlternatives = 1;

//   window.__voiceRecognition = recognition;

//   // Store callback for error handling
//   let errorCallback = null;

//   recognition.onresult = async (event) => {
//     console.log("🎤 Speech recognition result received:", event);
    
//     // Handle both single and multiple results
//     let transcript = "";
//     if (event.results && event.results.length > 0) {
//       // Get the most confident result
//       const result = event.results[event.results.length - 1];
//       if (result && result.length > 0) {
//         transcript = result[0].transcript || "";
//       }
//     }
    
//     const finalText = transcript.trim();
//     console.log("🎤 Final transcript:", finalText);

//     if (finalText) {
//       try {
//         await onFinalText(finalText);
//       } catch (error) {
//         console.error("Error in onFinalText callback:", error);
//       }
//     } else {
//       console.warn("⚠️ Empty transcript received");
//     }
//   };

//   recognition.onerror = (e) => {
//     console.error("❌ Speech recognition error:", e.error);
//     console.error("❌ Error details:", {
//       error: e.error,
//       message: e.message,
//       userAgent: navigator.userAgent,
//       protocol: window.location.protocol,
//       hostname: window.location.hostname,
//     });
    
//     // Handle specific error cases
//     let errorMessage = "";
//     switch (e.error) {
//       case "not-allowed":
//       case "permission-denied":
//         errorMessage = "تم رفض إذن الميكروفون. الرجاء:\n1. السماح بالوصول للميكروفون في إعدادات المتصفح\n2. إغلاق أي تطبيقات أخرى تستخدم الميكروفون\n3. المحاولة مرة أخرى";
//         break;
//       case "no-speech":
//         // This is normal, user didn't speak - don't show error
//         console.log("ℹ️ No speech detected (normal)");
//         return;
//       case "aborted":
//         // User stopped - don't show error
//         console.log("ℹ️ Speech recognition aborted (normal)");
//         return;
//       case "network":
//         errorMessage = "خطأ في الشبكة. الرجاء التحقق من الاتصال والمحاولة مرة أخرى.";
//         break;
//       case "service-not-allowed":
//         errorMessage = "خدمة التعرف على الصوت غير متاحة. الرجاء المحاولة لاحقاً.";
//         break;
//       case "audio-capture":
//         errorMessage = "لم يتم العثور على ميكروفون. الرجاء التحقق من إعدادات الجهاز.";
//         break;
//       default:
//         errorMessage = `خطأ في التعرف على الصوت: ${e.error}. الرجاء المحاولة مرة أخرى.`;
//     }
    
//     if (errorMessage) {
//       // Only show error for critical issues
//       if (e.error === "not-allowed" || e.error === "permission-denied" || e.error === "network" || e.error === "audio-capture") {
//         alert(errorMessage);
//       }
//     }
//   };

//   recognition.onstart = () => {
//     console.log("Speech recognition started");
//   };

//   recognition.onend = () => {
//     // no auto-restart (clean)
//     console.log("Speech recognition ended");
//     // On mobile, sometimes onend fires without onresult
//     // This is normal if user didn't speak or recognition timed out
//     // Clean up the recognition object
//     if (window.__voiceRecognition === recognition) {
//       window.__voiceRecognition = null;
//     }
//   };

//   try {
//     recognition.start();
//   } catch (error) {
//     console.error("Failed to start recognition:", error);
    
//     // If permission is denied, show helpful message
//     if (error.name === "NotAllowedError" || error.message.includes("permission")) {
//       alert("إذن الميكروفون مطلوب. الرجاء:\n1. اضغط على أيقونة الميكروفون مرة أخرى\n2. اسمح بالوصول للميكروفون عند الطلب\n3. تأكد من عدم استخدام تطبيقات أخرى للميكروفون");
//     } else {
//       alert(`فشل بدء تسجيل الصوت: ${error.message}. الرجاء المحاولة مرة أخرى.`);
//     }
//     throw error;
//   }

//   return recognition;
// }

// export async function stopVoiceCapture() {
//   if (window.__voiceRecognition) {
//     try {
//       window.__voiceRecognition.stop();
//     } catch (e) {
//       // ignore
//     }
//     window.__voiceRecognition = null;
//   }
// }
let recognition = null;


export function startVoiceCapture(onFinalText, sttLang = "ar-SA") {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("التعرف على الصوت غير مدعوم. استخدم Chrome أو Safari.");
    throw new Error("SpeechRecognition not supported");
  }

  // HTTPS check (required on mobile)
  if (
    window.location.protocol !== "https:" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    alert("الميكروفون يتطلب اتصال HTTPS");
    throw new Error("HTTPS required");
  }

  stopVoiceCapture();

  recognition = new SpeechRecognition();
  recognition.lang = sttLang;
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.log("🎤 Speech started");
  };

let finalTranscript = "";

recognition.onresult = (event) => {
  finalTranscript =
    event.results?.[0]?.[0]?.transcript?.trim() || "";

  console.log("🎤 Transcript:", finalTranscript);

  if (finalTranscript && typeof onFinalText === "function") {
    onFinalText(finalTranscript);
  }
};

recognition.onend = () => {
  console.log("🎤 Speech ended");

  // 📱 MOBILE FALLBACK — VERY IMPORTANT
  if (!finalTranscript && typeof onFinalText === "function") {
    console.warn("⚠️ No transcript received (mobile fallback)");
    onFinalText(""); // allows UI to reset
  }

  recognition = null;
};


  recognition.start();
}

export function stopVoiceCapture() {
  if (recognition) {
    try {
      recognition.stop();
    } catch {}
    recognition = null;
  }
}
