// controllers/rideController.js
import Ride from "../models/rideModel.js";
import DriverModel from "../models/DriverModel.js";

// Calculate fare based on distance and vehicle type
const calculateFare = (distance, vehicleType) => {
  let baseFare = 0;
  let ratePerKm = 0;

  switch (vehicleType) {
    case "Bike":
      baseFare = 50; // NPR
      ratePerKm = 15;
      break;
    case "Car":
      baseFare = 100;
      ratePerKm = 30;
      break;
    case "Electric":
      baseFare = 80;
      ratePerKm = 25;
      break;
    default:
      baseFare = 50;
      ratePerKm = 15;
  }

  return Math.round(baseFare + distance * ratePerKm);
};

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
    res
      .status(500)
      .json({ message: "Failed to post ride", error: error.message });
  }
};

// Request a ride (Passenger)
export const requestRide = async (req, res) => {
  const {
    passengerId,
    pickupLocation,
    dropoffLocation,
    pickupLocationName,
    dropoffLocationName,
    vehicleType,
    distance,
    estimatedTime,
    paymentMethod = "cash",
  } = req.body;

  try {
    // Calculate fare
    const fare = calculateFare(distance, vehicleType);

    const ride = await Ride.create({
      passengerId,
      pickupLocation,
      dropoffLocation,
      pickupLocationName,
      dropoffLocationName,
      vehicleType,
      distance,
      estimatedTime,
      fare,
      paymentMethod,
      status: "requested",
    });

    res.status(201).json(ride);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to request ride", error: error.message });
  }
};

// Update ride status (Driver)
export const updateRideStatus = async (req, res) => {
  const { rideId, status, fare } = req.body;

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    ride.status = status;

    // Update fare if provided
    if (fare) {
      ride.fare = fare;
    }

    // If status is completed, calculate final fare if not already set
    if (status === "completed" && !ride.fare) {
      ride.fare = calculateFare(ride.distance, ride.vehicleType);
    }

    await ride.save();

    res.status(200).json(ride);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update ride status", error: error.message });
  }
};

// Get ride history for a user
export const getRideHistory = async (req, res) => {
  const { userId, userType } = req.query;

  try {
    let rides;

    if (userType === "passenger") {
      rides = await Ride.find({ passengerId: userId })
        .sort({ createdAt: -1 })
        .populate("driverId", "fullName vehicleType numberPlate");
    } else if (userType === "driver") {
      rides = await Ride.find({ driverId: userId })
        .sort({ createdAt: -1 })
        .populate("passengerId", "username phone");
    } else {
      return res.status(400).json({ message: "Invalid user type" });
    }

    res.status(200).json(rides);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch ride history", error: error.message });
  }
};

// Get active ride for a user
export const getActiveRide = async (req, res) => {
  const { userId, userType } = req.query;

  try {
    let activeRide;

    if (userType === "passenger") {
      activeRide = await Ride.findOne({
        passengerId: userId,
        status: { $in: ["requested", "accepted", "picked up"] },
      }).populate("driverId", "fullName vehicleType numberPlate");
    } else if (userType === "driver") {
      activeRide = await Ride.findOne({
        driverId: userId,
        status: { $in: ["accepted", "picked up"] },
      }).populate("passengerId", "username phone");
    } else {
      return res.status(400).json({ message: "Invalid user type" });
    }

    if (!activeRide) {
      return res.status(404).json({ message: "No active ride found" });
    }

    res.status(200).json(activeRide);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch active ride", error: error.message });
  }
};

// Update payment status
export const updatePaymentStatus = async (req, res) => {
  const { rideId, paymentStatus, paymentMethod } = req.body;

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    ride.paymentStatus = paymentStatus;
    if (paymentMethod) {
      ride.paymentMethod = paymentMethod;
    }

    await ride.save();

    res.status(200).json(ride);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Failed to update payment status",
        error: error.message,
      });
  }
};

// Search for available drivers
export const searchDrivers = async (req, res) => {
  const { vehicleType, latitude, longitude, radius = 5 } = req.query; // radius in km

  try {
    // Find drivers with the requested vehicle type
    const drivers = await DriverModel.find({
      vehicleType,
      // We would ideally add a geospatial query here to find nearby drivers
      // This would require adding location fields to the driver model with geospatial indexes
    }).populate("user", "username phone");

    res.status(200).json(drivers);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to search for drivers", error: error.message });
  }
};
