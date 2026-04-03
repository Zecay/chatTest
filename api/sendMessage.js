import { initializeApp } from "firebase/app";
import { getDatabase, ref, push } from "firebase/database";

// Your config
const firebaseConfig = {
  apiKey: "AIzaSyD7OLFKI-ip5xnyyKe7G3Q0UmeyeAFzzBs",
  authDomain: "testingforweb-5e996.firebaseapp.com",
  databaseURL: "https://testingforweb-5e996-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "testingforweb-5e996",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default async function handler(req, res) {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "No message" });
  }

  await push(ref(db, "messages"), {
    text,
    timestamp: Date.now()
  });

  res.status(200).json({ success: true });
}
