import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routers/authRoutes.js";
import userRoutes from "./routers/userRoutes.js";
import driverRoutes from "./routers/driverRoutes.js";
import adminRoutes from "./routers/adminRoutes.js"
import path from "path";
import { fileURLToPath } from "url";

dotenv.config(); // Load environment variables from .env file

const app = express();

app.use("/uploads", express.static("uploads"));

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(
  cors({
    origin: "http://localhost:8081", // Allow requests from the frontend
    credentials: true, // Enable sending cookies with cross-origin requests
  })
);

// Database connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true, // Use the new MongoDB connection string parser
    useUnifiedTopology: true, // Enable the new connection management engine
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1); // Exit process if database connection fails
  });

// Routes
app.use("/auth", authRoutes); // Route for authentication-related APIs
app.use("/users", userRoutes);
app.use("/driver", driverRoutes);
app.use("/admin",adminRoutes)

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Something went wrong!", error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
