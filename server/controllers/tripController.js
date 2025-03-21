import Trip from "../models/tripModel.js";
import NeprideModel from "../models/NeprideModel.js";
import Notification from "../models/notificationModel.js";

// Create a new trip
export const createTrip = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.user._id;
    console.log("Creating trip for driver:", driverId);

    // Check if the user is a driver
    const driver = await NeprideModel.findById(driverId);
    if (!driver) {
      console.log("Driver not found:", driverId);
      return res.status(404).json({ message: "Driver not found" });
    }

    // Check if the user has driver role
    if (driver.role !== "driver" && driver.role !== "admin") {
      console.log("User is not a driver:", driver.role);
      return res.status(403).json({ message: "Only drivers can create trips" });
    }

    // Validate required fields
    const requiredFields = [
      "departureLocation",
      "destinationLocation",
      "departureDate",
      "departureTime",
      "price",
      "availableSeats",
      "vehicleDetails",
    ];

    const missingFields = [];

    for (const field of requiredFields) {
      if (field === "vehicleDetails") {
        if (
          !req.body.vehicleDetails ||
          !req.body.vehicleDetails.model ||
          !req.body.vehicleDetails.color ||
          !req.body.vehicleDetails.plateNumber
        ) {
          missingFields.push("vehicleDetails (model, color, plateNumber)");
        }
      } else if (!req.body[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      console.log("Missing required fields:", missingFields);
      return res.status(400).json({
        message: "Missing required fields",
        missingFields,
      });
    }

    // Create the trip
    const tripData = { ...req.body, driver: driverId };

    const trip = await Trip.create(tripData);
    console.log("Trip created successfully:", trip._id);

    res.status(201).json(trip);
  } catch (error) {
    console.error("Error creating trip:", error);

    // Provide more detailed error information
    if (error.name === "ValidationError") {
      const validationErrors = {};

      for (const field in error.errors) {
        validationErrors[field] = error.errors[field].message;
      }

      return res.status(400).json({
        message: "Validation error",
        errors: validationErrors,
      });
    }

    res.status(400).json({ message: error.message });
  }
};

// Get all trips
export const getAllTrips = async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("driver", "username phone")
      .sort({ departureDate: 1 });

    // Calculate seats available for each trip
    const tripsWithAvailability = trips.map((trip) => {
      const tripObj = trip.toObject();
      tripObj.seatsAvailable = trip.availableSeats - trip.bookedSeats.length;
      return tripObj;
    });

    res.status(200).json(tripsWithAvailability);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get trips by driver
