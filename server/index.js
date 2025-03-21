import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routers/authRoutes.js";
import userRoutes from "./routers/userRoutes.js";
import driverRoutes from "./routers/driverRoutes.js";
import adminRoutes from "./routers/adminRoutes.js";
import rideRoutes from "./routers/rideRoutes.js";
import Trip from "./routers/tripRoutes.js";
import { Server } from "socket.io";
import http from "http";
import Ride from "./models/rideModel.js";
import NeprideModel from "./models/NeprideModel.js";
import DriverModel from "./models/DriverModel.js";
import notificationRoutes from "./routers/notificationRoutes.js";
import Notification from "./models/notificationModel.js";
import paymentRoutes from "./routers/paymentRoutes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
  pingTimeout: 60000, // Increase ping timeout to prevent frequent disconnects
});

// Track connected clients and their status
const connectedClients = new Map();
const driverStatus = new Map(); // Store driver online status

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

// Create a notification and emit it via socket
const createAndEmitNotification = async (
  userId,
  title,
  message,
  type,
  relatedId = null
) => {
  try {
    console.log(`Creating notification for user ${userId}: ${title}`);

    // Handle null or undefined userId
    if (!userId) {
      console.error("No user ID provided for notification creation");
      return null;
    }

    // Ensure userId is a string
    const userIdStr =
      typeof userId === "object"
        ? userId._id
          ? userId._id.toString()
          : String(userId)
        : String(userId);

    // Validate that userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
      console.error(
        "Invalid ObjectId format for notification creation:",
        userIdStr
      );
      return null;
    }

    const notification = await Notification.create({
      userId: userIdStr,
      title,
      message,
      type,
      relatedId,
      read: false,
    });

    console.log("Notification created:", notification);

    // Emit to the user's room
    io.to(`user-${userIdStr}`).emit("new-notification", notification);

    // Update notification count
    const count = await Notification.countDocuments({
      userId: userIdStr,
      read: false,
    });

    io.to(`user-${userIdStr}`).emit("notifications-count", { count });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

io.on("connection", (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);
  connectedClients.set(socket.id, { userId: null, userType: null });

  // Join user's notification room - FIXED: removed duplicate handler
  socket.on("join-user", (userId) => {
    if (!userId) {
      console.error("No user ID provided for joining room");
      return;
    }

    // Ensure userId is a string
    const userIdStr =
      typeof userId === "object"
        ? userId._id
          ? userId._id.toString()
          : String(userId)
        : String(userId);

    console.log(`User ${userIdStr} joining room: user-${userIdStr}`);
    socket.join(`user-${userIdStr}`);
  });

  // Join passenger room
  socket.on("join", (room) => {
    console.log(`Socket ${socket.id} joining room: ${room}`);
    socket.join(room);
    console.log(`Socket ${socket.id} successfully joined room: ${room}`);
  });

  socket.on("driver-online", async (driverId) => {
    // Handle null or undefined driverId
    if (!driverId) {
      console.error("No driver ID provided for online status");
      return;
    }

    // Ensure driverId is a string
    const driverIdStr =
      typeof driverId === "object"
        ? driverId._id
          ? driverId._id.toString()
          : String(driverId)
        : String(driverId);

    // Store the driver ID with this socket
    connectedClients.set(socket.id, {
      userId: driverIdStr,
      userType: "driver",
    });

    // Join user's notification room
    socket.join(`user-${driverIdStr}`);

    // Only emit if status is changing from offline to online
    if (!driverStatus.get(driverIdStr)) {
      console.log(
        `✅ Driver ${driverIdStr} is online and joined room driver-${driverIdStr}`
      );
      socket.join(`driver-${driverIdStr}`);
      driverStatus.set(driverIdStr, true);

      try {
        // Get driver details including vehicle type
        const driver = await DriverModel.findOne({ user: driverIdStr });
        if (driver) {
          // Update driver status in database
          await DriverModel.findOneAndUpdate(
            { user: driverIdStr },
            { isOnline: true }
          );

          io.emit("driver-available", {
            driverId: driverIdStr,
            status: "online",
            vehicleType: driver.vehicleType,
            location: driver.currentLocation || null,
          });
        }
      } catch (error) {
        console.error("Error fetching driver details:", error);
      }
    } else {
      // Driver is already online, just join the room
      socket.join(`driver-${driverIdStr}`);
    }
  });

  socket.on("driver-offline", async (driverId) => {
    // Handle null or undefined driverId
    if (!driverId) {
      console.error("No driver ID provided for offline status");
      return;
    }

    // Ensure driverId is a string
    const driverIdStr =
      typeof driverId === "object"
        ? driverId._id
          ? driverId._id.toString()
          : String(driverId)
        : String(driverId);

    // Only emit if status is changing from online to offline
    if (driverStatus.get(driverIdStr)) {
      console.log(`🚫 Driver ${driverIdStr} is offline`);
      socket.leave(`driver-${driverIdStr}`);
      driverStatus.set(driverIdStr, false);

      try {
        // Update driver status in database
        await DriverModel.findOneAndUpdate(
          { user: driverIdStr },
          { isOnline: false }
        );
      } catch (error) {
        console.error("Error updating driver status:", error);
      }

      io.emit("driver-available", { driverId: driverIdStr, status: "offline" });
    }
  });

  socket.on("driver-location-update", async (data) => {
    try {
      const { driverId, location } = data;

      // Handle null or undefined driverId
      if (!driverId) {
        console.error("No driver ID provided for location update");
        return;
      }

      // Ensure driverId is a string
      const driverIdStr =
        typeof driverId === "object"
          ? driverId._id
            ? driverId._id.toString()
            : String(driverId)
          : String(driverId);

      // Only process if driver is online
      if (driverStatus.get(driverIdStr)) {
        // Update driver location in database
        await DriverModel.findOneAndUpdate(
          { user: driverIdStr },
          { currentLocation: location }
        );

        // Emit to all clients that might be interested
        io.emit("driver-location-changed", { driverId: driverIdStr, location });

        // If driver has an active ride, send location update to the passenger
        const activeRide = await Ride.findOne({
          driverId: driverIdStr,
          status: { $in: ["accepted", "picked up"] },
        });

        if (activeRide) {
          // Ensure passengerId is a string
          const passengerIdStr =
            typeof activeRide.passengerId === "object"
              ? activeRide.passengerId._id
                ? activeRide.passengerId._id.toString()
                : String(activeRide.passengerId)
              : String(activeRide.passengerId);

          io.to(`passenger-${passengerIdStr}`).emit("driver-location-update", {
            rideId: activeRide._id,
            location,
          });
        }
      }
    } catch (error) {
      console.error("Error updating driver location:", error);
    }
  });

  socket.on("search-drivers", async (data) => {
    try {
      const { vehicleType, pickupLocation } = data;

      // Find online drivers with the requested vehicle type
      const drivers = await DriverModel.find({
        vehicleType,
        isOnline: true,
      }).populate("user", "username phone");

      socket.emit("search-results", { drivers });
    } catch (error) {
      console.error("Error searching for drivers:", error);
    }
  });

  socket.on("request-ride", async (data) => {
    try {
      // Handle null or undefined passengerId
      if (!data.passengerId) {
        console.error("No passenger ID provided for ride request");
        socket.emit("ride-notification", {
          message: "Invalid passenger ID",
        });
        return;
      }

      // Ensure passengerId is a string
      const passengerIdStr =
        typeof data.passengerId === "object"
          ? data.passengerId._id
            ? data.passengerId._id.toString()
            : String(data.passengerId)
          : String(data.passengerId);

      // Calculate fare based on distance and vehicle type
      const fare = calculateFare(data.distance, data.vehicleType);

      const ride = await Ride.create({
        passengerId: passengerIdStr,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        pickupLocationName: data.pickupLocationName,
        dropoffLocationName: data.dropoffLocationName,
        status: "requested",
        distance: data.distance,
        estimatedTime: data.estimatedTime,
        vehicleType: data.vehicleType,
        paymentMethod: data.paymentMethod || "cash",
        fare,
      });

      const passenger = await NeprideModel.findById(passengerIdStr).select(
        "phone username"
      );
      const rideWithPassenger = {
        ...ride._doc,
        passenger: { phone: passenger.phone, username: passenger.username },
        fare,
      };

      // Store the passenger ID with this socket
      connectedClients.set(socket.id, {
        userId: passengerIdStr,
        userType: "passenger",
      });

      // If a specific driver is requested, emit only to that driver
      if (data.specificDriverId) {
        // Ensure specificDriverId is a string
        const specificDriverIdStr =
          typeof data.specificDriverId === "object"
            ? data.specificDriverId._id
              ? data.specificDriverId._id.toString()
              : String(data.specificDriverId)
            : String(data.specificDriverId);

        io.to(`driver-${specificDriverIdStr}`).emit(
          "ride-request",
          rideWithPassenger
        );

        // Create notification for the specific driver
        await createAndEmitNotification(
          specificDriverIdStr,
          "New Ride Request",
          `${passenger.username} is requesting a ride from ${data.pickupLocationName} to ${data.dropoffLocationName}`,
          "ride_request",
          ride._id
        );
      } else {
        // Otherwise, emit to all online drivers with the matching vehicle type
        const onlineDrivers = Array.from(driverStatus.entries())
          .filter(([_, isOnline]) => isOnline)
          .map(([driverId]) => driverId);

        for (const driverId of onlineDrivers) {
          const driver = await DriverModel.findOne({ user: driverId });
          if (driver && driver.vehicleType === data.vehicleType) {
            io.to(`driver-${driverId}`).emit("ride-request", rideWithPassenger);

            // Create notification for each eligible driver
            await createAndEmitNotification(
              driverId,
              "New Ride Request",
              `${passenger.username} is requesting a ride from ${ride.pickupLocationName} to ${ride.dropoffLocationName}`,
              "ride_request",
              ride._id
            );
          }
        }
      }

      socket.emit("ride-notification", {
        message: "Ride request sent to nearby drivers",
      });
    } catch (error) {
      console.error("❌ Error saving ride:", error);
    }
  });

  socket.on("ride-response", async (data) => {
    try {
      console.log(
        `Ride response received: rideId=${data.rideId}, driverId=${data.driverId}, status=${data.status}`
      );

      // Handle null or undefined rideId or driverId
      if (!data.rideId || !data.driverId) {
        console.error("Missing ride ID or driver ID for ride response");
        return;
      }

      // Ensure driverId is a string
      const driverIdStr =
        typeof data.driverId === "object"
          ? data.driverId._id
            ? data.driverId._id.toString()
            : String(data.driverId)
          : String(data.driverId);

      const ride = await Ride.findById(data.rideId);
      if (!ride) {
        console.error(`Ride ${data.rideId} not found`);
        return;
      }

      // Check if ride is already accepted by another driver
      if (ride.status !== "requested" && data.status === "accepted") {
        socket.emit("ride-notification", {
          message: "This ride has already been accepted by another driver",
        });
        return;
      }

      const driver = await DriverModel.findOne({ user: driverIdStr });
      if (!driver) {
        console.error(`Driver ${driverIdStr} not found in drivers collection`);
      } else {
        console.log(`Driver ${driverIdStr} found: ${driver.fullName}`);
      }

      ride.driverId = driverIdStr;
      ride.status = data.status;
      await ride.save();

      // Ensure passengerId is a string
      const passengerIdStr =
        typeof ride.passengerId === "object"
          ? ride.passengerId._id
            ? ride.passengerId._id.toString()
            : String(ride.passengerId)
          : String(ride.passengerId);

      // Get passenger details for notification
      const passenger = await NeprideModel.findById(passengerIdStr);

      io.to(`passenger-${passengerIdStr}`).emit("ride-status", {
        rideId: ride._id,
        status: ride.status,
        driverId: driverIdStr,
        driverInfo: driver
          ? {
              fullName: driver.fullName,
              vehicleType: driver.vehicleType,
              numberPlate: driver.numberPlate,
            }
          : null,
      });

      io.to(`driver-${driverIdStr}`).emit("ride-notification", {
        message: `Ride ${data.status}`,
      });

      // Create notifications
      if (data.status === "accepted") {
        // Notify passenger that their ride was accepted
        await createAndEmitNotification(
          passengerIdStr,
          "Ride Accepted",
          `Your ride has been accepted by ${driver.fullName}. They will arrive shortly.`,
          "ride_accepted",
          ride._id
        );
      } else if (data.status === "rejected") {
        // Only re-emit to other drivers if the ride is still in requested state
        const updatedRide = await Ride.findById(data.rideId);
        if (updatedRide && updatedRide.status === "requested") {
          // Get all online drivers except the one who rejected
          const onlineDrivers = Array.from(driverStatus.entries())
            .filter(
              ([driverId, isOnline]) => isOnline && driverId !== driverIdStr
            )
            .map(([driverId]) => driverId);

          for (const driverId of onlineDrivers) {
            const driver = await DriverModel.findOne({ user: driverId });
            if (driver && driver.vehicleType === updatedRide.vehicleType) {
              io.to(`driver-${driverId}`).emit("ride-request", {
                ...updatedRide._doc,
                passenger: {
                  username: passenger.username,
                  phone: passenger.phone,
                },
              });

              // Create notification for each eligible driver
              await createAndEmitNotification(
                driverId,
                "New Ride Request",
                `${passenger.username} is requesting a ride from ${ride.pickupLocationName} to ${ride.dropoffLocationName}`,
                "ride_request",
                ride._id
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ Error updating ride:", error);
    }
  });

  socket.on("ride-status-update", async (data) => {
    try {
      console.log(`Received ride status update: ${JSON.stringify(data)}`);

      // Handle null or undefined rideId
      if (!data.rideId) {
        console.error("No ride ID provided for status update");
        return;
      }

      const ride = await Ride.findById(data.rideId);
      if (!ride) {
        console.error(`Ride not found: ${data.rideId}`);
        return;
      }

      const previousStatus = ride.status;
      ride.status = data.status;

      // If ride is completed, calculate final fare
      if (data.status === "completed") {
        // Use provided fare or calculate it
        ride.fare = data.fare || calculateFare(ride.distance, ride.vehicleType);
        ride.paymentStatus = "pending"; // Set payment status to pending
      }

      await ride.save();
      console.log(`Updated ride ${ride._id} status to ${ride.status}`);

      // Ensure passengerId and driverId are strings
      const passengerIdStr =
        typeof ride.passengerId === "object"
          ? ride.passengerId._id
            ? ride.passengerId._id.toString()
            : String(ride.passengerId)
          : String(ride.passengerId);

      const driverIdStr =
        typeof ride.driverId === "object"
          ? ride.driverId._id
            ? ride.driverId._id.toString()
            : String(ride.driverId)
          : String(ride.driverId);

      // Get passenger and driver details for notifications
      const passenger = await NeprideModel.findById(passengerIdStr);
      const driver = await DriverModel.findOne({ user: driverIdStr });

      // Make sure to emit to the correct passenger room
      io.to(`passenger-${passengerIdStr}`).emit("ride-status", {
        rideId: ride._id,
        status: ride.status,
        fare: ride.fare,
        driverId: driverIdStr,
        paymentStatus: ride.paymentStatus,
      });
      console.log(`Emitted ride status to passenger-${passengerIdStr}`);

      // Also emit to the driver
      io.to(`driver-${driverIdStr}`).emit("ride-status", {
        rideId: ride._id,
        status: ride.status,
        paymentStatus: ride.paymentStatus,
      });
      console.log(`Emitted ride status to driver-${driverIdStr}`);

      // Send notification to driver
      io.to(`driver-${driverIdStr}`).emit("ride-notification", {
        message: `Ride status updated to ${data.status}`,
      });

      // Create notifications based on status change
      if (data.status === "picked up" && previousStatus !== "picked up") {
        // Notify passenger that driver has picked them up
        await createAndEmitNotification(
          passengerIdStr,
          "Ride Started",
          `Your ride with ${driver.fullName} has started.`,
          "ride_started",
          ride._id
        );
      } else if (
        data.status === "completed" &&
        previousStatus !== "completed"
      ) {
        // Notify both passenger and driver that the ride is completed
        io.to(`passenger-${passengerIdStr}`).emit("ride-completed", {
          rideId: ride._id,
          message: "Ride completed. Thank you for using our service!",
          fare: ride.fare,
        });
        console.log(`Emitted ride-completed to passenger-${passengerIdStr}`);

        await createAndEmitNotification(
          passengerIdStr,
          "Ride Completed",
          `Your ride has been completed. Total fare: NPR ${ride.fare}. Please complete payment.`,
          "ride_completed",
          ride._id
        );

        io.to(`driver-${driverIdStr}`).emit("ride-completed", {
          rideId: ride._id,
          message: "Ride completed. You are now available for new rides.",
          fare: ride.fare,
        });

        await createAndEmitNotification(
          driverIdStr,
          "Ride Completed",
          `Your ride with ${passenger.username} has been completed. Awaiting payment.`,
          "ride_completed",
          ride._id
        );
      } else if (data.status === "canceled" && previousStatus !== "canceled") {
        // Notify both passenger and driver that the ride is canceled
        io.to(`passenger-${passengerIdStr}`).emit("ride-notification", {
          message: "Your ride has been canceled.",
        });

        await createAndEmitNotification(
          passengerIdStr,
          "Ride Canceled",
          `Your ride has been canceled.`,
          "ride_canceled",
          ride._id
        );

        io.to(`driver-${driverIdStr}`).emit("ride-notification", {
          message: "The ride has been canceled.",
        });

        await createAndEmitNotification(
          driverIdStr,
          "Ride Canceled",
          `The ride with ${passenger.username} has been canceled.`,
          "ride_canceled",
          ride._id
        );
      }
    } catch (error) {
      console.error("❌ Error updating ride status:", error);
    }
  });

  // Modify the payment-completed event handler to ensure both passenger and driver dashboards are reset
  socket.on("payment-completed", async (data) => {
    try {
      console.log(`Payment completed: ${JSON.stringify(data)}`);

      // Handle null or undefined rideId
      if (!data.rideId) {
        console.error("No ride ID provided for payment completion");
        return;
      }

      const { rideId, paymentMethod, passengerId, fare } = data;
      const ride = await Ride.findById(rideId);
      if (!ride) {
        console.error(`Ride not found: ${rideId}`);
        return;
      }

      // Update ride payment status in database
      ride.paymentStatus = "completed";
      ride.paymentMethod = paymentMethod || ride.paymentMethod || "cash";
      await ride.save();
      console.log(`Updated ride ${ride._id} payment status to completed`);

      // Ensure passengerId and driverId are strings
      const passengerIdStr =
        typeof (ride.passengerId || passengerId) === "object"
          ? (ride.passengerId || passengerId)._id
            ? (ride.passengerId || passengerId)._id.toString()
            : String(ride.passengerId || passengerId)
          : String(ride.passengerId || passengerId);

      const driverIdStr =
        typeof ride.driverId === "object"
          ? ride.driverId._id
            ? ride.driverId._id.toString()
            : String(ride.driverId)
          : String(ride.driverId);

      // Get passenger details for notification
      const passenger = await NeprideModel.findById(passengerIdStr);

      // Create a notification for the driver
      const driverNotification = await createAndEmitNotification(
        driverIdStr,
        "Payment Received",
        `Payment of NPR ${ride.fare} received from ${
          passenger ? passenger.username : "passenger"
        } via ${ride.paymentMethod}.`,
        "payment_received",
        ride._id
      );

      console.log("Driver notification created:", driverNotification);

      // Create a notification for the passenger
      const passengerNotification = await createAndEmitNotification(
        passengerIdStr,
        "Payment Completed",
        `Your payment of NPR ${ride.fare} for the ride has been processed successfully.`,
        "payment_completed",
        ride._id
      );

      console.log("Passenger notification created:", passengerNotification);

      // Make sure to emit to the correct driver room
      io.to(`driver-${driverIdStr}`).emit("payment-received", {
        rideId: ride._id,
        message: `Payment received for the ride via ${ride.paymentMethod}.`,
        paymentStatus: "completed",
        paymentMethod: ride.paymentMethod,
        resetDashboard: true, // Add flag to indicate dashboard should be reset
      });
      console.log(`Emitted payment-received to driver-${driverIdStr}`);

      // Also emit to the driver's user room to ensure notification is received
      io.to(`user-${driverIdStr}`).emit("payment-received", {
        rideId: ride._id,
        message: `Payment received for the ride via ${ride.paymentMethod}.`,
        paymentStatus: "completed",
        paymentMethod: ride.paymentMethod,
        resetDashboard: true, // Add flag to indicate dashboard should be reset
      });

      // Emit a ride status update to ensure UI is refreshed
      io.to(`driver-${driverIdStr}`).emit("ride-status", {
        rideId: ride._id,
        status: "completed",
        paymentStatus: "completed",
      });

      // Send confirmation to passenger
      io.to(`passenger-${passengerIdStr}`).emit("payment-confirmation", {
        rideId: ride._id,
        status: "completed",
        message: `Your payment of NPR ${ride.fare} via ${ride.paymentMethod} has been confirmed.`,
        resetDashboard: true, // Add flag to indicate dashboard should be reset
      });

      // Also emit to passenger's user room
      io.to(`user-${passengerIdStr}`).emit("payment-confirmation", {
        rideId: ride._id,
        status: "completed",
        message: `Your payment of NPR ${ride.fare} via ${ride.paymentMethod} has been confirmed.`,
        resetDashboard: true, // Add flag to indicate dashboard should be reset
      });
    } catch (error) {
      console.error("Error processing payment:", error);
    }
  });

  socket.on("get-ride-history", async (data) => {
    try {
      const { userId, userType } = data;

      // Handle null or undefined userId
      if (!userId) {
        console.error("No user ID provided for ride history");
        socket.emit("ride-history", { rides: [] });
        return;
      }

      // Ensure userId is a string
      const userIdStr =
        typeof userId === "object"
          ? userId._id
            ? userId._id.toString()
            : String(userId)
          : String(userId);

      let rides;

      if (userType === "passenger") {
        rides = await Ride.find({ passengerId: userIdStr })
          .sort({ createdAt: -1 })
          .populate("driverId", "fullName vehicleType numberPlate");
      } else if (userType === "driver") {
        rides = await Ride.find({ driverId: userIdStr })
          .sort({ createdAt: -1 })
          .populate("passengerId", "username phone");
      }

      socket.emit("ride-history", { rides });
    } catch (error) {
      console.error("Error fetching ride history:", error);
    }
  });

  // Enhance the reconnect-to-active-ride event handler to include passenger details
  socket.on("reconnect-to-active-ride", async (data) => {
    try {
      const { userId, userType } = data;

      // Handle null or undefined userId
      if (!userId) {
        console.error("No user ID provided for reconnecting to active ride");
        return;
      }

      // Ensure userId is a string
      const userIdStr =
        typeof userId === "object"
          ? userId._id
            ? userId._id.toString()
            : String(userId)
          : String(userId);

      let activeRide;

      if (userType === "passenger") {
        activeRide = await Ride.findOne({
          passengerId: userIdStr,
          status: { $in: ["requested", "accepted", "picked up"] },
        }).populate("driverId", "fullName vehicleType numberPlate");

        if (activeRide && activeRide.driverId) {
          socket.emit("active-ride-found", {
            ride: activeRide,
            driverInfo: {
              fullName: activeRide.driverId.fullName,
              vehicleType: activeRide.driverId.vehicleType,
              numberPlate: activeRide.driverId.numberPlate,
            },
          });
        }
      } else if (userType === "driver") {
        activeRide = await Ride.findOne({
          driverId: userIdStr,
          status: { $in: ["accepted", "picked up"] },
        });

        // Populate passenger info
        if (activeRide) {
          try {
            // Ensure passengerId is a string
            const passengerIdStr =
              typeof activeRide.passengerId === "object"
                ? activeRide.passengerId._id
                  ? activeRide.passengerId._id.toString()
                  : String(activeRide.passengerId)
                : String(activeRide.passengerId);

            const passenger = await NeprideModel.findById(
              passengerIdStr
            ).select("phone username");

            // Add passenger info to the ride object
            const rideWithPassenger = {
              ...activeRide._doc,
              passenger: passenger
                ? {
                    phone: passenger.phone,
                    username: passenger.username,
                  }
                : { phone: "N/A", username: "Unknown" }, // Provide default values
            };

            socket.emit("active-ride-found", {
              ride: rideWithPassenger,
            });
          } catch (passengerError) {
            console.error("Error fetching passenger info:", passengerError);
            // Still send the ride info even if passenger info fails
            socket.emit("active-ride-found", {
              ride: {
                ...activeRide._doc,
                passenger: { phone: "N/A", username: "Unknown" },
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("Error reconnecting to active ride:", error);
      socket.emit("error", { message: "Failed to reconnect to active ride" });
    }
  });

  // Get unread notifications count
  socket.on("get-notifications-count", async (userId) => {
    try {
      console.log("Getting notification count for user:", userId);

      // Handle null or undefined userId
      if (!userId) {
        console.error("No user ID provided for notification count");
        socket.emit("notifications-count", { count: 0 });
        return;
      }

      // Ensure userId is a string
      const userIdStr =
        typeof userId === "object"
          ? userId._id
            ? userId._id.toString()
            : String(userId)
          : String(userId);

      // Validate that userId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
        console.error(
          "Invalid ObjectId format for notification count:",
          userIdStr
        );
        socket.emit("notifications-count", { count: 0 });
        return;
      }

      const count = await Notification.countDocuments({
        userId: userIdStr,
        read: false,
      });

      console.log(`Found ${count} unread notifications for user ${userIdStr}`);
      socket.emit("notifications-count", { count });
    } catch (error) {
      console.error("Error getting notification count:", error);
      socket.emit("notifications-count", { count: 0 });
    }
  });

  // Get user notifications
  socket.on("get-notifications", async (userId) => {
    try {
      // Handle null or undefined userId
      if (!userId) {
        console.error("No user ID provided for getting notifications");
        socket.emit("notifications", { notifications: [] });
        return;
      }

      // Ensure userId is a string
      const userIdStr =
        typeof userId === "object"
          ? userId._id
            ? userId._id.toString()
            : String(userId)
          : String(userId);

      // Validate that userId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
        console.error(
          "Invalid ObjectId format for getting notifications:",
          userIdStr
        );
        socket.emit("notifications", { notifications: [] });
        return;
      }

      const notifications = await Notification.find({ userId: userIdStr })
        .sort({ createdAt: -1 })
        .limit(50);
      socket.emit("notifications", { notifications });
    } catch (error) {
      console.error("Error getting notifications:", error);
      socket.emit("notifications", { notifications: [] });
    }
  });

  socket.on("disconnect", () => {
    console.log(`⚠️ A user disconnected: ${socket.id}`);

    // Check if this was a driver socket
    const clientInfo = connectedClients.get(socket.id);
    if (clientInfo && clientInfo.userType === "driver") {
      // Don't immediately set driver offline - they might be reconnecting
      // Instead, set a timeout to mark them offline if they don't reconnect
      setTimeout(async () => {
        // Check if driver has reconnected with a different socket
        const isReconnected = Array.from(connectedClients.values()).some(
          (info) =>
            info.userId === clientInfo.userId && info.userType === "driver"
        );

        if (!isReconnected && driverStatus.get(clientInfo.userId)) {
          console.log(
            `🚫 Driver ${clientInfo.userId} is offline (disconnected)`
          );
          driverStatus.set(clientInfo.userId, false);

          try {
            // Update driver status in database
            await DriverModel.findOneAndUpdate(
              { user: clientInfo.userId },
              { isOnline: false }
            );
          } catch (error) {
            console.error("Error updating driver status:", error);
          }

          io.emit("driver-available", {
            driverId: clientInfo.userId,
            status: "offline",
          });
        }
      }, 5000); // 5 second grace period for reconnection
    }

    // Remove from connected clients
    connectedClients.delete(socket.id);
  });
});

app.use("/uploads", express.static("uploads"));
app.use(express.json());
app.use(cors({ origin: "*", credentials: true }));

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((error) => {
    console.error("❌ Error connecting to MongoDB:", error.message);
    process.exit(1);
  });

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/driver", driverRoutes);
app.use("/admin", adminRoutes);
app.use("/ride", rideRoutes);
app.use("/trip", Trip);
app.use("/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);

// Add a new endpoint to fetch passenger details
app.get("/users/:userId", async (req, res) => {
  try {
    console.log("Fetching user with ID:", req.params.userId);

    // Validate that userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      console.error("Invalid ObjectId format:", req.params.userId);
      return res.status(400).json({
        message: "Invalid user ID format",
        error: "The provided ID is not a valid ObjectId",
      });
    }

    const user = await NeprideModel.findById(req.params.userId).select(
      "username phone"
    );

    if (!user) {
      console.log("User not found with ID:", req.params.userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User found:", user);
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    // Return a more helpful error message
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid user ID format",
        error: error.message,
      });
    }
    res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
});

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Something went wrong!", error: err.message });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
