// controllers/rideController.js
import Ride from "../models/rideModel.js";

// Post a ride (Driver)
export const postRide = async (req, res) => {
  const { driverId, pickupLocation, dropoffLocation } = req.body;

  try {
    const ride = await Ride.create({
      driverId,
      pickupLocation,
      dropoffLocation,
      status: "available",
    });
    res.status(201).json(ride);
  } catch (error) {
    res.status(500).json({ message: "Failed to post ride", error: error.message });
  }
};

// Request a ride (Passenger)
export const requestRide = async (req, res) => {
  const { passengerId, rideId } = req.body;

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    ride.passengerId = passengerId;
    ride.status = "requested";
    await ride.save();

    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ message: "Failed to request ride", error: error.message });
  }
};

// Update ride status (Driver)
export const updateRideStatus = async (req, res) => {
  const { rideId, status } = req.body;

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    ride.status = status;
    await ride.save();

    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ message: "Failed to update ride status", error: error.message });
  }
};