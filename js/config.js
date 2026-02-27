/* ═══════════════════════════════════════════════════════════════════
   FIREBASE CONFIGURATION
   Replace these values with your own Firebase project credentials
═══════════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyA96SI5POCsdPrgS81T5NvJVE8vdoD3xTk",
  authDomain: "to-do-app-d290a.firebaseapp.com",
  projectId: "to-do-app-d290a",
  storageBucket: "to-do-app-d290a.firebasestorage.app",
  messagingSenderId: "42708345118",
  appId: "1:42708345118:web:d541888aa3df076aa5e90f",
  measurementId: "G-HL58950DCR"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firebase services for use in app.js
const auth = firebase.auth();
const db = firebase.firestore();
