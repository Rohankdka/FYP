import express from 'express';
import {
  savePersonalInformation,
  saveLicenseInformation,
  saveVehicleInformation,
  getAllDrivers,
  updateDriverVerification,
} from '../controllers/driverController.js';
import authToken from '../middleware/authToken.js';

const router = express.Router();

// Save Personal Information
router.post('/personalinfo',savePersonalInformation);

// Save License Information
router.post('/licenseinfo', saveLicenseInformation);

// Save Vehicle Information
router.post('/vehicleinfo', saveVehicleInformation);

router.get('/drivers', getAllDrivers); // Fetch all drivers
router.put('/drivers/:driverId/verify', updateDriverVerification); // Update verification status


export default router;