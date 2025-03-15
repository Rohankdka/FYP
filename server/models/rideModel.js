import mongoose from "mongoose";

const RideSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nepride",
      required: true,
    },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    pickupLocationName: { type: String, required: true },
    dropoffLocationName: { type: String, required: true },
    distance: { type: Number },
    estimatedTime: { type: Number },
    fare: { type: Number },
    vehicleType: { type: String, enum: ["Bike", "Car", "Electric"] },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    status: {
      type: String,
      enum: [
        "requested",
        "accepted",
        "picked up",
        "completed",
        "canceled",
        "rejected",
      ],
      default: "requested",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Ride", RideSchema);
