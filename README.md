# Zuccess Restaurant Chatbot

AI-powered restaurant ordering system with voice input, menu browsing, and payment processing.

## Features

- 🎤 **Voice Input**: Speak to the chatbot using browser Speech Recognition
- 💬 **Text Chat**: Type messages to interact with the chatbot
- 📋 **Menu Browsing**: Browse pizzas, appetizers, drinks, and desserts
- 🛒 **Order Management**: Add items to cart and manage your order
- 💳 **Payment Processing**: Secure payment via Stripe Checkout
- 📱 **Kitchen Notifications**: Orders are automatically sent to kitchen via WhatsApp
- 📧 **Invoice Delivery**: Customers receive invoices via WhatsApp

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- LiveKit account (for voice features - optional)
- Stripe account (for payments)
- N8N webhooks configured

## Environment Setup

### Backend (.env file in `backend/` folder)

```env
# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# LiveKit Configuration (optional - voice features work without it)
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# N8N Webhooks
N8N_CHAT_WEBHOOK=https://n8n.srv1004057.hstgr.cloud/webhook/restaurant
N8N_KITCHEN_WEBHOOK=https://n8n.srv1004057.hstgr.cloud/webhook/kitchen_order

# Frontend URL (for Stripe redirects)
FRONTEND_URL=http://localhost:3000

# Backend API URL (for voice agent - optional)
BACKEND_API_URL=http://localhost:4242
```

### Frontend (.env file in root folder - optional)

```env
REACT_APP_BACKEND_API=http://localhost:4242
```

## Installation

1. **Clone the repository** (if not already done)
   ```bash
   cd restaurant-chatbot
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ..
   npm install
   ```

## Running the Application

### Option 1: Run Both Servers Manually (Recommended)

1. **Start the Backend Server** (in one terminal)
   ```bash
   cd backend
   npm start
   ```
   - Backend runs on: `http://localhost:4242`
   - You should see: `🚀 Backend running on port 4242`

2. **Start the Frontend Server** (in another terminal)
   ```bash
   npm start
   ```
   - Frontend runs on: `http://localhost:3000`
   - Browser should open automatically

### Option 2: Run with PowerShell Scripts (Windows)

Open PowerShell in the project root and run:

```powershell
# Backend
cd backend; Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start"

# Wait a few seconds, then Frontend
cd ..; Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start"
```

### Option 3: Check if Servers are Running

Check if servers are already running:
```powershell
netstat -ano | findstr ":4242 :3000"
```

If ports are in use, you may need to stop existing processes:
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

## Project Structure

```
restaurant-chatbot/
├── backend/
│   ├── server.js          # Main backend server (Express API)
│   ├── voice-agent.js     # Voice agent (disabled - not needed)
│   ├── package.json
│   └── .env               # Backend environment variables
├── src/
│   ├── App.jsx            # Main React component
│   ├── App.css            # Styles
│   ├── voice/
│   │   └── useVoiceInput.js  # Voice input handling
│   ├── PaymentSuccess.jsx # Payment success page
│   └── PaymentCancel.jsx  # Payment cancel page
├── package.json           # Frontend dependencies
└── .env                   # Frontend environment variables (optional)
```

## API Endpoints

### Backend (Port 4242)

- `GET /` - Health check
- `GET /livekit-token` - Get LiveKit access token (optional)
- `POST /create-checkout-session` - Create Stripe checkout session
- `POST /verify-payment` - Verify payment and process order

## How It Works

1. **Voice Input Flow**:
   - User clicks microphone button
   - Browser Speech Recognition captures voice
   - Transcription is sent to N8N chatbot webhook
   - Response is displayed and spoken via browser TTS
   - Menu items (if any) are rendered

2. **Text Input Flow**:
   - User types message
   - Message is sent to N8N chatbot webhook
   - Response is displayed and spoken

3. **Order Flow**:
   - User adds items to cart
   - Clicks "Confirm Order"
   - Enters customer details
   - Redirected to Stripe Checkout
   - After payment, order is saved and kitchen is notified
   - Invoice is sent to customer via WhatsApp

## Troubleshooting

### Backend won't start
- Check if port 4242 is already in use: `netstat -ano | findstr ":4242"`
- Verify `.env` file exists in `backend/` folder
- Check Stripe API keys are correct

### Frontend won't start
- Check if port 3000 is already in use: `netstat -ano | findstr ":3000"`
- Try clearing cache: `npm start -- --reset-cache`

### Voice input not working
- Ensure browser allows microphone access
- Use Chrome or Edge (best Speech Recognition support)
- Voice features work without LiveKit (uses browser STT/TTS)

### Payment errors
- Verify Stripe keys in backend `.env`
- Check Stripe webhook URL is correct
- Ensure frontend URL matches `FRONTEND_URL` in backend `.env`

### Chatbot not responding
- Verify N8N webhook URLs are correct
- Check N8N workflow is active
- Look at browser console for errors

## Notes

- **Voice Agent**: The Node.js voice agent (`voice-agent.js`) is disabled because `livekit-client` requires browser WebRTC APIs. The system works perfectly without it using browser Speech Recognition + direct API calls.

- **LiveKit**: LiveKit is optional. Voice features work using browser-native Speech Recognition and Text-to-Speech.

## Development

- Backend: Express.js with Stripe integration
- Frontend: React.js with voice capabilities
- Chatbot: N8N webhooks
- Payments: Stripe Checkout
- Notifications: WhatsApp via N8N

## License

ISC
