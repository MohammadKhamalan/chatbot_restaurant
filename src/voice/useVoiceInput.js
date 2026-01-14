export async function startVoiceCapture(onFinalText, sessionId, sttLang = "ar-SA") {
  // Browser Speech Recognition ONLY (simple & stable)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    const errorMsg = "Speech recognition not supported. Please use Chrome or Edge browser.";
    alert(errorMsg);
    throw new Error("SpeechRecognition not supported");
  }

  // Check if HTTPS (required for getUserMedia on mobile)
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const errorMsg = "Microphone access requires HTTPS. Please use a secure connection.";
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
        errorMessage = "Microphone permission denied. Please allow microphone access in your browser settings and try again.";
        break;
      case "no-speech":
        // This is normal, user didn't speak - don't show error
        return;
      case "aborted":
        // User stopped - don't show error
        return;
      case "network":
        errorMessage = "Network error. Please check your connection and try again.";
        break;
      case "service-not-allowed":
        errorMessage = "Speech recognition service not available. Please try again later.";
        break;
      default:
        errorMessage = `Speech recognition error: ${e.error}. Please try again.`;
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
      alert("Microphone permission is required. Please:\n1. Click the microphone icon again\n2. Allow microphone access when prompted\n3. Make sure no other apps are using the microphone");
    } else {
      alert(`Failed to start voice recording: ${error.message}. Please try again.`);
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