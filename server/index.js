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
import Ride from "./models/rideModel.js"

dotenv.config(); // Load environment variables

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins (update in production)
  },
});

// 🟢 Socket.IO connection
io.on("connection", (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);

  // 🟢 Handle driver going online
  socket.on("driver-online", (driverId) => {
    console.log(`✅ Driver ${driverId} is online and joined room driver-${driverId}`);
    socket.join(`driver-${driverId}`); // Driver joins a specific room
  });

  // 🟢 Handle driver going offline
  socket.on("driver-offline", (driverId) => {
    console.log(`🚫 Driver ${driverId} is offline`);
    socket.leave(`driver-${driverId}`); // Driver leaves their room
  });

  // 🟢 Handle passenger requesting a ride
  socket.on("request-ride", async (data) => {
    console.log("🔍 Received ride request event on server:", data);

    try {
      const ride = await Ride.create({
        passengerId: data.passengerId,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        pickupLocationName: data.pickupLocationName,
        dropoffLocationName: data.dropoffLocationName,
        status: "requested", // Default status
      });

      console.log("✅ Ride saved in DB:", ride);

      // Notify all online drivers about the ride request
      io.emit("ride-request", ride); // Broadcast to all drivers
      console.log("📩 Ride request broadcasted to all drivers");
    } catch (error) {
      console.error("❌ Error saving ride:", error);
    }
  });

  // 🟢 Handle driver accepting/rejecting a ride
  socket.on("ride-response", async (data) => {
    console.log("🔍 Ride response received:", data);

    try {
      const ride = await Ride.findById(data.rideId);
      if (!ride) {
        console.log("❌ Ride not found");
        return;
      }

      // Update ride with driverId and status
      ride.driverId = data.driverId;
      ride.status = data.status;
      await ride.save();

      // Notify the passenger
      io.to(`passenger-${ride.passengerId}`).emit("ride-status", {
        rideId: ride._id,
        status: ride.status,
      });

      console.log(`📩 Ride status update sent to passenger-${ride.passengerId}`);
    } catch (error) {
      console.error("❌ Error updating ride:", error);
    }
  });

  // 🟢 Handle ride status updates (e.g., picked up, completed)
  socket.on("ride-status-update", async (data) => {
    console.log("🔍 Ride status update received:", data);

    try {
      const ride = await Ride.findById(data.rideId);
      if (!ride) {
        console.log("❌ Ride not found");
        return;
      }

      ride.status = data.status;
      await ride.save();

      // Notify the passenger
      io.to(`passenger-${ride.passengerId}`).emit("ride-status", {
        rideId: ride._id,
        status: ride.status,
      });

      console.log(`📩 Ride status update sent to passenger-${ride.passengerId}`);
    } catch (error) {
      console.error("❌ Error updating ride status:", error);
    }
  });

  // 🟢 Handle disconnection
  socket.on("disconnect", () => {
    console.log(`⚠️ A user disconnected: ${socket.id}`);
  });
});

app.use("/uploads", express.static("uploads"));

// Middleware
app.use(express.json());
app.use(cors({
  origin: "*", // Allow all origins (or specify frontend URL)
  credentials: true
}));

// Database connection
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

// Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/driver", driverRoutes);
app.use("/admin", adminRoutes);
app.use("/ride", rideRoutes);
app.use("/trip", Trip)

// 404 Handler
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!", error: err.message });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
