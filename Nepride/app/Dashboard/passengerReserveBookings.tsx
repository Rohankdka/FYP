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
import getSocket from "../components/socket"
import NotificationBadge from "../components/notification-badge"
import NotificationPanel from "../components/notification-panel"

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

interface Notification {
  _id: string
  userId: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

const PassengerReserveBooking = () => {
  const { passengerId } = useLocalSearchParams<{ passengerId: string }>()
  const router = useRouter()
  const socket = getSocket()

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
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

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

  // Setup socket connection
  useEffect(() => {
    if (passengerId) {
      console.log("Setting up socket connection for passenger:", passengerId)

      // Join passenger's notification room if not already joined
      if (!socket.hasEmitted) {
        socket.emit("join-user", passengerId)
        socket.hasEmitted = true
      }

      // Listen for trip updates
      const handleTripUpdated = (data: any) => {
        console.log("Trip updated:", data)
        // Refresh trips and bookings
        fetchTrips()
        fetchMyBookings()
      }

      // Listen for new notifications
      const handleNewNotification = (notification: Notification) => {
        console.log("New notification received:", notification)
        setNotifications((prev) => [notification, ...prev])
        setUnreadNotifications((prev) => prev + 1)

        // Show alert for important notifications
        if (
          ["trip_update", "trip_cancelled", "trip_completed", "booking_confirmed", "booking_cancelled"].includes(
            notification.type,
          )
        ) {
          Alert.alert(notification.title, notification.message)
        }
      }

      // Get initial notifications count
      socket.emit("get-notifications-count", passengerId)

      const handleNotificationsCount = (data: { count: number }) => {
        console.log("Notifications count received:", data)
        setUnreadNotifications(data.count)
      }

      // Add event listeners
      socket.on("trip-updated", handleTripUpdated)
      socket.on("trip-deleted", () => fetchTrips())
      socket.on("new-trip", () => fetchTrips())
      socket.on("new-notification", handleNewNotification)
      socket.on("notifications-count", handleNotificationsCount)
      socket.on("booking-confirmed", () => {
        fetchTrips()
        fetchMyBookings()
      })

      return () => {
        // Remove event listeners when component unmounts
        socket.off("trip-updated", handleTripUpdated)
        socket.off("trip-deleted")
        socket.off("new-trip")
        socket.off("new-notification", handleNewNotification)
        socket.off("notifications-count", handleNotificationsCount)
        socket.off("booking-confirmed")
      }
    }
  }, [passengerId])

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
      console.log("Fetched trips:", response.data.length)

      // Only filter by status to show all scheduled trips
      const filteredTrips = response.data.filter((trip: Trip) => {
        return trip.status === "scheduled"
      })

      console.log("Filtered trips:", filteredTrips.length)
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

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!token) {
      console.error("No token available for fetching notifications")
      return
    }

