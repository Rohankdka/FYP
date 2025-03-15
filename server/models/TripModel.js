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
      },
    ],
  },
  { timestamps: true }
);

// Create a virtual property to check seats availability
tripSchema.virtual("seatsAvailable").get(function () {
  return this.availableSeats - this.bookedSeats.length;
});

// Prevent booking more seats than available
tripSchema.pre("save", function (next) {
  if (this.bookedSeats.length > this.availableSeats) {
    const error = new Error("Cannot book more seats than available");
    return next(error);
  }

  // Check for duplicate bookings
  const uniqueBookings = [
    ...new Set(this.bookedSeats.map((id) => id.toString())),
  ];
  if (uniqueBookings.length !== this.bookedSeats.length) {
    const error = new Error("Duplicate booking detected");
    return next(error);
  }

  next();
});

// Define the Trip model using the schema
const Trip = mongoose.model("Trip", tripSchema);

export default Trip;
