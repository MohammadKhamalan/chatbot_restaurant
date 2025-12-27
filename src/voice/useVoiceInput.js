export async function startVoiceCapture(onFinalText, sessionId, sttLang = "ar-SA") {
  // Browser Speech Recognition ONLY (simple & stable)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Speech recognition not supported. Use Chrome / Edge.");
    throw new Error("SpeechRecognition not supported");
  }

  // Stop any previous
  await stopVoiceCapture();

  const recognition = new SpeechRecognition();
  recognition.lang = sttLang; // ✅ ar-SA by default
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  window.__voiceRecognition = recognition;

  recognition.onresult = async (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    const finalText = transcript.trim();

    if (finalText) {
      await onFinalText(finalText);
    }
  };

  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e.error);
  };

  recognition.onend = () => {
    // no auto-restart (clean)
  };

  recognition.start();
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