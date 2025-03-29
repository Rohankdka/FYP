import mongoose from "mongoose"
import { v4 as uuidv4 } from "uuid"

const PaymentSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
    },
    pidx: {
      type: String,
      unique: true,
      sparse: true, // This allows multiple null values
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true, // This allows multiple null values
      default: () => uuidv4(), // Generate a unique ID for each transaction
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
  },
  { timestamps: true },
)

export default mongoose.model("Payment", PaymentSchema)

