// backend/routers/driverRoutes.js
import express from "express";
import {
  savePersonalInformation,
  saveLicenseInformation,
  saveVehicleInformation,
  getAllDrivers,
  updateDriverVerification,
  getDriverById,
} from "../controllers/driverController.js";
import authToken from "../middleware/authToken.js";

const router = express.Router();

router.post("/personalinfo", savePersonalInformation);
router.post("/licenseinfo", saveLicenseInformation);
router.post("/vehicleinfo", saveVehicleInformation);
router.get("/drivers", getAllDrivers);
router.put("/drivers/:driverId/verify", updateDriverVerification);
router.get("/:id", getDriverById);

export default router;