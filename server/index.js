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
});

io.on("connection", (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);

  socket.on("join", (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on("driver-online", (driverId) => {
    console.log(
      `✅ Driver ${driverId} is online and joined room driver-${driverId}`
    );
    socket.join(`driver-${driverId}`);
    io.emit("driver-available", { driverId, status: "online" });
  });

  socket.on("driver-offline", (driverId) => {
    console.log(`🚫 Driver ${driverId} is offline`);
    socket.leave(`driver-${driverId}`);
    io.emit("driver-available", { driverId, status: "offline" });
  });

  socket.on("request-ride", async (data) => {
    try {
      const ride = await Ride.create({
        passengerId: data.passengerId,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        pickupLocationName: data.pickupLocationName,
        dropoffLocationName: data.dropoffLocationName,
        status: "requested",
        distance: data.distance,
        estimatedTime: data.estimatedTime,
      });

      const passenger = await NeprideModel.findById(data.passengerId).select(
        "phone username"
      );
      const rideWithPassenger = {
        ...ride._doc,
        passenger: { phone: passenger.phone, username: passenger.username },
      };

      io.emit("ride-request", rideWithPassenger);
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

      const driver = await DriverModel.findOne({ user: data.driverId });
      if (!driver) {
        console.error(
          `Driver ${data.driverId} not found in drivers collection`
        );
      } else {
        console.log(`Driver ${data.driverId} found: ${driver.fullName}`);
      }

      ride.driverId = data.driverId;
      ride.status = data.status; // This will now work because "rejected" is a valid enum value
      await ride.save();

      io.to(`passenger-${ride.passengerId}`).emit("ride-status", {
        rideId: ride._id,
        status: ride.status,
        driverId: data.driverId,
      });

      io.to(`driver-${data.driverId}`).emit("ride-notification", {
        message: `Ride ${data.status}`,
      });

      if (data.status === "rejected") {
        io.emit("ride-request", ride); // Re-emit ride request to other drivers
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
      await ride.save();

      io.to(`passenger-${ride.passengerId}`).emit("ride-status", {
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
        });
        io.to(`driver-${ride.driverId}`).emit("ride-completed", {
          rideId: ride._id,
          message: "Ride completed. You are now available for new rides.",
        });
      }
    } catch (error) {
      console.error("❌ Error updating ride status:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`⚠️ A user disconnected: ${socket.id}`);
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
