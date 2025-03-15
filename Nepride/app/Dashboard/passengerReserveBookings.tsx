"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import axios from "axios"
import { Ionicons, FontAwesome5, MaterialIcons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"

const API_URL = "http://192.168.1.70:3001"

interface Trip {
  _id: string
  driver: {
    _id: string
    username: string
    phone: string
  } | null
  departureLocation: string
  destinationLocation: string
  departureDate: string
  departureTime: string
  price: number
  availableSeats: number
  status: string
  description: string
  vehicleDetails: {
    model: string
    color: string
    plateNumber: string
  }
  preferences: {
    smoking: boolean
    pets: boolean
    music: boolean
  }
  bookedSeats: string[]
  seatsAvailable: number
}

interface Passenger {
  _id: string
  username: string
  phone: string
}

const PassengerReserveBooking = () => {
  const { passengerId } = useLocalSearchParams<{ passengerId: string }>()
  const router = useRouter()

  const [trips, setTrips] = useState<Trip[]>([])
  const [myBookings, setMyBookings] = useState<Trip[]>([])
  const [loading, setLoading] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("available")
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [filterDate, setFilterDate] = useState<Date | null>(null)
  const [filterDateString, setFilterDateString] = useState("")
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [filterLocation, setFilterLocation] = useState("")
  const [filterDestination, setFilterDestination] = useState("")
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [showTripDetails, setShowTripDetails] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("cash")
  const [walletBalance, setWalletBalance] = useState<number>(500) // Mock wallet balance

  // Get auth token
  useEffect(() => {
    const getToken = async () => {
      try {
        const authToken = await AsyncStorage.getItem("token")
        setToken(authToken)
      } catch (error) {
        console.error("Error getting token:", error)
      }
    }
    getToken()
  }, [])

  // Setup axios headers with token
  const getAuthHeaders = () => {
    return {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    }
  }

  // Fetch all available trips
  const fetchTrips = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/trip/all`, getAuthHeaders())
      // Filter out trips that are already in the past
      const now = new Date()
      const filteredTrips = response.data.filter((trip: Trip) => {
        const tripDate = new Date(trip.departureDate)
        return tripDate >= now && trip.status === "scheduled" && trip.seatsAvailable > 0
      })
      setTrips(filteredTrips)
    } catch (error) {
      console.error("Error fetching trips:", error)
      Alert.alert("Error", "Failed to fetch available trips")
    } finally {
      setLoading(false)
    }
  }

  // Fetch passenger's bookings
  const fetchMyBookings = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/trip/passenger/${passengerId}/bookings`, getAuthHeaders())
      setMyBookings(response.data)
    } catch (error) {
      console.error("Error fetching bookings:", error)
      Alert.alert("Error", "Failed to fetch your bookings")
    } finally {
      setLoading(false)
    }
  }

  // Book a seat on a trip
  const bookTrip = async (tripId: string) => {
    setBookingLoading(true)
    try {
      // Make sure we're sending the token in the headers
      await axios.post(
        `${API_URL}/trip/${tripId}/book/${passengerId}`,
        {}, // Empty body
        getAuthHeaders(),
      )
      Alert.alert("Success", "Trip booked successfully!")
      fetchTrips()
      fetchMyBookings()
      setShowTripDetails(false)
    } catch (error) {
      console.error("Error booking trip:", error)
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        Alert.alert("Permission Denied", "You don't have permission to book this trip. Please contact support.")
      } else {
        Alert.alert("Error", "Failed to book trip. Please try again.")
      }
    } finally {
      setBookingLoading(false)
    }
  }

  // Cancel a booking
  const cancelBooking = async (tripId: string) => {
    setBookingLoading(true)
    try {
      await axios.delete(`${API_URL}/trip/${tripId}/cancel/${passengerId}`, getAuthHeaders())
      Alert.alert("Success", "Booking cancelled successfully!")
      fetchMyBookings()
      fetchTrips()
      setShowTripDetails(false)
    } catch (error) {
      console.error("Error cancelling booking:", error)
      Alert.alert("Error", "Failed to cancel booking. Please try again.")
    } finally {
      setBookingLoading(false)
    }
  }

  // Handle payment for a trip
  const handlePayment = () => {
    if (selectedTrip) {
      if (selectedPaymentMethod === "wallet" && selectedTrip.price > walletBalance) {
        Alert.alert("Insufficient Balance", "Please choose a different payment method.")
        return
      }

      if (selectedPaymentMethod === "wallet") {
        setWalletBalance((prev) => prev - selectedTrip.price)
      }

      // In a real app, you would process the payment here
      Alert.alert("Payment Successful", "Your payment has been processed successfully.")
      setShowPaymentModal(false)
    }
  }

  // Apply filters to trips
  const applyFilters = () => {
    setShowFilters(false)
    fetchTrips()
  }

  // Reset filters
  const resetFilters = () => {
    setFilterDate(null)
    setFilterDateString("")
    setFilterLocation("")
    setFilterDestination("")
    setShowFilters(false)
    fetchTrips()
  }

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    setFilterDate(date)
    const formattedDate = date.toISOString().split("T")[0]
    setFilterDateString(formattedDate)
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  // Initialize data
  useEffect(() => {
    if (token) {
      fetchTrips()
      fetchMyBookings()
    }
  }, [passengerId, token])

  // Custom date picker for Android compatibility
  const CustomDatePicker = () => {
    const [year, setYear] = useState(
      filterDate ? filterDate.getFullYear().toString() : new Date().getFullYear().toString(),
    )
    const [month, setMonth] = useState(
      filterDate
        ? (filterDate.getMonth() + 1).toString().padStart(2, "0")
        : (new Date().getMonth() + 1).toString().padStart(2, "0"),
    )
    const [day, setDay] = useState(
      filterDate ? filterDate.getDate().toString().padStart(2, "0") : new Date().getDate().toString().padStart(2, "0"),
    )

    const handleSave = () => {
      const newDate = new Date(`${year}-${month}-${day}T00:00:00`)
      if (!isNaN(newDate.getTime())) {
        handleDateSelect(newDate)
        setShowDatePicker(false)
      } else {
        Alert.alert("Invalid Date", "Please enter a valid date")
      }
    }

    return (
      <View className="bg-white p-4 rounded-lg">
        <Text className="text-lg font-bold mb-4">Select Date</Text>

        <View className="flex-row justify-between mb-4">
          <View className="flex-1 mr-2">
            <Text className="mb-1">Day</Text>
            <TextInput
              className="border border-gray-300 rounded p-2"
              value={day}
              onChangeText={setDay}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View className="flex-1 mx-2">
            <Text className="mb-1">Month</Text>
            <TextInput
              className="border border-gray-300 rounded p-2"
              value={month}
              onChangeText={setMonth}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View className="flex-1 ml-2">
            <Text className="mb-1">Year</Text>
            <TextInput
              className="border border-gray-300 rounded p-2"
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>

        <View className="flex-row justify-end">
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded mr-2" onPress={() => setShowDatePicker(false)}>
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-blue-500 px-4 py-2 rounded" onPress={handleSave}>
            <Text className="text-white">Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Filter trips based on search query and filters
  const filteredTrips = trips.filter((trip) => {
    // Search query filter
    const matchesSearch =
      trip.departureLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.destinationLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trip.driver?.username?.toLowerCase() || "").includes(searchQuery.toLowerCase())

    // Location filter
    const matchesLocation = filterLocation
      ? trip.departureLocation.toLowerCase().includes(filterLocation.toLowerCase())
      : true

    // Destination filter
    const matchesDestination = filterDestination
      ? trip.destinationLocation.toLowerCase().includes(filterDestination.toLowerCase())
      : true

    // Date filter
    let matchesDate = true
    if (filterDate) {
      const tripDate = new Date(trip.departureDate)
      const filterDateObj = new Date(filterDate)
      matchesDate =
        tripDate.getFullYear() === filterDateObj.getFullYear() &&
        tripDate.getMonth() === filterDateObj.getMonth() &&
        tripDate.getDate() === filterDateObj.getDate()
    }

    return matchesSearch && matchesLocation && matchesDestination && matchesDate
  })

  // Check if a trip is already booked by the passenger
  const isAlreadyBooked = (trip: Trip) => {
    return trip.bookedSeats && trip.bookedSeats.includes(passengerId)
  }

  // Render trip item
  const renderTripItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      className="bg-white rounded-lg p-4 mb-3 shadow-sm border border-gray-100"
      onPress={() => {
        setSelectedTrip(item)
        setShowTripDetails(true)
      }}
    >
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center">
          <FontAwesome5 name="car" size={16} color="#4285F4" />
          <Text className="ml-2 font-bold text-base">{item.driver?.username || "Unknown Driver"}</Text>
        </View>
        <Text className="text-green-600 font-bold">NPR {item.price}</Text>
      </View>

      <View className="flex-row justify-between mb-2">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Ionicons name="location" size={16} color="green" />
            <Text className="ml-1 text-gray-700">{item.departureLocation}</Text>
          </View>
          <View className="flex-row items-center mt-1">
            <Ionicons name="location" size={16} color="red" />
            <Text className="ml-1 text-gray-700">{item.destinationLocation}</Text>
          </View>
        </View>
        <View className="ml-2">
          <Text className="text-gray-600">{formatDate(item.departureDate)}</Text>
          <Text className="text-gray-600">{item.departureTime}</Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-gray-100">
        <View className="flex-row items-center">
          <Ionicons name="people" size={16} color="#4285F4" />
          <Text className="ml-1 text-gray-600">
            {item.seatsAvailable} seat{item.seatsAvailable !== 1 ? "s" : ""} available
          </Text>
        </View>
        <View className="flex-row">
          {item.preferences.smoking && (
            <MaterialIcons name="smoking-rooms" size={16} color="gray" style={{ marginLeft: 8 }} />
          )}
          {item.preferences.pets && <Ionicons name="paw" size={16} color="gray" style={{ marginLeft: 8 }} />}
          {item.preferences.music && <Ionicons name="musical-notes" size={16} color="gray" style={{ marginLeft: 8 }} />}
        </View>
      </View>
    </TouchableOpacity>
  )

  // Render booking item
  const renderBookingItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      className="bg-white rounded-lg p-4 mb-3 shadow-sm border border-gray-100"
      onPress={() => {
        setSelectedTrip(item)
        setShowTripDetails(true)
      }}
    >
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center">
          <FontAwesome5 name="car" size={16} color="#4285F4" />
          <Text className="ml-2 font-bold text-base">{item.driver?.username || "Unknown Driver"}</Text>
        </View>
        <View className="bg-blue-100 px-2 py-1 rounded">
          <Text className="text-blue-700 font-medium text-xs">{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View className="flex-row justify-between mb-2">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Ionicons name="location" size={16} color="green" />
            <Text className="ml-1 text-gray-700">{item.departureLocation}</Text>
          </View>
          <View className="flex-row items-center mt-1">
            <Ionicons name="location" size={16} color="red" />
            <Text className="ml-1 text-gray-700">{item.destinationLocation}</Text>
          </View>
        </View>
        <View className="ml-2">
          <Text className="text-gray-600">{formatDate(item.departureDate)}</Text>
          <Text className="text-gray-600">{item.departureTime}</Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-gray-100">
        <Text className="text-green-600 font-bold">NPR {item.price}</Text>
        <TouchableOpacity
          className="bg-red-500 px-3 py-1 rounded"
          onPress={() => {
            Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
              { text: "No", style: "cancel" },
              { text: "Yes", onPress: () => cancelBooking(item._id) },
            ])
          }}
        >
          <Text className="text-white font-medium">Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-4 px-4 shadow-sm">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <Text className="text-xl font-bold">Scheduled Rides</Text>
          <TouchableOpacity onPress={() => setShowFilters(true)}>
            <Ionicons name="filter" size={24} color="#4285F4" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="mt-4 flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search" size={20} color="gray" />
          <TextInput
            className="flex-1 ml-2 text-base"
            placeholder="Search trips..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="gray" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View className="flex-row mt-4">
          <TouchableOpacity
            className={`flex-1 py-2 ${activeTab === "available" ? "border-b-2 border-blue-500" : ""}`}
            onPress={() => setActiveTab("available")}
          >
            <Text
              className={`text-center font-medium ${activeTab === "available" ? "text-blue-500" : "text-gray-500"}`}
            >
              Available Trips
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 ${activeTab === "bookings" ? "border-b-2 border-blue-500" : ""}`}
            onPress={() => {
              setActiveTab("bookings")
              fetchMyBookings()
            }}
          >
            <Text className={`text-center font-medium ${activeTab === "bookings" ? "text-blue-500" : "text-gray-500"}`}>
              My Bookings
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      ) : (
        <View className="flex-1 px-4 pt-4">
          {activeTab === "available" ? (
            filteredTrips.length > 0 ? (
              <FlatList
                data={filteredTrips}
                renderItem={renderTripItem}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            ) : (
              <View className="flex-1 justify-center items-center">
                <Ionicons name="car-outline" size={64} color="gray" />
                <Text className="mt-4 text-gray-500 text-center">No trips available matching your criteria</Text>
                {(searchQuery || filterDate || filterLocation || filterDestination) && (
                  <TouchableOpacity className="mt-4 bg-blue-500 px-4 py-2 rounded-lg" onPress={resetFilters}>
                    <Text className="text-white font-medium">Clear Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          ) : myBookings.length > 0 ? (
            <FlatList
              data={myBookings}
              renderItem={renderBookingItem}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          ) : (
            <View className="flex-1 justify-center items-center">
              <Ionicons name="calendar-outline" size={64} color="gray" />
              <Text className="mt-4 text-gray-500 text-center">You haven't booked any trips yet</Text>
              <TouchableOpacity
                className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
                onPress={() => setActiveTab("available")}
              >
                <Text className="text-white font-medium">Browse Available Trips</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-3xl p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold">Filter Trips</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <Text className="font-medium mb-2">Departure Date</Text>
            <TouchableOpacity
              className="border border-gray-200 rounded-lg p-3 mb-4 flex-row justify-between items-center"
              onPress={() => setShowDatePicker(true)}
            >
              <Text className="text-gray-700">{filterDateString ? formatDate(filterDateString) : "Select date"}</Text>
              <Ionicons name="calendar" size={20} color="#4285F4" />
            </TouchableOpacity>

            {showDatePicker && (
              <View className="mb-4">
                <CustomDatePicker />
              </View>
            )}

            <Text className="font-medium mb-2">Departure Location</Text>
            <TextInput
              className="border border-gray-200 rounded-lg p-3 mb-4"
              placeholder="Enter departure location"
              value={filterLocation}
              onChangeText={setFilterLocation}
            />

            <Text className="font-medium mb-2">Destination</Text>
            <TextInput
              className="border border-gray-200 rounded-lg p-3 mb-4"
              placeholder="Enter destination"
              value={filterDestination}
              onChangeText={setFilterDestination}
            />

            <View className="flex-row mt-2">
              <TouchableOpacity className="flex-1 bg-gray-200 py-3 rounded-lg mr-2" onPress={resetFilters}>
                <Text className="text-center font-medium">Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-blue-500 py-3 rounded-lg ml-2" onPress={applyFilters}>
                <Text className="text-center text-white font-medium">Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Trip Details Modal */}
      <Modal
        visible={showTripDetails}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTripDetails(false)}
      >
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View className="bg-white rounded-t-3xl p-5" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedTrip && (
                <>
                  <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-xl font-bold">Trip Details</Text>
                    <TouchableOpacity onPress={() => setShowTripDetails(false)}>
                      <Ionicons name="close" size={24} color="black" />
                    </TouchableOpacity>
                  </View>

                  <View className="bg-gray-50 p-4 rounded-lg mb-4">
                    <View className="flex-row justify-between items-center mb-2">
                      <View className="flex-row items-center">
                        <FontAwesome5 name="user-circle" size={20} color="#4285F4" />
                        <Text className="ml-2 font-bold text-base">
                          {selectedTrip.driver?.username || "Unknown Driver"}
                        </Text>
                      </View>
                      <Text className="text-gray-600">{selectedTrip.driver?.phone || "N/A"}</Text>
                    </View>

                    <View className="flex-row items-center mt-2">
                      <Ionicons name="car" size={20} color="#4285F4" />
                      <Text className="ml-2 text-gray-700">
                        {selectedTrip.vehicleDetails.model} ({selectedTrip.vehicleDetails.color})
                      </Text>
                    </View>
                    <Text className="ml-7 text-gray-700">Plate: {selectedTrip.vehicleDetails.plateNumber}</Text>
                  </View>

                  <View className="mb-4">
                    <Text className="font-bold text-base mb-2">Trip Information</Text>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="location" size={20} color="green" />
                      <Text className="ml-2 text-gray-700">{selectedTrip.departureLocation}</Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="location" size={20} color="red" />
                      <Text className="ml-2 text-gray-700">{selectedTrip.destinationLocation}</Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="calendar" size={20} color="#4285F4" />
                      <Text className="ml-2 text-gray-700">
                        {formatDate(selectedTrip.departureDate)} at {selectedTrip.departureTime}
                      </Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="people" size={20} color="#4285F4" />
                      <Text className="ml-2 text-gray-700">
                        {selectedTrip.seatsAvailable} seat{selectedTrip.seatsAvailable !== 1 ? "s" : ""} available
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="cash" size={20} color="green" />
                      <Text className="ml-2 font-bold text-green-600">NPR {selectedTrip.price}</Text>
                    </View>
                  </View>

                  {selectedTrip.description && (
                    <View className="mb-4">
                      <Text className="font-bold text-base mb-2">Description</Text>
                      <Text className="text-gray-700">{selectedTrip.description}</Text>
                    </View>
                  )}

                  <View className="mb-4">
                    <Text className="font-bold text-base mb-2">Preferences</Text>
                    <View className="flex-row flex-wrap">
                      <View className="flex-row items-center mr-4 mb-2">
                        <MaterialIcons
                          name="smoking-rooms"
                          size={20}
                          color={selectedTrip.preferences.smoking ? "green" : "gray"}
                        />
                        <Text className="ml-1 text-gray-700">
                          {selectedTrip.preferences.smoking ? "Smoking allowed" : "No smoking"}
                        </Text>
                      </View>
                      <View className="flex-row items-center mr-4 mb-2">
                        <Ionicons name="paw" size={20} color={selectedTrip.preferences.pets ? "green" : "gray"} />
                        <Text className="ml-1 text-gray-700">
                          {selectedTrip.preferences.pets ? "Pets allowed" : "No pets"}
                        </Text>
                      </View>
                      <View className="flex-row items-center mb-2">
                        <Ionicons
                          name="musical-notes"
                          size={20}
                          color={selectedTrip.preferences.music ? "green" : "gray"}
                        />
                        <Text className="ml-1 text-gray-700">
                          {selectedTrip.preferences.music ? "Music allowed" : "No music"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {activeTab === "available" ? (
                    <TouchableOpacity
                      className={`py-3 rounded-lg ${
                        isAlreadyBooked(selectedTrip) ? "bg-gray-300" : bookingLoading ? "bg-blue-300" : "bg-blue-500"
                      }`}
                      onPress={() => {
                        if (!isAlreadyBooked(selectedTrip)) {
                          Alert.alert("Confirm Booking", "Are you sure you want to book this trip?", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Book",
                              onPress: () => {
                                bookTrip(selectedTrip._id)
                                // Show payment modal after booking
                                setShowPaymentModal(true)
                              },
                            },
                          ])
                        }
                      }}
                      disabled={isAlreadyBooked(selectedTrip) || bookingLoading}
                    >
                      {bookingLoading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="text-center text-white font-bold text-lg">
                          {isAlreadyBooked(selectedTrip) ? "Already Booked" : "Book Now"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      className={`py-3 rounded-lg ${bookingLoading ? "bg-red-300" : "bg-red-500"}`}
                      onPress={() => {
                        Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
                          { text: "No", style: "cancel" },
                          { text: "Yes", onPress: () => cancelBooking(selectedTrip._id) },
                        ])
                      }}
                      disabled={bookingLoading}
                    >
                      {bookingLoading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="text-center text-white font-bold text-lg">Cancel Booking</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="w-4/5 bg-white rounded-xl p-5 items-center">
            <Text className="text-lg font-bold mb-2">Payment</Text>
            <Text className="text-base mb-2 text-center">Please complete your payment for this trip.</Text>
            <Text className="text-xl font-bold mb-4">Amount to Pay: NPR {selectedTrip?.price || 0}</Text>

            <View className="w-full mb-4">
              <Text className="text-base font-medium mb-2">Select Payment Method:</Text>
              <TouchableOpacity
                className={`flex-row items-center p-3 rounded-lg mb-2 ${
                  selectedPaymentMethod === "cash" ? "bg-blue-500" : "bg-gray-100"
                }`}
                onPress={() => setSelectedPaymentMethod("cash")}
              >
                <MaterialIcons
                  name="attach-money"
                  size={20}
                  color={selectedPaymentMethod === "cash" ? "white" : "black"}
                />
                <Text className={`ml-2 ${selectedPaymentMethod === "cash" ? "text-white" : "text-black"}`}>Cash</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-row items-center p-3 rounded-lg ${
                  selectedPaymentMethod === "wallet"
                    ? "bg-blue-500"
                    : (selectedTrip?.price || 0) > walletBalance
                      ? "bg-gray-200"
                      : "bg-gray-100"
                }`}
                onPress={() => setSelectedPaymentMethod("wallet")}
                disabled={(selectedTrip?.price || 0) > walletBalance}
              >
                <MaterialIcons
                  name="account-balance-wallet"
                  size={20}
                  color={
                    (selectedTrip?.price || 0) > walletBalance
                      ? "gray"
                      : selectedPaymentMethod === "wallet"
                        ? "white"
                        : "black"
                  }
                />
                <Text
                  className={`ml-2 ${
                    (selectedTrip?.price || 0) > walletBalance
                      ? "text-gray-500"
                      : selectedPaymentMethod === "wallet"
                        ? "text-white"
                        : "text-black"
                  }`}
                >
                  Wallet (NPR {walletBalance})
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity className="bg-green-600 py-3 rounded-lg w-full items-center" onPress={handlePayment}>
              <Text className="text-white font-bold text-lg">Pay Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

export default PassengerReserveBooking

