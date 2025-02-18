// controllers/adminController.js
import DriverModel from "../models/DriverModel.js";
import asyncHandler from "express-async-handler";

// Approve or reject a driver
export const approveDriver = asyncHandler(async (req, res) => {
  const { driverId, status } = req.body;

  if (!driverId || !["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const driver = await DriverModel.findById(driverId);
  if (!driver) {
    return res.status(404).json({ message: "Driver not found" });
  }

  driver.status = status;
  await driver.save();

  res.status(200).json({ message: `Driver ${status} successfully` });
});

// Get all pending drivers
export const getPendingDrivers = asyncHandler(async (req, res) => {
  const pendingDrivers = await DriverModel.find({ status: "pending" });
  res.status(200).json(pendingDrivers);
});