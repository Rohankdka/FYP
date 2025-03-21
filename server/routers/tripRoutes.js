import express from "express"
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
  notifyTripPassengers,
  completeTrip,
} from "../controllers/tripController.js"
import authMiddleware from "../middleware/authToken.js"
import authorizeRole from "../middleware/roleMiddleware.js"

const router = express.Router()

// Public routes
router.get("/all", getAllTrips)
router.get("/search", searchTrips)
router.get("/:tripId", getTripById)

// Protected routes
router.use(authMiddleware)

// Driver routes
router.post("/create/:driverId", authorizeRole(["driver", "admin"]), createTrip)
router.get("/driver/:driverId/trips", authorizeRole(["driver", "admin"]), getDriverTrips)
router.put("/:tripId/:driverId", authorizeRole(["driver", "admin"]), updateTrip)
router.delete("/:tripId/:driverId", authorizeRole(["driver", "admin"]), deleteTrip)
router.post("/:tripId/:driverId/complete", authorizeRole(["driver", "admin"]), completeTrip)
router.post("/:tripId/notify", authorizeRole(["driver", "admin"]), notifyTripPassengers)

// Passenger routes
router.post("/:tripId/book/:passengerId", authorizeRole(["passenger", "driver", "admin"]), bookSeat)
router.delete("/:tripId/cancel/:passengerId", authorizeRole(["passenger", "driver", "admin"]), cancelBooking)
router.get("/passenger/:passengerId/bookings", authorizeRole(["passenger", "driver", "admin"]), getPassengerBookings)

export default router

