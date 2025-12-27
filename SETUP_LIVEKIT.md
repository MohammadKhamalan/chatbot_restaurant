# LiveKit Voice Integration Setup Guide

## Prerequisites

1. Node.js v18 or higher (you have v24.11.1 ✅)
2. LiveKit credentials (already provided)
3. OpenAI API key (required for audio transcription and TTS)

## Environment Variables Setup

### Backend (.env file in `backend/` folder)

Your backend `.env` file already has the LiveKit credentials:
```env
LIVEKIT_URL=wss://chatbotzuccess-5l7ci8pq.livekit.cloud
LIVEKIT_API_KEY=APICTuXqBKfRnt9
LIVEKIT_API_SECRET=MseeDcWpvffGjuSqKI8cDUu7oPrQNfAOWb49dRH8N1xA
```

### Agent (.env file in `agent/` folder)

Create a `.env` file in the `agent/` directory with:

```env
# LiveKit Configuration (same as backend)
LIVEKIT_URL=wss://chatbotzuccess-5l7ci8pq.livekit.cloud
LIVEKIT_API_KEY=APICTuXqBKfRnt9
LIVEKIT_API_SECRET=MseeDcWpvffGjuSqKI8cDUu7oPrQNfAOWb49dRH8N1xA

# OpenAI API Key (required for transcription and TTS)
OPENAI_API_KEY=your_openai_api_key_here
```

**Important:** You need to get an OpenAI API key from https://platform.openai.com/api-keys

## Installation

1. **Install backend dependencies** (if not already done):
   ```bash
   cd backend
   npm install
   ```

2. **Install agent dependencies** (if not already done):
   ```bash
   cd agent
   npm install
   ```

3. **Install frontend dependencies** (if not already done):
   ```bash
   cd ..
   npm install
   ```

## Running the Application

You need to run **3 processes** simultaneously:

### 1. Backend Server (Terminal 1)
```bash
cd backend
npm start
```
Should start on: `http://localhost:4242`

### 2. LiveKit Agent (Terminal 2)
```bash
cd agent
npm start
```
This agent will:
- Connect to LiveKit
- Listen for user voice input
- Transcribe speech using OpenAI Whisper
- Send transcriptions to the chatbot
- Generate TTS responses

### 3. Frontend Server (Terminal 3)
```bash
npm start
```
Should start on: `http://localhost:3000`

## How It Works

1. **User clicks microphone button** → Frontend publishes audio track to LiveKit
2. **Agent receives audio** → Transcribes using OpenAI Whisper (Arabic)
3. **Agent calls chatbot** → Sends transcribed text to N8N webhook
4. **Agent receives response** → Gets text response + menu items (if any)
5. **Agent sends to frontend** → Sends response as data message + TTS audio
6. **Frontend displays** → Shows menu items and plays audio response

## Features

- ✅ Voice input (speak to request categories like "drinks")
- ✅ Automatic transcription (Arabic speech to text)
- ✅ Menu items display (when user asks for category)
- ✅ Voice responses (TTS reads menu items aloud)
- ✅ Text chat fallback (if LiveKit not connected)

## Troubleshooting

### Agent won't start
- Check that `.env` file exists in `agent/` folder
- Verify `OPENAI_API_KEY` is set correctly
- Check that LiveKit credentials are correct

### Voice not working
- Ensure all 3 processes are running (backend, agent, frontend)
- Check browser console for errors
- Verify microphone permissions in browser
- Check agent logs for transcription errors

### No audio transcription
- Verify OpenAI API key is valid and has credits
- Check agent logs for OpenAI API errors
- Ensure audio track is being published from frontend

### Menu items not showing
- Check that N8N webhook returns menu items in correct format
- Check browser console for data messages from agent
- Verify agent is sending menuItems in response data

## Notes

- The agent uses OpenAI Whisper for speech-to-text (Arabic)
- The agent uses OpenAI TTS for text-to-speech responses
- Audio transcription happens server-side (agent)
- TTS audio is streamed from agent to frontend via LiveKit


