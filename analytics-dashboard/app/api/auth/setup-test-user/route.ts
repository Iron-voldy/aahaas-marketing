import { NextResponse } from "next/server";

/**
 * This endpoint helps set up a test user in Firebase.
 * 
 * NOTE: This requires Firebase Admin SDK to be configured.
 * For now, this documents the test user credentials.
 * 
 * Test User Credentials:
 * - Email: hasindutwm@gmail.com
 * - Password: 20020224Ha@
 * 
 * To add this user to your Firebase project:
 * 
 * Option 1: Manual Setup (Firebase Console)
 * 1. Go to Firebase Console > Authentication > Users
 * 2. Click "Add User"
 * 3. Enter email: hasindutwm@gmail.com
 * 4. Enter password: 20020224Ha@
 * 5. Click "Create"
 * 
 * Option 2: Using Firebase CLI
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login: firebase login
 * 3. Use firebase emulator (development only)
 * 
 * Option 3: Using REST API (Production)
 * Use the Firebase REST API to create users programmatically.
 */

export async function POST(request: Request) {
  const testUser = {
    email: "hasindutwm@gmail.com",
    password: "20020224Ha@",
    displayName: "Test User",
    description: "Test user for development and testing"
  };

  return NextResponse.json({
    success: true,
    message: "Test user credentials configured",
    testUser: {
      email: testUser.email,
      password: testUser.password,
      displayName: testUser.displayName
    },
    instructions: [
      "1. Go to Firebase Console: https://console.firebase.google.com",
      "2. Select your project",
      "3. Navigate to Authentication > Users",
      "4. Click 'Create user' button",
      "5. Enter email: hasindutwm@gmail.com",
      "6. Enter password: 20020224Ha@",
      "7. Click 'Create'"
    ]
  });
}

export async function GET(request: Request) {
  return NextResponse.json({
    testUserEmail: "hasindutwm@gmail.com",
    testUserPassword: "20020224Ha@",
    note: "Please create this user in your Firebase Console",
    consoleUrl: "https://console.firebase.google.com"
  });
}
