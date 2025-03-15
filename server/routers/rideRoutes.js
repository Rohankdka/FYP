import express from "express";
import {
  postRide,
  requestRide,
  updateRideStatus,
  getRideHistory,
  getActiveRide,
  updatePaymentStatus,
  searchDrivers,
} from "../controllers/rideController.js";

const router = express.Router();

router.post("/ride", postRide);
router.post("/request", requestRide);
router.put("/update", updateRideStatus);
router.get("/history", getRideHistory);
router.get("/active", getActiveRide);
router.put("/payment", updatePaymentStatus);
router.get("/search-drivers", searchDrivers);

export default router;
