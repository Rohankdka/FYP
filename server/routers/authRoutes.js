import express from "express";
import {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  sendPhoneOTPForVerification,
  verifyPhoneOTP,
  getMe,
} from "../controllers/authController.js";
import authToken from "../middleware/authToken.js";

const router = express.Router();

// Define routes
router.post("/register", authToken, registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/verify-email", verifyEmail); // Route for email verification
// Phone Verification Routes
router.post("/sendphoneotp", sendPhoneOTPForVerification);
router.post("/verifyphoneotp", verifyPhoneOTP);

router.get("/me", authToken, getMe);

export default router;
