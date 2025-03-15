import Trip from "../models/tripModel.js"
import NeprideModel from "../models/NeprideModel.js"

// Create a new trip
export const createTrip = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.user._id

    // Check if the user is a driver
    const driver = await NeprideModel.findById(driverId)
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" })
    }

    // Check if the user has driver role
    if (driver.role !== "driver" && driver.role !== "admin") {
      return res.status(403).json({ message: "Only drivers can create trips" })
    }

    // Create the trip
    const tripData = { ...req.body, driver: driverId }
    const trip = await Trip.create(tripData)

    res.status(201).json(trip)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Get all trips
export const getAllTrips = async (req, res) => {
  try {
    const trips = await Trip.find().populate("driver", "username phone").sort({ departureDate: 1 })

    // Calculate seats available for each trip
    const tripsWithAvailability = trips.map((trip) => {
      const tripObj = trip.toObject()
      tripObj.seatsAvailable = trip.availableSeats - trip.bookedSeats.length
      return tripObj
    })

    res.status(200).json(tripsWithAvailability)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get trips by driver
export const getDriverTrips = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.user._id

    const trips = await Trip.find({ driver: driverId }).populate("driver", "username phone").sort({ departureDate: 1 })

    // Calculate seats available for each trip
    const tripsWithAvailability = trips.map((trip) => {
      const tripObj = trip.toObject()
      tripObj.seatsAvailable = trip.availableSeats - trip.bookedSeats.length
      return tripObj
    })

    res.status(200).json(tripsWithAvailability)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get trip by ID
export const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId).populate("driver", "username phone")

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" })
    }

    const tripObj = trip.toObject()
    tripObj.seatsAvailable = trip.availableSeats - trip.bookedSeats.length

    res.status(200).json(tripObj)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Update trip
export const updateTrip = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.user._id
    const tripId = req.params.tripId

    // Find the trip
    const trip = await Trip.findById(tripId)
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" })
    }

    // Check if the user is the driver of this trip or an admin
    if (trip.driver.toString() !== driverId && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only update your own trips" })
    }

    // Update the trip
    const updatedTrip = await Trip.findByIdAndUpdate(tripId, req.body, { new: true, runValidators: true })

    res.status(200).json(updatedTrip)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Delete trip
export const deleteTrip = async (req, res) => {
  try {
    const driverId = req.params.driverId || req.user._id
    const tripId = req.params.tripId

    // Find the trip
    const trip = await Trip.findById(tripId)
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" })
    }

    // Check if the user is the driver of this trip or an admin
    if (trip.driver.toString() !== driverId && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only delete your own trips" })
    }

    // Delete the trip
    await Trip.findByIdAndDelete(tripId)

    res.status(200).json({ message: "Trip deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Search trips
export const searchTrips = async (req, res) => {
  try {
    const { departureLocation, destinationLocation, departureDate, availableSeats } = req.query

    // Build query
    const query = {}

    if (departureLocation) {
      query.departureLocation = { $regex: departureLocation, $options: "i" }
    }

    if (destinationLocation) {
      query.destinationLocation = { $regex: destinationLocation, $options: "i" }
    }

    if (departureDate) {
      // Find trips on the specified date
      const startDate = new Date(departureDate)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(departureDate)
      endDate.setHours(23, 59, 59, 999)

      query.departureDate = { $gte: startDate, $lte: endDate }
    }

    // Only show scheduled trips
    query.status = "scheduled"

    // Find trips
    const trips = await Trip.find(query).populate("driver", "username phone").sort({ departureDate: 1 })

    // Filter by available seats if specified
    let filteredTrips = trips
    if (availableSeats) {
      filteredTrips = trips.filter(
        (trip) => trip.availableSeats - trip.bookedSeats.length >= Number.parseInt(availableSeats),
      )
    }

    // Calculate seats available for each trip
    const tripsWithAvailability = filteredTrips.map((trip) => {
      const tripObj = trip.toObject()
      tripObj.seatsAvailable = trip.availableSeats - trip.bookedSeats.length
      return tripObj
    })

    res.status(200).json(tripsWithAvailability)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Book a seat
export const bookSeat = async (req, res) => {
  try {
    const passengerId = req.params.passengerId || req.user._id
    const tripId = req.params.tripId

    // Check if the user exists
    const passenger = await NeprideModel.findById(passengerId)
    if (!passenger) {
      return res.status(404).json({ message: "Passenger not found" })
    }

    // Check if the user has passenger role or is an admin
    if (passenger.role !== "passenger" && passenger.role !== "admin" && passenger.role !== "driver") {
      return res.status(403).json({ message: "Only passengers can book trips" })
    }

    // Find the trip
    const trip = await Trip.findById(tripId)
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" })
    }

    // Check if trip is scheduled
    if (trip.status !== "scheduled") {
      return res.status(400).json({ message: "This trip is no longer available for booking" })
    }

    // Check if there are available seats
    if (trip.bookedSeats.length >= trip.availableSeats) {
      return res.status(400).json({ message: "No seats available for this trip" })
    }

    // Check if passenger has already booked this trip
    if (trip.bookedSeats.includes(passengerId)) {
      return res.status(400).json({ message: "You have already booked this trip" })
    }

    // Add passenger to booked seats
    trip.bookedSeats.push(passengerId)
    await trip.save()

    res.status(200).json({ message: "Seat booked successfully", trip })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Cancel booking
export const cancelBooking = async (req, res) => {
  try {
    const passengerId = req.params.passengerId || req.user._id
    const tripId = req.params.tripId

    // Find the trip
    const trip = await Trip.findById(tripId)
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" })
    }

    // Check if passenger has booked this trip
    if (!trip.bookedSeats.includes(passengerId)) {
      return res.status(400).json({ message: "You have not booked this trip" })
    }

    // Remove passenger from booked seats
    trip.bookedSeats = trip.bookedSeats.filter((id) => id.toString() !== passengerId)
    await trip.save()

    res.status(200).json({ message: "Booking cancelled successfully", trip })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Get passenger's bookings
export const getPassengerBookings = async (req, res) => {
  try {
    const passengerId = req.params.passengerId || req.user._id

    // Find trips where passenger has booked a seat
    const trips = await Trip.find({ bookedSeats: passengerId })
      .populate("driver", "username phone")
      .sort({ departureDate: 1 })

    // Calculate seats available for each trip
    const tripsWithAvailability = trips.map((trip) => {
      const tripObj = trip.toObject()
      tripObj.seatsAvailable = trip.availableSeats - trip.bookedSeats.length
      return tripObj
    })

    res.status(200).json(tripsWithAvailability)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

