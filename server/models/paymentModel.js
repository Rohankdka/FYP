import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ride",
    required: true,
  },
  pidx: {
    type: String,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  paymentMethod: {
    type: String,
    default: "khalti",
  },
}, { timestamps: true });

export default mongoose.model("Payment", PaymentSchema);