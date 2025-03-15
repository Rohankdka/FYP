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

io.on("connection", (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);
  connectedClients.set(socket.id, { userId: null, userType: null });

  socket.on("join", (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on("driver-online", async (driverId) => {
    // Store the driver ID with this socket
    connectedClients.set(socket.id, { userId: driverId, userType: "driver" });

    // Only emit if status is changing from offline to online
    if (!driverStatus.get(driverId)) {
      console.log(
        `✅ Driver ${driverId} is online and joined room driver-${driverId}`
      );
      socket.join(`driver-${driverId}`);
      driverStatus.set(driverId, true);

      try {
        // Get driver details including vehicle type
        const driver = await DriverModel.findOne({ user: driverId });
        if (driver) {
          // Update driver status in database
          await DriverModel.findOneAndUpdate(
            { user: driverId },
            { isOnline: true }
          );

          io.emit("driver-available", {
            driverId,
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
      socket.join(`driver-${driverId}`);
    }
  });

  socket.on("driver-offline", async (driverId) => {
    // Only emit if status is changing from online to offline
    if (driverStatus.get(driverId)) {
      console.log(`🚫 Driver ${driverId} is offline`);
      socket.leave(`driver-${driverId}`);
      driverStatus.set(driverId, false);

      try {
        // Update driver status in database
        await DriverModel.findOneAndUpdate(
          { user: driverId },
          { isOnline: false }
        );
      } catch (error) {
        console.error("Error updating driver status:", error);
      }

      io.emit("driver-available", { driverId, status: "offline" });
    }
  });

  socket.on("driver-location-update", async (data) => {
    try {
      const { driverId, location } = data;

      // Only process if driver is online
      if (driverStatus.get(driverId)) {
        // Update driver location in database
        await DriverModel.findOneAndUpdate(
          { user: driverId },
          { currentLocation: location }
        );

        // Emit to all clients that might be interested
        io.emit("driver-location-changed", { driverId, location });

        // If driver has an active ride, send location update to the passenger
        const activeRide = await Ride.findOne({
          driverId,
          status: { $in: ["accepted", "picked up"] },
        });

        if (activeRide) {
          io.to(`passenger-${activeRide.passengerId}`).emit(
            "driver-location-update",
            {
              rideId: activeRide._id,
              location,
            }
          );
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
      // Calculate fare based on distance and vehicle type
      const fare = calculateFare(data.distance, data.vehicleType);

      const ride = await Ride.create({
        passengerId: data.passengerId,
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

      const passenger = await NeprideModel.findById(data.passengerId).select(
        "phone username"
      );
      const rideWithPassenger = {
        ...ride._doc,
        passenger: { phone: passenger.phone, username: passenger.username },
        fare,
      };

      // Store the passenger ID with this socket
      connectedClients.set(socket.id, {
        userId: data.passengerId,
        userType: "passenger",
      });

      // If a specific driver is requested, emit only to that driver
      if (data.specificDriverId) {
        io.to(`driver-${data.specificDriverId}`).emit(
          "ride-request",
          rideWithPassenger
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

      const driver = await DriverModel.findOne({ user: data.driverId });
      if (!driver) {
        console.error(
          `Driver ${data.driverId} not found in drivers collection`
        );
      } else {
        console.log(`Driver ${data.driverId} found: ${driver.fullName}`);
      }

      ride.driverId = data.driverId;
      ride.status = data.status;
      await ride.save();

      io.to(`passenger-${ride.passengerId}`).emit("ride-status", {
        rideId: ride._id,
        status: ride.status,
        driverId: data.driverId,
        driverInfo: driver
          ? {
              fullName: driver.fullName,
              vehicleType: driver.vehicleType,
              numberPlate: driver.numberPlate,
            }
          : null,
      });

      io.to(`driver-${data.driverId}`).emit("ride-notification", {
        message: `Ride ${data.status}`,
      });

      if (data.status === "rejected") {
        // Only re-emit to other drivers if the ride is still in requested state
        const updatedRide = await Ride.findById(data.rideId);
        if (updatedRide && updatedRide.status === "requested") {
          // Get all online drivers except the one who rejected
          const onlineDrivers = Array.from(driverStatus.entries())
            .filter(
              ([driverId, isOnline]) => isOnline && driverId !== data.driverId
            )
            .map(([driverId]) => driverId);

          for (const driverId of onlineDrivers) {
            const driver = await DriverModel.findOne({ user: driverId });
            if (driver && driver.vehicleType === updatedRide.vehicleType) {
              io.to(`driver-${driverId}`).emit("ride-request", {
                ...updatedRide._doc,
                passenger: ride.passenger,
              });
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
      const ride = await Ride.findById(data.rideId);
      if (!ride) return;

      ride.status = data.status;

      // If ride is completed, calculate final fare
      if (data.status === "completed") {
        // Use provided fare or calculate it
        ride.fare = data.fare || calculateFare(ride.distance, ride.vehicleType);
      }

      await ride.save();

      io.to(`passenger-${ride.passengerId}`).emit("ride-status", {
        rideId: ride._id,
        status: ride.status,
        fare: ride.fare,
      });

      io.to(`driver-${ride.driverId}`).emit("ride-status", {
        rideId: ride._id,
        status: ride.status,
      });

      io.to(`driver-${ride.driverId}`).emit("ride-notification", {
        message: `Ride status updated to ${data.status}`,
      });

      if (data.status === "completed") {
        // Notify both passenger and driver that the ride is completed
        io.to(`passenger-${ride.passengerId}`).emit("ride-completed", {
          rideId: ride._id,
          message: "Ride completed. Thank you for using our service!",
          fare: ride.fare,
        });
        io.to(`driver-${ride.driverId}`).emit("ride-completed", {
          rideId: ride._id,
          message: "Ride completed. You are now available for new rides.",
          fare: ride.fare,
        });
      } else if (data.status === "canceled") {
        // Notify both passenger and driver that the ride is canceled
        io.to(`passenger-${ride.passengerId}`).emit("ride-notification", {
          message: "Your ride has been canceled.",
        });
        io.to(`driver-${ride.driverId}`).emit("ride-notification", {
          message: "The ride has been canceled.",
        });
      }
    } catch (error) {
      console.error("❌ Error updating ride status:", error);
    }
  });

  socket.on("payment-completed", async (data) => {
    try {
      const { rideId, paymentMethod } = data;
      const ride = await Ride.findById(rideId);
      if (!ride) return;

      ride.paymentStatus = "completed";
      ride.paymentMethod = paymentMethod || ride.paymentMethod || "cash";
      await ride.save();

      io.to(`driver-${ride.driverId}`).emit("payment-received", {
        rideId: ride._id,
        message: `Payment received for the ride via ${ride.paymentMethod}.`,
      });
    } catch (error) {
      console.error("Error processing payment:", error);
    }
  });

  socket.on("get-ride-history", async (data) => {
    try {
      const { userId, userType } = data;
      let rides;

      if (userType === "passenger") {
        rides = await Ride.find({ passengerId: userId })
          .sort({ createdAt: -1 })
          .populate("driverId", "fullName vehicleType numberPlate");
      } else if (userType === "driver") {
        rides = await Ride.find({ driverId: userId })
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
      let activeRide;

      if (userType === "passenger") {
        activeRide = await Ride.findOne({
          passengerId: userId,
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
          driverId: userId,
          status: { $in: ["accepted", "picked up"] },
        });

        // Populate passenger info
        if (activeRide) {
          const passenger = await NeprideModel.findById(
            activeRide.passengerId
          ).select("phone username");

          // Add passenger info to the ride object
          const rideWithPassenger = {
            ...activeRide._doc,
            passenger: passenger
              ? {
                  phone: passenger.phone,
                  username: passenger.username,
                }
              : null,
          };

          socket.emit("active-ride-found", {
            ride: rideWithPassenger,
          });
        }
      }
    } catch (error) {
      console.error("Error reconnecting to active ride:", error);
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

// Add a new endpoint to fetch passenger details
app.get("/users/:userId", async (req, res) => {
  try {
    const user = await NeprideModel.findById(req.params.userId).select(
      "username phone"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
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
