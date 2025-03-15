import express from "express";
import {
  createTrip,
  getAllTrips,
  getDriverTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  searchTrips,
  bookSeat,
  cancelBooking,
  getPassengerBookings,
} from "../controllers/tripController.js";
import protectRoute from "../middleware/authToken.js";
import authorizeRole from "../middleware/roleMiddleware.js";

const router = express.Router();

// Public routes
router.get("/all", getAllTrips);
router.get("/search", searchTrips);
router.get("/:tripId", getTripById);

// Protected routes
// Create a trip (only drivers can create trips)
router.post("/create", protectRoute, authorizeRole("driver"), createTrip);
router.post(
  "/create/:driverId",
  protectRoute,
  authorizeRole("driver"),
  createTrip
);

// Get driver's trips
router.get(
  "/driver/trips",
  protectRoute,
  authorizeRole("driver"),
  getDriverTrips
);
router.get("/driver/:driverId/trips", protectRoute, getDriverTrips);

// Update trip (driver or admin)
router.put("/:tripId", protectRoute, authorizeRole("driver"), updateTrip);
router.put(
  "/:tripId/:driverId",
  protectRoute,
  authorizeRole("driver"),
  updateTrip
);

// Delete trip (driver or admin)
router.delete("/:tripId", protectRoute, authorizeRole("driver"), deleteTrip);
router.delete(
  "/:tripId/:driverId",
  protectRoute,
  authorizeRole("driver"),
  deleteTrip
);

// Booking routes
router.post(
  "/:tripId/book",
  protectRoute,
  authorizeRole("passenger"),
  bookSeat
);
router.post(
  "/:tripId/book/:passengerId",
  protectRoute,
  authorizeRole("admin"),
  bookSeat
);

router.delete(
  "/:tripId/cancel",
  protectRoute,
  authorizeRole("passenger"),
  cancelBooking
);
router.delete(
  "/:tripId/cancel/:passengerId",
  protectRoute,
  authorizeRole("admin"),
  cancelBooking
);

// Get passenger's booked trips
router.get(
  "/passenger/bookings",
  protectRoute,
  authorizeRole("passenger"),
  getPassengerBookings
);
router.get(
  "/passenger/:passengerId/bookings",
  protectRoute,
  getPassengerBookings
);

export default router;
