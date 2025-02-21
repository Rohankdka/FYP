import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nepride",
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
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > new Date(); // Ensure departureDate is in the future
        },
        message: "Departure date must be in the future",
      },
    },
    departureTime: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0, // Ensure price is non-negative
    },
    availableSeats: {
      type: Number,
      required: true,
      min: 1, // Ensure at least 1 seat is available
    },
    status: {
      type: String,
      enum: ["scheduled", "in-progress", "completed", "cancelled"],
      default: "scheduled",
    },
    description: {
      type: String,
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
        default: false,
      },
    },
    bookedSeats: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Nepride",
        validate: {
          validator: function (value) {
            return !this.bookedSeats.includes(value); // Ensure no duplicate users
          },
          message: "User has already booked a seat",
        },
      },
    ],
  },
  { timestamps: true } // Automatically manage createdAt and updatedAt fields
);

// Define the Trip model using the schema
const Trip = mongoose.model("Trip", tripSchema);

export default Trip;