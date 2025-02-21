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

  // 🟢 Handle passenger requesting a ride
  socket.on("request-ride", async (data) => {
    console.log("🔍 Received ride request event on server:", data);

    try {
      const ride = await Ride.create({
        driverId: data.driverId,
        passengerId: data.passengerId,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        status: "requested",
      });

      console.log("✅ Ride saved in DB:", ride);

      // Notify the driver about the ride request
      io.to(`driver-${data.driverId}`).emit("ride-request", ride);
      console.log(`📩 Ride request sent to driver-${data.driverId}`);
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

  // 🟢 Handle disconnection
  socket.on("disconnect", () => {
    console.log(`⚠️ A user disconnected: ${socket.id}`);
  });
});

app.use("/uploads", express.static("uploads"));

// Middleware
app.use(express.json());
app.use(cors({ origin: "http://localhost:8081", credentials: true }));

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
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
