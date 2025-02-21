// models/Ride.js
import mongoose from "mongoose";

const RideSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Nepride", required: true },
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: "Nepride" },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    status: {
      type: String,
      enum: ["available", "requested", "accepted", "completed"],
      default: "available",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Ride", RideSchema);