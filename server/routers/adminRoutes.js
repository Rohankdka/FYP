import express from "express";
import { approveDriver, getPendingDrivers } from "../controllers/adminController.js";

const router = express.Router();

router.get("/pending-driver",getPendingDrivers)
router.post("/approve-driver",approveDriver)

export default router;