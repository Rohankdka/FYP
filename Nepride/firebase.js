import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBTGV2du70jBmzbnNTcWc86X0HxZ66CGu4",
  authDomain: "nepride-6ac3f.firebaseapp.com",
  projectId: "nepride-6ac3f",
  storageBucket: "nepride-6ac3f.appspot.com",
  messagingSenderId: "596092025575",
  appId: "1:596092025575:web:bd92e73fdd30fad45f0042",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth, RecaptchaVerifier };