    try {
      // Make sure we're sending the userId as a query parameter
      const response = await axios.get(`${API_URL}/notifications/user?userId=${passengerId}`, getAuthHeaders())

      console.log("Notifications fetched:", response.data.length)
      setNotifications(response.data)

      // Count unread notifications
      const unread = response.data.filter((notification: { read: any }) => !notification.read).length
      setUnreadNotifications(unread)
    } catch (error) {
      console.error("Error fetching notifications:", error)

      // Check if it's an authentication error
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Alert.alert("Authentication Error", "Your session has expired. Please log in again.")
      }
    }
  }

  // Mark notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await axios.put(`${API_URL}/notifications/${notificationId}/read`, {}, getAuthHeaders())

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) =>
          notification._id === notificationId ? { ...notification, read: true } : notification,
        ),
      )

      // Update unread count
      setUnreadNotifications((prev) => Math.max(0, prev - 1))

      // Update notification count in socket
      socket.emit("get-notifications-count", passengerId)
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  // Mark all notifications as read
  const markAllNotificationsAsRead = async () => {
    try {
      await axios.put(
        `${API_URL}/notifications/read-all`,
        { userId: passengerId }, // Include userId in the request body
        getAuthHeaders(),
      )

      // Update local state
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))

      // Reset unread count
      setUnreadNotifications(0)

      // Update notification count in socket
      socket.emit("get-notifications-count", passengerId)
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  // Process payment
  const processPayment = async (tripId: string, amount: number) => {
    try {
      // Since there's no specific payment endpoint in the backend,
      // we'll just simulate a successful payment and return true
      console.log("Processing payment:", {
        tripId,
        passengerId,
        amount,
        paymentMethod: selectedPaymentMethod,
      })

      // Emit payment event to socket
      socket.emit("payment-event", {
        tripId,
        passengerId,
        amount,
        method: selectedPaymentMethod,
      })

      return true
    } catch (error) {
      console.error("Error processing payment:", error)
      Alert.alert("Payment Error", "Failed to process payment. Please try again.")
      return false
    }
  }

  // Book a seat on a trip
  const bookTrip = async (trip: Trip) => {
    if (!token) {
      Alert.alert("Authentication Required", "Please log in to book a trip.")
      return
    }

    // Check if passenger already has a booking for this trip
    const existingBooking = myBookings.some((booking) => booking._id === trip._id)
    if (existingBooking) {
      Alert.alert("Already Booked", "You have already booked this trip.")
      return
    }

    // Show payment modal to process payment first
    setSelectedTrip(trip)
    setShowPaymentModal(true)
  }

  // Handle payment and booking
  const handlePayment = async (paymentMethod: string) => {
    if (!selectedTrip || !passengerId) return

    try {
      setShowPaymentModal(false)
      setLoading(true)

      // Process payment first
      const paymentSuccess = await processPayment(selectedTrip._id, selectedTrip.price)

      if (paymentSuccess) {
        // Then book the seat
        const response = await axios.post(
          `${API_URL}/trip/${selectedTrip._id}/book/${passengerId}`,
          {},
          getAuthHeaders(),
        )

        console.log("Booking response:", response.data)

        // Emit booking event
        socket.emit("trip-booked", {
          tripId: selectedTrip._id,
          passengerId: passengerId,
        })

        Alert.alert("Booking Successful", "Your seat has been booked successfully!", [
          {
            text: "View My Bookings",
            onPress: () => {
              setActiveTab("bookings")
              fetchMyBookings()
            },
          },
          { text: "OK" },
        ])

        // Refresh available trips
        fetchTrips()
        setShowTripDetails(false)
      }
    } catch (error) {
      console.error("Error booking trip:", error)
      Alert.alert("Booking Failed", "Failed to book the trip. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const cancelBooking = async (bookingId: string) => {
    if (!token) return

    try {
      // The correct endpoint for canceling a booking
      const response = await axios.delete(`${API_URL}/trip/${bookingId}/cancel/${passengerId}`, getAuthHeaders())

      console.log("Booking cancelled:", response.data)

      // Emit booking cancelled event to socket
      socket.emit("booking-cancelled", {
        bookingId: bookingId,
        tripId: bookingId, // In this API, the bookingId is actually the tripId
        passengerId: passengerId,
      })

      Alert.alert("Success", "Booking cancelled successfully!")

      // Refresh bookings
      fetchMyBookings()
      fetchTrips()
    } catch (error) {
      console.error("Error cancelling booking:", error)
      Alert.alert("Error", "Failed to cancel booking. Please try again.")
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

  // Format date for notification display
  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.round(diffMs / 60000)
    const diffHours = Math.round(diffMs / 3600000)
    const diffDays = Math.round(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  // Initialize data
  useEffect(() => {
    if (token) {
      fetchTrips()
      fetchMyBookings()
      fetchNotifications()
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
      // Make sure all values are properly formatted
      const formattedYear = year.trim()
      const formattedMonth = month.trim().padStart(2, "0")
      const formattedDay = day.trim().padStart(2, "0")

      // Create date string in ISO format
      const dateString = `${formattedYear}-${formattedMonth}-${formattedDay}T00:00:00`
      console.log("Creating date from string:", dateString)

      const newDate = new Date(dateString)

      // Validate the date
      if (!isNaN(newDate.getTime())) {
        console.log("Valid date created:", newDate.toISOString())
        handleDateSelect(newDate)
        setShowDatePicker(false)
      } else {
        console.error("Invalid date:", {
          year: formattedYear,
          month: formattedMonth,
          day: formattedDay,
        })
        Alert.alert("Invalid Date", "Please enter a valid date (YYYY-MM-DD)")
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
    return trip.bookedSeats && Array.isArray(trip.bookedSeats) && trip.bookedSeats.includes(passengerId as string)
  }

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "trip_update":
        return <Ionicons name="refresh" size={18} color="white" />
      case "trip_cancelled":
        return <Ionicons name="close-circle" size={18} color="white" />
      case "trip_completed":
        return <Ionicons name="checkmark-circle" size={18} color="white" />
      case "payment_completed":
        return <Ionicons name="cash" size={18} color="white" />
      default:
        return <Ionicons name="notifications" size={18} color="white" />
    }
  }

  // Get notification icon background color based on type
  const getNotificationIconBg = (type: string) => {
    switch (type) {
      case "trip_update":
        return "bg-blue-500"
      case "trip_cancelled":
        return "bg-red-500"
      case "trip_completed":
        return "bg-green-500"
      case "payment_completed":
        return "bg-green-600"
      default:
        return "bg-gray-500"
    }
  }

  // Render notification item
  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      className={`p-3 mb-2 rounded-lg ${item.read ? "bg-gray-50" : "bg-blue-50"}`}
      onPress={() => markNotificationAsRead(item._id)}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-row items-center">
          <View className={`p-2 rounded-full ${getNotificationIconBg(item.type)}`}>
            {getNotificationIcon(item.type)}
          </View>
          <View className="ml-2 flex-1">
            <Text className="font-bold">{item.title}</Text>
            <Text className="text-gray-700 mt-1">{item.message}</Text>
            <Text className="text-gray-500 text-xs mt-1">{formatNotificationDate(item.createdAt)}</Text>
          </View>
        </View>
        {!item.read && <View className="bg-blue-500 h-3 w-3 rounded-full mt-1" />}
      </View>
    </TouchableOpacity>
  )

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
        {item.status === "scheduled" && (
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
        )}
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
          <View className="flex-row">
            <TouchableOpacity
              className="mr-3 relative"
              onPress={() => {
                fetchNotifications()
                setShowNotifications(true)
              }}
            >
              <NotificationBadge
                userId={passengerId as string}
                count={unreadNotifications}
                onPress={() => {
                  fetchNotifications()
                  setShowNotifications(true)
                }}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowFilters(true)}>
              <Ionicons name="filter" size={24} color="#4285F4" />
            </TouchableOpacity>
          </View>
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

      {/* Notifications Panel */}
      {showNotifications && (
        <NotificationPanel userId={passengerId as string} token={token} onClose={() => setShowNotifications(false)} />
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
                        {selectedTrip.seatsAvailable} seat
                        {selectedTrip.seatsAvailable !== 1 ? "s" : ""} available
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
                          bookTrip(selectedTrip)
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
                    selectedTrip.status === "scheduled" && (
                      <TouchableOpacity
                        className={`py-3 rounded-lg ${bookingLoading ? "bg-red-300" : "bg-red-500"}`}
                        onPress={() => {
                          Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
                            { text: "No", style: "cancel" },
                            {
                              text: "Yes",
                              onPress: () => cancelBooking(selectedTrip._id),
                            },
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
                    )
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

            <TouchableOpacity
              className="bg-green-600 py-3 rounded-lg w-full items-center"
              onPress={() => handlePayment(selectedPaymentMethod)}
            >
              <Text className="text-white font-bold text-lg">Pay Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

export default PassengerReserveBooking

