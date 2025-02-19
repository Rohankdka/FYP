import express from "express";
import { approveDriver,getDriverStats, getPendingDrivers } from "../controllers/adminController.js";

const router = express.Router();

router.get("/pending-driver",getPendingDrivers)
router.post("/approve-driver",approveDriver)
router.get("/driver-stats", getDriverStats); 
export default router;