# Setup Instructions for Aahaas Analytics Dashboard

## Issue Fixed ✅

**Hydration Error**: Fixed by adding `suppressHydrationWarning` to form inputs. This prevents browser extension interference from causing React hydration warnings.

---

## Test User Setup

**Test Credentials:**
- Email: `hasindutwm@gmail.com`
- Password: `20020224Ha@`

### How to Create the Test User

#### Option 1: Firebase Console (Easiest - Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (or create one)
3. Navigate to **Authentication** (left sidebar)
4. Click the **Users** tab
5. Click **Create user** button
6. Enter:
   - **Email**: `hasindutwm@gmail.com`
   - **Password**: `20020224Ha@`
7. Click **Create**

#### Option 2: Using Firebase Emulator (For Local Development)

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Start the emulator:
   ```bash
   firebase emulators:start --only auth
   ```

3. Update your `.env.local` to use the emulator:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDemoKeyForDevelopment1234567890123
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost:9099
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-project-dev
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-project-dev.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcd1234efgh5678ijkl
   ```

4. Visit [http://localhost:4000](http://localhost:4000) to manage emulator users

#### Option 3: Firebase REST API (Programmatic)

```bash
curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hasindutwm@gmail.com",
    "password": "20020224Ha@",
    "returnSecureToken": true
  }'
```

---

## Running the Project

The dev server is already running on **http://localhost:3000**

### Commands
```bash
# Development server (already running)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

---

## Environment Variables

Your `.env.local` file has been created with placeholder Firebase credentials. To use real credentials:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Get your Web App credentials
3. Update `.env.local` with your real values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## Resolving Console Errors

### 1. Browser Extension Errors (`save-page menu item`, `fdprocessedid`)

**Issue:** Extensions like Grammarly, LastPass, Form Autofill modify form elements, causing hydration warnings.

**Solutions:**

#### Option A: Use Incognito/Private Mode (Fastest)
- Open an incognito window 
- Extensions are disabled
- Visit `http://localhost:3000`
- Console errors disappear

#### Option B: Disable Extensions Temporarily
1. Click **Extensions** in your browser
2. Disable Form Autofill, Grammarly, LastPass, etc.
3. Refresh `http://localhost:3000`

#### Option C: Use Clean Browser Profile
```bash
# Chrome - create new profile
google-chrome --user-data-dir=/tmp/chrome-dev-profile

# Firefox - create new profile  
firefox -profile ~/.firefox-dev-profile
```

---

### 2. Firebase 400 Error (`identitytoolkit.googleapis.com`)

**Issue:** Demo API key is not valid. Requests to Firebase endpoints return 400 errors.

**Solutions:**

#### Option A: Get Real Firebase Credentials (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project or select existing
3. Click **Project Settings** → **Service Accounts**
4. Copy Web App credentials
5. Update `.env.local` with real values:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy_YOUR_REAL_KEY_
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123...
   ```
6. Save and restart: `npm run dev`

#### Option B: Use Firebase Emulator (Local Testing)
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Run: `firebase emulators:start --only auth`
3. Emulator UI: `http://localhost:4000`
4. Create test users directly in emulator

#### Option C: Skip Auth for UI Testing
- If you just want to test the UI, you can mock the auth service
- Create a mock login that doesn't require Firebase

---

## What's Fixed

- ✅ Hydration warning suppression (body tag)
- ✅ Form input hydration handling
- ✅ Environment variables configured
- ✅ Dev server running
- ⚠️ Browser extension errors (disable extensions or use incognito)
- ⚠️ Firebase 400 error (use real credentials or emulator)

## Next Steps

1. **Choose one:**
   - Use incognito mode to hide extension errors
   - OR disable browser extensions during development
   - OR set up Firebase Emulator

2. **Then:**
   - Get real Firebase credentials (or use emulator)
   - Create test user: `hasindutwm@gmail.com` / `20020224Ha@`
   - Login and explore the dashboard
