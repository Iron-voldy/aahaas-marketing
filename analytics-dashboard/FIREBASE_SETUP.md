# Firebase Setup Guide - Getting Real Credentials

## Problem
The demo Firebase API key (`AIzaSyDemoKeyForDevelopment1234567890123`) returns **400 Bad Request** errors because it's not valid.

## Solution: Get Real Firebase Credentials

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Create a project**
3. Enter project name: `aahaas-analytics` (or any name)
4. Accept terms and click **Create project**
5. Wait for project to be created (1-2 minutes)

### Step 2: Get Web App Credentials

1. In Firebase Console, click the **Web** icon (</>) to add a web app
2. Enter app name: `analytics-dashboard`
3. Click **Register app**
4. Copy the configuration object that appears

Example config looks like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy_YOUR_REAL_KEY_HERE",
  authDomain: "aahaas-analytics.firebaseapp.com",
  projectId: "aahaas-analytics",
  storageBucket: "aahaas-analytics.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456ghi789"
};
```

### Step 3: Update `.env.local`

Replace the demo values with your real Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy_YOUR_REAL_KEY_HERE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=aahaas-analytics.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=aahaas-analytics
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=aahaas-analytics.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456ghi789
```

### Step 4: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

The hydration warnings should now be suppressed, and Firebase auth will work correctly.

---

## Alternative: Use Firebase Emulator (For Local Testing Only)

If you don't want to create a Firebase project yet, you can use the Firebase Emulator Suite:

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Initialize Firebase in project:**
   ```bash
   cd analytics-dashboard
   firebase init emulators
   ```

3. **Start the emulator:**
   ```bash
   firebase emulators:start --only auth,firestore
   ```

4. **Update `.env.local` for emulator:**
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDemoKeyForDevelopment1234567890123
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost:9099
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-project-dev
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-project-dev.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcd1234efgh5678ijkl
   ```

5. **Access emulator UI:**
   - Emulator UI: `http://localhost:4000`
   - Create test users directly in the UI
   - No real Firebase project needed

---

## Your Test User

Once you have Firebase set up (real or emulator), create this test user:

- **Email:** `hasindutwm@gmail.com`
- **Password:** `20020224Ha@`

### To Create Test User in Firebase Console:
1. Go to **Authentication** → **Users** tab
2. Click **Create user**
3. Enter email and password
4. Click **Create**

### To Create Test User in Emulator:
1. Visit `http://localhost:4000` (Emulator UI)
2. Go to **Authentication** tab
3. Add user with credentials above
4. Done!

---

## Verify Setup

After updating `.env.local` and restarting `npm run dev`:

1. Open `http://localhost:3000` in your browser
2. Check browser console (F12)
3. Should see `[HMR] connected` (good!)
4. Should **NOT** see Firebase 400 errors
5. Should **NOT** see hydration warnings

If you still see hydration warnings:
- Use **Incognito Mode** to disable browser extensions
- Or disable extensions manually (Grammarly, LastPass, etc.)

---

## Quick Reference

| Issue | Cause | Fix |
|-------|-------|-----|
| `API key not valid` | Demo key not real | Get real Firebase credentials |
| Hydration warnings | Browser extensions | Incognito mode OR `suppressHydrationWarning` |
| Firebase 400 error | Invalid API key | Update `.env.local` with real key |

