// Paste your Firebase web app config (Project settings → Your apps → Web app).
// These values are public identifiers, not secrets. Security comes from Firestore rules + Cloud Functions.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA0ZLr-BGQTrMwE6BBo4nfvZxUz2JCQnK0",
    authDomain: "ict-club-aebfe.firebaseapp.com",
    projectId: "ict-club-aebfe",
    storageBucket: "ict-club-aebfe.firebasestorage.app",
    messagingSenderId: "863060890952",
    appId: "1:863060890952:web:263f782ce7b29484378f7d"
  };

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
