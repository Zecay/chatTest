import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD7OLFKI-ip5xnyyKe7G3Q0UmeyeAFzzBs",
  authDomain: "testingforweb-5e996.firebaseapp.com",
  databaseURL: "https://testingforweb-5e996-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "testingforweb-5e996",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default async function handler(req, res) {
  const snapshot = await get(ref(db, "messages"));
  const data = snapshot.val() || {};

  res.status(200).json(data);
}
