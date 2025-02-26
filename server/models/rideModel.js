import mongoose from "mongoose";

const RideSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" }, // Optional
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: "Nepride", required: true },
    pickupLocation: { type: String, required: true }, // Coordinates
    dropoffLocation: { type: String, required: true }, // Coordinates
    pickupLocationName: { type: String, required: true }, // Human-readable name
    dropoffLocationName: { type: String, required: true }, // Human-readable name
    status: {
      type: String,
      enum: ["requested", "accepted", "picked up", "completed", "canceled"],
      default: "requested",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Ride", RideSchema);