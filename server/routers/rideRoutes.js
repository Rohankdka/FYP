import express from "express";
import {
  postRide,
  requestRide,
  updateRideStatus,
} from "../controllers/rideController.js";

const router = express.Router();

router.post("/ride", postRide);
router.post("/request", requestRide);
router.put("/update", updateRideStatus);

export default router;
