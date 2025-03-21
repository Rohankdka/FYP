import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nepride",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "trip_update",
        "status_update",
        "trip_cancelled",
        "new_booking",
        "booking_cancelled",
        "trip_completed",
        "payment_received",
        "ride_request",
        "ride_accepted",
        "ride_started",
        "ride_completed",
        "ride_canceled",
        "payment_completed",
      ],
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
