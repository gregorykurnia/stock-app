import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwYyUm04cu0WxESOCM8SdDcYIrRY07csw",
  authDomain: "stock-app-898d1.firebaseapp.com",
  projectId: "stock-app-898d1",
  storageBucket: "stock-app-898d1.firebasestorage.app",
  messagingSenderId: "406464543804",
  appId: "1:406464543804:web:66f90eb69b877717b65739",
  measurementId: "G-Y2E2252VNT",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
