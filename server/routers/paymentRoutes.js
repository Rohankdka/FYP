import express from "express";
import { 
  initializePayment,
  verifyPayment
} from "../controllers/paymentController.js";

const router = express.Router();

// Initialize payment
router.get("/initialize/:rideId", initializePayment);

// Verify payment
router.get("/verify", verifyPayment);

export default router;