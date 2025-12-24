# Railway Deployment Guide for Backend

## Fixed Issues ✅

1. Added `start` script to `package.json`
2. Updated server to use `process.env.PORT` (Railway assigns port automatically)
3. Created `railway.json` configuration file

## Railway Setup Steps

### 1. Configure Railway Service

In Railway dashboard for your `restaurant-chatbot` service:

1. Go to **Settings** tab
2. Under **Root Directory**, set it to: `backend`
3. Under **Start Command**, it should be: `npm start` (or leave empty, Railway will auto-detect)

### 2. Set Environment Variables

In Railway, go to **Variables** tab and add:

```
STRIPE_SECRET_KEY=your_stripe_secret_key_here

FRONTEND_URL=https://your-vercel-app.vercel.app
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

**Important**: Replace `your-vercel-app.vercel.app` with your actual Vercel deployment URL.

### 3. Get Your Backend URL

After deployment succeeds:
- Railway will give you a URL like: `https://restaurant-chatbot-production.up.railway.app`
- Copy this URL

### 4. Set Environment Variable in Vercel

1. Go to Vercel project dashboard
2. **Settings** > **Environment Variables**
3. Add:
   - Key: `REACT_APP_BACKEND_API`
   - Value: Your Railway backend URL (e.g., `https://restaurant-chatbot-production.up.railway.app`)
   - Apply to: Production, Preview, Development

### 5. Redeploy

1. In Railway: Click **Redeploy** (or push a new commit)
2. In Vercel: Click **Redeploy** after setting the environment variable

## Troubleshooting

- **Build failed**: Check that Root Directory is set to `backend`
- **Port error**: Server now uses `process.env.PORT` automatically
- **Environment variables not working**: Make sure they're set in Railway Variables tab
- **CORS errors**: Backend already has CORS enabled

## Testing

After deployment:
1. Check Railway logs to see if server started successfully
2. Test the backend URL: `https://your-backend.railway.app/create-checkout-session` (should return error without proper request, but confirms server is running)
3. Test payment flow in your Vercel app