export const getDriverTrips = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.user._id;
    console.log(`Fetching trips for driver: ${driverId}`);

    const trips = await Trip.find({ driver: driverId })
      .populate("driver", "username phone")
      .sort({ departureDate: 1 });

    console.log(`Found ${trips.length} trips for driver: ${driverId}`);

    // Calculate seats available for each trip
    const tripsWithAvailability = trips.map((trip) => {
      const tripObj = trip.toObject();
      tripObj.seatsAvailable = trip.availableSeats - trip.bookedSeats.length;
      return tripObj;
    });

    res.status(200).json(tripsWithAvailability);
  } catch (error) {
    console.error("Error fetching driver trips:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get trip by ID
export const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId).populate(
      "driver",
      "username phone"
    );

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const tripObj = trip.toObject();
    tripObj.seatsAvailable = trip.availableSeats - trip.bookedSeats.length;

    res.status(200).json(tripObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update trip
export const updateTrip = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.user._id;
    const tripId = req.params.tripId;

    // Find the trip
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Check if the user is the driver of this trip or an admin
    if (trip.driver.toString() !== driverId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You can only update your own trips" });
    }

    // Update the trip
    const updatedTrip = await Trip.findByIdAndUpdate(tripId, req.body, {
      new: true,
      runValidators: true,
    });

    // If status is being updated, create notifications for passengers
    if (req.body.status && trip.status !== req.body.status) {
      // Notify all passengers who booked this trip
      for (const passengerId of trip.bookedSeats) {
        await Notification.create({
          userId: passengerId,
          title: "Trip Status Updated",
          message: `Your trip from ${trip.departureLocation} to ${trip.destinationLocation} has been updated to ${req.body.status}.`,
          type: "trip_status",
          relatedId: tripId,
          read: false,
        });
      }
    }

    res.status(200).json(updatedTrip);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete trip
export const deleteTrip = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.user._id;
    const tripId = req.params.tripId;

    // Find the trip
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Check if the user is the driver of this trip or an admin
    if (trip.driver.toString() !== driverId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You can only delete your own trips" });
    }

    // Notify all passengers who booked this trip
    for (const passengerId of trip.bookedSeats) {
      await Notification.create({
        userId: passengerId,
        title: "Trip Cancelled",
        message: `Your trip from ${trip.departureLocation} to ${trip.destinationLocation} has been cancelled by the driver.`,
        type: "trip_cancelled",
        relatedId: tripId,
        read: false,
      });
    }

    // Delete the trip
    await Trip.findByIdAndDelete(tripId);

    res.status(200).json({ message: "Trip deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search trips
export const searchTrips = async (req, res) => {
  try {
    const {
      departureLocation,
      destinationLocation,
      departureDate,
      availableSeats,
    } = req.query;

    // Build query
    const query = {};

    if (departureLocation) {
      query.departureLocation = { $regex: departureLocation, $options: "i" };
    }

    if (destinationLocation) {
      query.destinationLocation = {
        $regex: destinationLocation,
        $options: "i",
      };
    }

    if (departureDate) {
      // Find trips on the specified date
      const startDate = new Date(departureDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(departureDate);
      endDate.setHours(23, 59, 59, 999);

      query.departureDate = { $gte: startDate, $lte: endDate };
    }

    // Only show scheduled trips
    query.status = "scheduled";

    // Find trips
    const trips = await Trip.find(query)
      .populate("driver", "username phone")
      .sort({ departureDate: 1 });

    // Filter by available seats if specified
    let filteredTrips = trips;
    if (availableSeats) {
      filteredTrips = trips.filter(
        (trip) =>
          trip.availableSeats - trip.bookedSeats.length >=
          Number.parseInt(availableSeats)
      );
    }

    // Calculate seats available for each trip
    const tripsWithAvailability = filteredTrips.map((trip) => {
      const tripObj = trip.toObject();
      tripObj.seatsAvailable = trip.availableSeats - trip.bookedSeats.length;
      return tripObj;
    });

    res.status(200).json(tripsWithAvailability);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Book a seat
export const bookSeat = async (req, res) => {
  try {
    const passengerId = req.params.passengerId || req.user._id;
    const tripId = req.params.tripId;

    // Check if the user exists
    const passenger = await NeprideModel.findById(passengerId);
    if (!passenger) {
      return res.status(404).json({ message: "Passenger not found" });
    }

    // Check if the user has passenger role or is an admin
    if (
      passenger.role !== "passenger" &&
      passenger.role !== "admin" &&
      passenger.role !== "driver"
    ) {
      return res
        .status(403)
        .json({ message: "Only passengers can book trips" });
    }

    // Find the trip
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Check if trip is scheduled
    if (trip.status !== "scheduled") {
      return res
        .status(400)
        .json({ message: "This trip is no longer available for booking" });
    }

    // Check if there are available seats
    if (trip.bookedSeats.length >= trip.availableSeats) {
      return res
        .status(400)
        .json({ message: "No seats available for this trip" });
    }

    // Check if passenger has already booked this trip
    if (trip.bookedSeats.includes(passengerId)) {
      return res
        .status(400)
        .json({ message: "You have already booked this trip" });
    }

    // Add passenger to booked seats
    trip.bookedSeats.push(passengerId);
    await trip.save();

    // Notify the driver
    await Notification.create({
      userId: trip.driver,
      title: "New Booking",
      message: `${passenger.username} has booked a seat on your trip from ${trip.departureLocation} to ${trip.destinationLocation}.`,
      type: "new_booking",
      relatedId: tripId,
      read: false,
    });

    res.status(200).json({ message: "Seat booked successfully", trip });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Cancel booking
export const cancelBooking = async (req, res) => {
  try {
    const passengerId = req.params.passengerId || req.user._id;
    const tripId = req.params.tripId;

    // Find the trip
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Check if passenger has booked this trip
    if (!trip.bookedSeats.includes(passengerId)) {
      return res.status(400).json({ message: "You have not booked this trip" });
    }

    // Get passenger details for notification
    const passenger = await NeprideModel.findById(passengerId);

    // Remove passenger from booked seats
    trip.bookedSeats = trip.bookedSeats.filter(
      (id) => id.toString() !== passengerId
    );
    await trip.save();

    // Notify the driver
    await Notification.create({
      userId: trip.driver,
      title: "Booking Cancelled",
      message: `${passenger.username} has cancelled their booking on your trip from ${trip.departureLocation} to ${trip.destinationLocation}.`,
      type: "booking_cancelled",
      relatedId: tripId,
      read: false,
    });

    res.status(200).json({ message: "Booking cancelled successfully", trip });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get passenger's bookings
export const getPassengerBookings = async (req, res) => {
  try {
    const passengerId = req.params.passengerId || req.user._id;

    // Find trips where passenger has booked a seat
    const trips = await Trip.find({ bookedSeats: passengerId })
      .populate("driver", "username phone")
      .sort({ departureDate: 1 });

    // Calculate seats available for each trip
    const tripsWithAvailability = trips.map((trip) => {
      const tripObj = trip.toObject();
      tripObj.seatsAvailable = trip.availableSeats - trip.bookedSeats.length;
      return tripObj;
    });

    res.status(200).json(tripsWithAvailability);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send notification to trip passengers
export const notifyTripPassengers = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const { message, type } = req.body;

    if (!message || !type) {
      return res.status(400).json({ message: "Message and type are required" });
    }

    // Find the trip
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Check if the user is the driver of this trip
    const driverId = req.params.driverId || req.user._id;
    if (trip.driver.toString() !== driverId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({
          message: "You can only send notifications for your own trips",
        });
    }

    // Create notifications for all passengers
    const notifications = [];
    for (const passengerId of trip.bookedSeats) {
      const notification = await Notification.create({
        userId: passengerId,
        title:
          type === "trip_update"
            ? "Trip Updated"
            : type === "status_update"
            ? "Trip Status Updated"
            : "Trip Notification",
        message,
        type,
        relatedId: tripId,
        read: false,
      });
      notifications.push(notification);
    }

    res
      .status(200)
      .json({
        message: "Notifications sent successfully",
        count: notifications.length,
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Complete a trip and process payment
export const completeTrip = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const driverId = req.params.driverId || req.user._id;
    const { paymentMethod } = req.body;

    // Find the trip
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Check if the user is the driver of this trip
    if (trip.driver.toString() !== driverId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You can only complete your own trips" });
    }

    // Update trip status to completed
    trip.status = "completed";
    trip.paymentMethod = paymentMethod || "cash";
    trip.paymentStatus = "completed";
    await trip.save();

    // Notify all passengers
    for (const passengerId of trip.bookedSeats) {
      await Notification.create({
        userId: passengerId,
        title: "Trip Completed",
        message: `Your trip from ${trip.departureLocation} to ${trip.destinationLocation} has been completed. Thank you for using our service!`,
        type: "trip_completed",
        relatedId: tripId,
        read: false,
      });
    }

    res.status(200).json({ message: "Trip completed successfully", trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
