import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nepride",
      required: true,
    },
    departureLocation: {
      type: String,
      required: true,
    },
    destinationLocation: {
      type: String,
      required: true,
    },
    departureDate: {
      type: String,
      required: true,
    },
    departureTime: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    availableSeats: {
      type: Number,
      required: true,
    },
    bookedSeats: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Nepride",
      default: [],
    },
    status: {
      type: String,
      enum: ["scheduled", "in-progress", "completed", "cancelled"],
      default: "scheduled",
    },
    description: {
      type: String,
      default: "",
    },
    vehicleDetails: {
      model: {
        type: String,
        required: true,
      },
      color: {
        type: String,
        required: true,
      },
      plateNumber: {
        type: String,
        required: true,
      },
    },
    preferences: {
      smoking: {
        type: Boolean,
        default: false,
      },
      pets: {
        type: Boolean,
        default: false,
      },
      music: {
        type: Boolean,
        default: true,
      },
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "wallet", "card"],
      default: "cash",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const Trip = mongoose.model("Trip", tripSchema);

export default Trip;
