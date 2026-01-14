export async function startVoiceCapture(onFinalText, sessionId, sttLang = "ar-SA") {
  // Browser Speech Recognition ONLY (simple & stable)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    const errorMsg = "التعرف على الصوت غير مدعوم. الرجاء استخدام متصفح Chrome أو Edge.";
    alert(errorMsg);
    throw new Error("SpeechRecognition not supported");
  }

  // Check if HTTPS (required for getUserMedia on mobile)
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const errorMsg = "الوصول للميكروفون يتطلب HTTPS. الرجاء استخدام اتصال آمن.";
    alert(errorMsg);
    throw new Error("HTTPS required");
  }

  // Stop any previous
  await stopVoiceCapture();

  const recognition = new SpeechRecognition();
  recognition.lang = sttLang; // ✅ ar-SA by default
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  window.__voiceRecognition = recognition;

  // Store callback for error handling
  let errorCallback = null;

  recognition.onresult = async (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    const finalText = transcript.trim();

    if (finalText) {
      await onFinalText(finalText);
    }
  };

  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e.error);
    
    // Handle specific error cases
    let errorMessage = "";
    switch (e.error) {
      case "not-allowed":
      case "permission-denied":
        errorMessage = "تم رفض إذن الميكروفون. الرجاء السماح بالوصول للميكروفون في إعدادات المتصفح والمحاولة مرة أخرى.";
        break;
      case "no-speech":
        // This is normal, user didn't speak - don't show error
        return;
      case "aborted":
        // User stopped - don't show error
        return;
      case "network":
        errorMessage = "خطأ في الشبكة. الرجاء التحقق من الاتصال والمحاولة مرة أخرى.";
        break;
      case "service-not-allowed":
        errorMessage = "خدمة التعرف على الصوت غير متاحة. الرجاء المحاولة لاحقاً.";
        break;
      default:
        errorMessage = `خطأ في التعرف على الصوت: ${e.error}. الرجاء المحاولة مرة أخرى.`;
    }
    
    if (errorMessage) {
      // Only show error for critical issues
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        alert(errorMessage);
      }
    }
  };

  recognition.onstart = () => {
    console.log("Speech recognition started");
  };

  recognition.onend = () => {
    // no auto-restart (clean)
    console.log("Speech recognition ended");
  };

  try {
    recognition.start();
  } catch (error) {
    console.error("Failed to start recognition:", error);
    
    // If permission is denied, show helpful message
    if (error.name === "NotAllowedError" || error.message.includes("permission")) {
      alert("إذن الميكروفون مطلوب. الرجاء:\n1. اضغط على أيقونة الميكروفون مرة أخرى\n2. اسمح بالوصول للميكروفون عند الطلب\n3. تأكد من عدم استخدام تطبيقات أخرى للميكروفون");
    } else {
      alert(`فشل بدء تسجيل الصوت: ${error.message}. الرجاء المحاولة مرة أخرى.`);
    }
    throw error;
  }

  return recognition;
}

export async function stopVoiceCapture() {
  if (window.__voiceRecognition) {
    try {
      window.__voiceRecognition.stop();
    } catch (e) {
      // ignore
    }
    window.__voiceRecognition = null;
  }
}