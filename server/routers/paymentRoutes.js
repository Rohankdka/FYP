import express from "express";
import { 
  initializePayment,
  verifyPayment
} from "../controllers/paymentController.js";

const router = express.Router();

// Initialize payment - GET with route parameter and query params
router.get("/initialize/:rideId", initializePayment);

// Verify payment - GET with query parameter
router.get("/verify", verifyPayment);

export default router;