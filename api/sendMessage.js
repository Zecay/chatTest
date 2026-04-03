// sendMessage.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push } from "firebase/database";

export const config = {
  api: { bodyParser: true } // enables req.body parsing
};

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD7OLFKI-ip5xnyyKe7G3Q0UmeyeAFzzBs",
  authDomain: "testingforweb-5e996.firebaseapp.com",
  databaseURL: "https://testingforweb-5e996-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "testingforweb-5e996",
  storageBucket: "testingforweb-5e996.firebasestorage.app",
  messagingSenderId: "367983821716",
  appId: "1:367983821716:web:c2597aef60c000a1dfc581"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "No message provided" });
    }

    await push(ref(db, "messages"), { text, timestamp: Date.now() });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ error: err.message });
  }
}
