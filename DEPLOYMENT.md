# Deployment Guide

## Problem
The app uses `localhost:4242` for the backend API, which only works locally. For Vercel deployment, you need to:

1. **Deploy the backend** to a hosting service (Railway, Render, etc.)
2. **Set environment variables** in Vercel

## Step 1: Deploy Backend

### Option A: Deploy to Railway (Recommended)

1. Go to [Railway.app](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Add the `backend` folder as the root
5. Set environment variables in Railway:
   - `STRIPE_SECRET_KEY` = your Stripe secret key
   - `FRONTEND_URL` = your Vercel URL (e.g., `https://your-app.vercel.app`)
   - `STRIPE_WEBHOOK_SECRET` = your Stripe webhook secret (if using)
6. Railway will give you a URL like: `https://your-app.railway.app`

### Option B: Deploy to Render

1. Go to [Render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Set root directory to `backend`
5. Build command: (leave empty, Render will auto-detect)
6. Start command: `node server.js`
7. Set environment variables:
   - `STRIPE_SECRET_KEY`
   - `FRONTEND_URL`
   - `STRIPE_WEBHOOK_SECRET`
8. Render will give you a URL like: `https://your-app.onrender.com`

## Step 2: Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Go to **Settings** > **Environment Variables**
3. Add this variable:
   - **Key**: `REACT_APP_BACKEND_API`
   - **Value**: Your backend URL (from Railway/Render)
   - **Environments**: Production, Preview, Development (select all)

Example:
```
REACT_APP_BACKEND_API=https://your-app.railway.app
```

## Step 3: Redeploy

After setting environment variables:
1. Go to **Deployments** in Vercel
2. Click **Redeploy** on the latest deployment
3. Or push a new commit to trigger auto-deployment

## Step 4: Update Stripe Webhook (if using)

If you're using Stripe webhooks:
1. Go to Stripe Dashboard > Webhooks
2. Update webhook URL to: `https://your-backend-url.com/stripe-webhook`
3. Update webhook secret in your backend environment variables

## Testing

After deployment:
1. Your frontend should call: `https://your-backend-url.com/create-checkout-session`
2. Payment success will redirect to: `https://your-vercel-url.com/payment-success`
3. The backend will then save the order and send WhatsApp

## Troubleshooting

- **Network Error**: Check that `REACT_APP_BACKEND_API` is set correctly in Vercel
- **CORS Error**: Make sure your backend has CORS enabled (already done in `server.js`)
- **Payment fails**: Check backend logs in Railway/Render dashboard
- **Orders not saving**: Check backend console logs for errors





