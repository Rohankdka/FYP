"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { View, Text, ScrollView, Alert, TouchableOpacity, FlatList, ActivityIndicator, Platform } from "react-native"
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps"
import * as Location from "expo-location"
import { useLocalSearchParams, useRouter } from "expo-router"
import axios from "axios"
import getSocket from "../components/socket"
import { Ionicons, MaterialIcons, FontAwesome } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import NotificationBadge from "../components/notification-badge"
import NotificationPanel from "../components/notification-panel"

const API_URL = "http://192.168.46.143:3001"
const GOOGLE_MAPS_API_KEY = "AIzaSyAfVD-fFk1aa4yy4YFesrLIXhxwNHhQtxU"

interface Coordinates {
  latitude: number
  longitude: number
}

interface Ride {
  _id?: string
  passengerId: string
  pickupLocation: string
  dropoffLocation: string
  pickupLocationName: string
  dropoffLocationName: string
  status: string
  distance?: number
  estimatedTime?: number
  vehicleType?: string
  fare?: number
  paymentMethod?: string
  paymentStatus?: string
  passenger?: { phone: string; username: string }
  createdAt?: string
}

const DriverDashboard = () => {
  const { driverId } = useLocalSearchParams<{ driverId: string }>()
  const router = useRouter()
  const mapRef = useRef<MapView | null>(null)
  const locationSubscription = useRef<Location.LocationSubscription | null>(null)
  const socket = useRef(getSocket())
  const isInitialMount = useRef(true)
  const isOnlineRef = useRef(false)

  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null)
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<Coordinates | null>(null)
  const [routeCoords, setRouteCoords] = useState<Coordinates[]>([])
  const [activeRide, setActiveRide] = useState<Ride | null>(null)
  const [rideRequests, setRideRequests] = useState<Ride[]>([])
  const [isOnline, setIsOnline] = useState<boolean>(false)
  const [showRideHistory, setShowRideHistory] = useState<boolean>(false)
  const [rideHistory, setRideHistory] = useState<Ride[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [paymentReceived, setPaymentReceived] = useState<boolean>(false)
  const [mapError, setMapError] = useState<boolean>(false)
  const [passengerInfo, setPassengerInfo] = useState<{
    username: string
    phone: string
  } | null>(null)
  const [showNotifications, setShowNotifications] = useState<boolean>(false)
  const [token, setToken] = useState<string | null>(null)
  const [rideStatusUpdates, setRideStatusUpdates] = useState<string[]>([])
  const [notificationCount, setNotificationCount] = useState<number>(0)
  const [driverLocation, setDriverLocation] = useState<Coordinates | null>(null)

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

  // Get current location
  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status === "granted") {
      try {
        const location = await Location.getCurrentPositionAsync({})
        setCurrentLocation(location)

        // Start watching position if online
        if (isOnlineRef.current && !locationSubscription.current) {
          startLocationTracking()
        }
      } catch (error) {
        console.error("Error getting location:", error)
        Alert.alert("Location Error", "Unable to get your current location. Please check your device settings.")
      }
    }
  }

  // Start tracking location
  const startLocationTracking = async () => {
    if (locationSubscription.current) {
      await locationSubscription.current.remove()
    }

    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // Update every 10 meters
      },
      (newLocation) => {
        setCurrentLocation(newLocation)
        setDriverLocation({
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude,
        })

        // Emit location update to server only if online
        if (isOnlineRef.current && driverId) {
          socket.current.emit("driver-location-update", {
            driverId,
            location: {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
            },
          })
        }
      },
    )
  }

  // Stop tracking location
  const stopLocationTracking = async () => {
    if (locationSubscription.current) {
      await locationSubscription.current.remove()
      locationSubscription.current = null
    }
  }

  const calculateRoute = async (pickup: Coordinates, dropoff: Coordinates) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.latitude},${pickup.longitude}&destination=${dropoff.latitude},${dropoff.longitude}&key=${GOOGLE_MAPS_API_KEY}`,
      )

      // Check if routes exist and have valid data
      if (
        !response.data.routes ||
        response.data.routes.length === 0 ||
        !response.data.routes[0].legs ||
        response.data.routes[0].legs.length === 0
      ) {
        console.error("Invalid route data received:", response.data)
        return
      }

      const route = response.data.routes[0]

      // Decode the polyline to get route coordinates
      const points = decodePolyline(route.overview_polyline.points)
      const routeCoords = points.map((point) => ({
        latitude: point[0],
        longitude: point[1],
      }))

      setRouteCoords(routeCoords)

      // Fit map to show both pickup and dropoff
      if (mapRef.current) {
        mapRef.current.fitToCoordinates([pickup, dropoff], {
          edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
          animated: true,
        })
      }
    } catch (error) {
      console.error("Error calculating route:", error)
    }
  }

  // Function to decode Google's encoded polyline
  const decodePolyline = (encoded: string): [number, number][] => {
    const poly: [number, number][] = []
    let index = 0,
      lat = 0,
      lng = 0

    while (index < encoded.length) {
      let b,
        shift = 0,
        result = 0

      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      const dlat = result & 1 ? ~(result >> 1) : result >> 1
      lat += dlat

      shift = 0
      result = 0

      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      const dlng = result & 1 ? ~(result >> 1) : result >> 1
      lng += dlng

      poly.push([lat / 1e5, lng / 1e5])
    }

    return poly
  }

  const fetchRideHistory = async () => {
    try {
      setIsLoading(true)

      // Ensure driverId is a string
      const id =
        typeof driverId === "object"
          ? (driverId as any)._id
            ? (driverId as any)._id.toString()
            : String(driverId)
          : String(driverId)

      const response = await axios.get(`${API_URL}/ride/history?userId=${id}&userType=driver`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      })

      // Ensure passenger data is populated for each ride
      const ridesWithPassengerData = await Promise.all(
        response.data.map(async (ride: Ride) => {
          if (!ride.passenger && ride.passengerId) {
            try {
              // Ensure passengerId is a valid string
              const passengerId =
                typeof ride.passengerId === "object"
                  ? (ride.passengerId as any)._id
                    ? (ride.passengerId as any)._id.toString()
                    : String(ride.passengerId)
                  : String(ride.passengerId)

              // Skip invalid IDs
              if (!passengerId || passengerId === "undefined" || passengerId === "null") {
                return {
                  ...ride,
                  passenger: { username: "Unknown", phone: "N/A" },
                }
              }

              const passengerResponse = await axios.get(`${API_URL}/users/${passengerId}`, {
                headers: {
                  Authorization: token ? `Bearer ${token}` : "",
                },
              })
              return {
                ...ride,
                passenger: {
                  username: passengerResponse.data.username || "Unknown",
                  phone: passengerResponse.data.phone || "N/A",
                },
              }
            } catch (error) {
              console.error("Error fetching passenger for ride history:", error)
              return {
                ...ride,
                passenger: { username: "Unknown", phone: "N/A" },
              }
            }
          }
          return ride
        }),
      )

      setRideHistory(ridesWithPassengerData)
      setIsLoading(false)
    } catch (error) {
      console.error("Error fetching ride history:", error)
      Alert.alert("Error", "Failed to fetch ride history")
      setIsLoading(false)
    }
  }

  // Fix the fetchPassengerInfo function to properly handle ObjectId
  const fetchPassengerInfo = async (passengerId: string) => {
    try {
      console.log("Fetching passenger info for ID:", passengerId)

      // Check if we have a valid token
      if (!token) {
        console.log("No auth token available, retrieving token first")
        const authToken = await AsyncStorage.getItem("token")
        if (authToken) {
          setToken(authToken)
        }
      }

      // Ensure passengerId is a string and handle ObjectId objects
      let id = passengerId
      if (typeof passengerId === "object") {
        id = (passengerId as any)._id ? (passengerId as any)._id.toString() : String(passengerId)
      }

      // Log the ID we're using for debugging
      console.log("Using passenger ID for API call:", id)

      // Make sure id is a valid ObjectId
      if (!id || id === "undefined" || id === "null") {
        console.error("Invalid passenger ID:", id)
        setPassengerInfo({
          username: "Unknown",
          phone: "N/A",
        })
        return
      }

      const response = await axios.get(`${API_URL}/users/${id}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      })

      if (response.data) {
        console.log("Passenger info retrieved successfully:", response.data)
        setPassengerInfo({
          username: response.data.username || "Unknown",
          phone: response.data.phone || "N/A",
        })
      }
    } catch (error) {
      console.error("Error fetching passenger info:", error)

      // Set default values if fetch fails
      setPassengerInfo({
        username: "Unknown",
        phone: "N/A",
      })

      // Try to fetch from active ride if available
      if (activeRide && activeRide.passenger) {
        console.log("Using passenger info from active ride")
        setPassengerInfo({
          username: activeRide.passenger.username || "Unknown",
          phone: activeRide.passenger.phone || "N/A",
        })
      }
    }
  }

  // Modify the checkForActiveRide function to fetch passenger info
  const checkForActiveRide = async () => {
    try {
      const response = await axios.get(`${API_URL}/ride/active?userId=${driverId}&userType=driver`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      })
      if (response.data) {
        const ride = response.data

        // Check if payment has been received
        if (ride.status === "completed" && ride.paymentStatus === "completed") {
          setPaymentReceived(true)
        }

        setActiveRide(ride)

        // Add status update based on ride status
        let statusMessage = ""
        switch (ride.status) {
          case "accepted":
            statusMessage = "You've accepted this ride. Head to pickup location."
            break
          case "picked up":
            statusMessage = "Passenger picked up. Heading to destination."
            break
          case "completed":
            statusMessage =
              ride.paymentStatus === "completed"
                ? "Ride completed. Payment received."
                : "Ride completed. Waiting for payment."
            break
          default:
            statusMessage = `Current ride status: ${ride.status}`
        }

        setRideStatusUpdates([statusMessage])

        // Fetch passenger info if not included in the response
        if (ride.passengerId && (!ride.passenger || !ride.passenger.username)) {
          fetchPassengerInfo(ride.passengerId)
        } else if (ride.passenger) {
          setPassengerInfo({
            username: ride.passenger.username || "Unknown",
            phone: ride.passenger.phone || "N/A",
          })
        }

        // Get pickup and dropoff coordinates
        const [pickupLat, pickupLng] = ride.pickupLocation.split(",").map(Number)
        const [dropoffLat, dropoffLng] = ride.dropoffLocation.split(",").map(Number)

        setPickupCoords({ latitude: pickupLat, longitude: pickupLng })
        setDropoffCoords({ latitude: dropoffLat, longitude: dropoffLng })

        // Calculate route
        calculateRoute({ latitude: pickupLat, longitude: pickupLng }, { latitude: dropoffLat, longitude: dropoffLng })

        // Set online status to true if there's an active ride
        if (!isOnlineRef.current) {
          setIsOnline(true)
          isOnlineRef.current = true
          socket.current.emit("driver-online", driverId)
        }
      }
    } catch (error) {
      // Only log the error if it's not a 404 (no active ride)
      if (axios.isAxiosError(error) && error.response?.status !== 404) {
        console.error("Error checking for active ride:", error)
      }
    }
  }

  const navigateToReserveBooking = () => {
    router.push(`/Dashboard/driverReserveBookings?driverId=${driverId}`)
  }

  // Setup socket event handlers
  const setupSocketEvents = useCallback(() => {
    const currentSocket = socket.current

    // Join user's notification room
    currentSocket.emit("join-user", driverId)

    // Remove any existing listeners to prevent duplicates
    currentSocket.off("ride-request")
    currentSocket.off("ride-notification")
    currentSocket.off("ride-status")
    currentSocket.off("payment-received")
    currentSocket.off("active-ride-found")
    currentSocket.off("new-notification")
    currentSocket.off("notifications-count")

    // Set up new listeners
    currentSocket.on("ride-request", (ride: Ride) => {
      if (isOnlineRef.current && (!ride.vehicleType || ride.vehicleType === "Bike")) {
        // Only add to requests if not already in the list and not already accepted
        setRideRequests((prev) => {
          // Don't add if already in the list
          if (prev.some((r) => r._id === ride._id)) {
            return prev
          }

          // Don't add if this is the active ride
          if (activeRide && activeRide._id === ride._id) {
            return prev
          }

          Alert.alert("New Ride Request", `From: ${ride.passenger?.username || "Unknown"}`)
          return [...prev, ride]
        })
      }
    })

    currentSocket.on("ride-notification", ({ message }: { message: string }) => {
      Alert.alert("Ride Update", message)
      // Don't add duplicate messages
      setRideStatusUpdates((prev) => {
        if (!prev.includes(message)) {
          return [...prev, message]
        }
        return prev
      })
    })

    // Also fix the ride-status event handler to handle payment status updates
    currentSocket.on(
      "ride-status",
      (data: {
        rideId: string
        status: string
        paymentStatus?: string
      }) => {
        console.log("Ride status update received:", data)

        // Add status update based on status change
        let statusMessage = ""
        switch (data.status) {
          case "accepted":
            statusMessage = "You've accepted this ride. Head to pickup location."
            break
          case "picked up":
            statusMessage = "Passenger picked up. Heading to destination."
            break
          case "completed":
            statusMessage =
              data.paymentStatus === "completed"
                ? "Ride completed. Payment received."
                : "Ride completed. Waiting for payment."
            break
          case "canceled":
            statusMessage = "Ride has been canceled."
            break
          default:
            statusMessage = `Ride status updated to: ${data.status}`
        }

        // Don't add duplicate status messages
        setRideStatusUpdates((prev) => {
          if (!prev.includes(statusMessage)) {
            return [...prev, statusMessage]
          }
          return prev
        })

        setActiveRide((prev) => {
          if (prev && prev._id === data.rideId) {
            // If payment status is provided, update it
            if (data.paymentStatus) {
              if (data.paymentStatus === "completed") {
                setPaymentReceived(true)
              }
              return {
                ...prev,
                status: data.status,
                paymentStatus: data.paymentStatus,
              }
            }
            return { ...prev, status: data.status }
          }
          return prev
        })

        // If ride is canceled, clear active ride
        if (data.status === "canceled") {
          setActiveRide(null)
          setPickupCoords(null)
          setDropoffCoords(null)
          setRouteCoords([])
          setPassengerInfo(null)
          setRideStatusUpdates([])
          Alert.alert("Ride Canceled", "The passenger has canceled this ride.")
        }
      },
    )

    // Fix the payment-received event handler to properly update the UI
    currentSocket.on(
      "payment-received",
      ({
        rideId,
        message,
        paymentStatus,
        paymentMethod,
      }: {
        rideId: string
        message: string
        paymentStatus?: string
        paymentMethod?: string
      }) => {
        console.log("Payment received event:", { rideId, message, paymentStatus, paymentMethod })

        if (activeRide && activeRide._id === rideId) {
          // Set payment received state
          setPaymentReceived(true)

          // Update the active ride with payment status and method
          setActiveRide((prev) => {
            if (prev) {
              return {
                ...prev,
                paymentStatus: paymentStatus || "completed",
                paymentMethod: paymentMethod || prev.paymentMethod,
              }
            }
            return prev
          })

          Alert.alert("Payment Received", message, [
            {
              text: "OK",
              onPress: () => {
                // Add status update to show we're resetting
                setRideStatusUpdates((prev) => {
                  const resetMessage = "Resetting dashboard..."
                  if (!prev.includes(resetMessage)) {
                    return [...prev, resetMessage]
                  }
                  return prev
                })

                // Clear active ride after payment is received with a delay
                setTimeout(() => {
                  // Reset all state variables to initial values
                  setActiveRide(null)
                  setPickupCoords(null)
                  setDropoffCoords(null)
                  setRouteCoords([])
                  setPassengerInfo(null)
                  setPaymentReceived(false)
                  setRideStatusUpdates([])
                  setDriverLocation(null)

                  // Make sure we're still online but ready for new rides
                  if (isOnlineRef.current) {
                    // Emit driver-online to ensure server knows we're available
                    socket.current.emit("driver-online", driverId)
                  }

                  // Refresh ride history if showing
                  if (showRideHistory) {
                    fetchRideHistory()
                  }
                }, 2000) // 2 second delay to give driver time to see the confirmation
              },
            },
          ])

          // Update status message to reflect payment received
          setRideStatusUpdates((prev) => {
            const paymentMessage = "Payment received. Ride completed successfully."
            if (!prev.includes(paymentMessage)) {
              return [...prev, paymentMessage]
            }
            return prev
          })
        }
      },
    )

    // Modify the setupSocketEvents function to handle passenger info
    currentSocket.on("active-ride-found", ({ ride }: { ride: Ride }) => {
      // Check if payment has been received
      if (ride.status === "completed" && ride.paymentStatus === "completed") {
        setPaymentReceived(true)
      }

      setActiveRide(ride)

      // Store passenger info or fetch if not included
      if (ride.passengerId && (!ride.passenger || !ride.passenger.username)) {
        fetchPassengerInfo(ride.passengerId)
      } else if (ride.passenger) {
        setPassengerInfo({
          username: ride.passenger.username || "Unknown",
          phone: ride.passenger.phone || "N/A",
        })
      }

      // Get pickup and dropoff coordinates
      const [pickupLat, pickupLng] = ride.pickupLocation.split(",").map(Number)
      const [dropoffLat, dropoffLng] = ride.dropoffLocation.split(",").map(Number)

      setPickupCoords({ latitude: pickupLat, longitude: pickupLng })
      setDropoffCoords({ latitude: dropoffLat, longitude: dropoffLng })

      // Calculate route
      calculateRoute({ latitude: pickupLat, longitude: pickupLng }, { latitude: dropoffLat, longitude: dropoffLng })

      // Add status update based on ride status
      let statusMessage = ""
      switch (ride.status) {
        case "accepted":
          statusMessage = "You've accepted this ride. Head to pickup location."
          break
        case "picked up":
          statusMessage = "Passenger picked up. Heading to destination."
          break
        case "completed":
          statusMessage =
            ride.paymentStatus === "completed"
              ? "Ride completed. Payment received."
              : "Ride completed. Waiting for payment."
          break
        default:
          statusMessage = `Current ride status: ${ride.status}`
      }

      setRideStatusUpdates([statusMessage])
    })

    // Listen for new notifications
    currentSocket.on("new-notification", (notification: any) => {
      console.log("New notification received:", notification)

      // Check if this is a payment notification and update ride status
      if (notification.type === "payment_received" && activeRide) {
        setPaymentReceived(true)

        // Update the active ride with payment status
        setActiveRide((prev) => {
          if (prev) {
            return {
              ...prev,
              paymentStatus: "completed",
            }
          }
          return prev
        })

        // Update status message to reflect payment received
        setRideStatusUpdates((prev) => {
          const paymentMessage = "Payment received. Ride completed successfully."
          if (!prev.includes(paymentMessage)) {
            return [...prev, paymentMessage]
          }
          return prev
        })
      }

      // Refresh notification count
      currentSocket.emit("get-notifications-count", driverId)
    })

    // Listen for notification count updates
    currentSocket.on("notifications-count", ({ count }: { count: number }) => {
      setNotificationCount(count)
    })

    return () => {
      // Clean up listeners
      currentSocket.off("ride-request")
      currentSocket.off("ride-notification")
      currentSocket.off("ride-status")
      currentSocket.off("payment-received")
      currentSocket.off("active-ride-found")
      currentSocket.off("new-notification")
      currentSocket.off("notifications-count")
    }
  }, [activeRide, driverId, showRideHistory])

  // Main effect for initialization
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      getLocation()
      setupSocketEvents()
      checkForActiveRide()

      // Get initial notification count
      if (driverId && socket.current) {
        socket.current.emit("get-notifications-count", driverId)
      }
    }

    // Set up periodic checking for active ride
    const activeRideInterval = setInterval(() => {
      if (!activeRide) {
        checkForActiveRide()
      }
    }, 10000) // Check every 10 seconds

    return () => {
      clearInterval(activeRideInterval)
    }
  }, [driverId, setupSocketEvents, activeRide])

  // Effect for online status changes
  useEffect(() => {
    isOnlineRef.current = isOnline

    if (isOnline) {
      socket.current.emit("driver-online", driverId)
      startLocationTracking()
    } else {
      socket.current.emit("driver-offline", driverId)
      stopLocationTracking()
    }

    // Cleanup function
    return () => {
      if (isOnlineRef.current) {
        socket.current.emit("driver-offline", driverId)
      }
    }
  }, [isOnline, driverId])

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopLocationTracking()
      if (isOnlineRef.current) {
        socket.current.emit("driver-offline", driverId)
      }
    }
  }, [driverId])

  const toggleOnlineStatus = () => {
    if (isOnline) {
      setIsOnline(false)
      setRideRequests([])
      Alert.alert("Status", "You are now offline")
    } else {
      setIsOnline(true)
      getLocation() // Start location tracking
      Alert.alert("Status", "You are now online")
    }
  }

  const handleStatusUpdate = async (status: string) => {
    if (activeRide && activeRide._id) {
      try {
        const response = await axios.put(
          `${API_URL}/ride/update`,
          {
            rideId: activeRide._id,
            status,
          },
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : "",
            },
          },
        )

        // Add status update
        let statusMessage = ""
        switch (status) {
          case "picked up":
            statusMessage = "Passenger picked up. Heading to destination."
            break
          case "completed":
            statusMessage = "Ride completed. Waiting for payment."
            break
          case "canceled":
            statusMessage = "You've canceled this ride."
            break
          default:
            statusMessage = `Ride status updated to: ${status}`
        }

        // Don't add duplicate status messages
        setRideStatusUpdates((prev) => {
          if (!prev.includes(statusMessage)) {
            return [...prev, statusMessage]
          }
          return prev
        })

        // Update local state
        setActiveRide((prev) => (prev ? { ...prev, status } : null))

        // Emit status update to server
        socket.current.emit("ride-status-update", {
          rideId: activeRide._id,
          status,
          // Calculate fare when ride is completed
          fare:
            status === "completed"
              ? calculateFare(activeRide.distance || 0, activeRide.vehicleType || "Bike")
              : undefined,
        })

        // If ride is completed, wait for payment
        if (status === "completed") {
          Alert.alert("Ride Completed", "Waiting for passenger payment...")
        }
      } catch (error) {
        console.error("Error updating ride status:", error)
        Alert.alert("Error", "Failed to update ride status")
      }
    }
  }

  // Handle map errors
  const handleMapError = () => {
    setMapError(true)
    console.error("MapView error occurred")
  }

  const RideRequestCard = ({ ride }: { ride: Ride }) => (
    <View className="p-3 bg-white rounded-lg my-1.5 border border-gray-200">
      <Text className="text-base font-bold mb-2">New Ride Request</Text>
      <View className="flex-row justify-between mb-1">
        <Text>Passenger: {ride.passenger?.username || "Unknown"}</Text>
        <Text>Phone: {ride.passenger?.phone || "N/A"}</Text>
      </View>
      <View className="mb-2">
        <View className="flex-row items-center mb-1">
          <Ionicons name="location" size={16} color="green" />
          <Text className="ml-1 flex-1">{ride.pickupLocationName}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="location" size={16} color="red" />
          <Text className="ml-1 flex-1">{ride.dropoffLocationName}</Text>
        </View>
      </View>
      <View className="flex-row justify-between mb-1">
        <Text>Distance: {ride.distance?.toFixed(1)} km</Text>
        <Text>ETA: {ride.estimatedTime} min</Text>
      </View>
      {ride.vehicleType && <Text>Vehicle Type: {ride.vehicleType}</Text>}
      {ride.fare && ride.fare > 0 ? (
        <Text className="text-base font-bold mt-1">Fare: NPR {ride.fare}</Text>
      ) : (
        <Text className="text-base font-bold mt-1">
          Fare: NPR {calculateFare(ride.distance || 0, ride.vehicleType || "Bike")}
        </Text>
      )}
      <View className="flex-row justify-between mt-3">
        <TouchableOpacity
          className="flex-1 bg-green-600 py-2 rounded items-center mr-2"
          onPress={async () => {
            try {
              socket.current.emit("ride-response", {
                rideId: ride._id,
                driverId,
                status: "accepted",
              })

              // Store passenger info
              if (ride.passenger) {
                setPassengerInfo({
                  username: ride.passenger.username || "Unknown",
                  phone: ride.passenger.phone || "N/A",
                })
              }

              // Update local state
              setActiveRide({ ...ride, status: "accepted" })

              // Add status update
              setRideStatusUpdates(["You've accepted this ride. Head to pickup location."])

              // Remove this ride from ride requests
              setRideRequests((prev) => prev.filter((r) => r._id !== ride._id))

              // Parse coordinates
              const [pickupLat, pickupLng] = ride.pickupLocation.split(",").map(Number)
              const [dropoffLat, dropoffLng] = ride.dropoffLocation.split(",").map(Number)

              setPickupCoords({ latitude: pickupLat, longitude: pickupLng })
              setDropoffCoords({ latitude: dropoffLat, longitude: dropoffLng })

              // Calculate route
              await calculateRoute(
                { latitude: pickupLat, longitude: pickupLng },
                { latitude: dropoffLat, longitude: dropoffLng },
              )
            } catch (error) {
              console.error("Error accepting ride:", error)
              Alert.alert("Error", "Failed to accept ride")
            }
          }}
        >
          <Text className="text-white font-bold">Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-red-500 py-2 rounded items-center ml-2"
          onPress={() => {
            socket.current.emit("ride-response", {
              rideId: ride._id,
              driverId,
              status: "rejected",
            })
            setRideRequests((prev) => prev.filter((r) => r._id !== ride._id))
          }}
        >
          <Text className="text-white font-bold">Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const RideHistoryItem = ({ ride }: { ride: Ride }) => (
    <View className="p-3 bg-white rounded-lg my-1.5 border border-gray-200">
      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-600">{new Date(ride.createdAt || "").toLocaleDateString()}</Text>
        <Text
          className={`px-2 py-1 rounded text-xs font-bold ${
            ride.status === "completed"
              ? "bg-green-100 text-green-700"
              : ride.status === "canceled"
                ? "bg-red-100 text-red-700"
                : "bg-blue-100 text-blue-700"
          }`}
        >
          {ride.status.toUpperCase()}
        </Text>
      </View>
      <View className="mb-2">
        <View className="flex-row items-center mb-1">
          <Ionicons name="location" size={16} color="green" />
          <Text className="ml-1 flex-1">{ride.pickupLocationName}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="location" size={16} color="red" />
          <Text className="ml-1 flex-1">{ride.dropoffLocationName}</Text>
        </View>
      </View>
      <View className="flex-row justify-between pt-2 border-t border-gray-100">
        <Text>Passenger: {ride.passenger?.username || "Unknown"}</Text>
        <Text>Distance: {ride.distance?.toFixed(1)} km</Text>
        <Text>Fare: NPR {ride.fare || 0}</Text>
      </View>
      {ride.paymentStatus && (
        <View className="mt-1">
          <Text>
            Payment: {ride.paymentStatus.charAt(0).toUpperCase() + ride.paymentStatus.slice(1)}
            {ride.paymentMethod ? ` (${ride.paymentMethod})` : ""}
          </Text>
        </View>
      )}
    </View>
  )

  return (
    <View className="flex-1">
      {showNotifications ? (
        <NotificationPanel userId={driverId} token={token} onClose={() => setShowNotifications(false)} />
      ) : (
        <>
          {mapError ? (
            <View className="flex-1 justify-center items-center bg-gray-100 p-5">
              <Text className="text-base text-center text-gray-600">
                Unable to load map. Please check your internet connection and try again.
              </Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              provider={Platform.OS === "ios" ? undefined : PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              region={{
                latitude: currentLocation?.coords.latitude || pickupCoords?.latitude || 27.7172,
                longitude: currentLocation?.coords.longitude || pickupCoords?.longitude || 85.324,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
            >
              {currentLocation && (
                <Marker
                  coordinate={{
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                  }}
                  title="You"
                  pinColor="blue"
                >
                  <View className="bg-blue-500 p-1.5 rounded-full">
                    <FontAwesome name="car" size={20} color="white" />
                  </View>
                </Marker>
              )}
              {pickupCoords && <Marker coordinate={pickupCoords} title="Pickup" pinColor="green" />}
              {dropoffCoords && <Marker coordinate={dropoffCoords} title="Dropoff" pinColor="red" />}
              {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor="#4285F4" strokeWidth={4} />}
            </MapView>
          )}

          {!showRideHistory ? (
            <ScrollView className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-4 max-h-[60%]">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold">Driver Dashboard</Text>
                <View className="flex-row">
                  <NotificationBadge
                    userId={driverId}
                    onPress={() => setShowNotifications(true)}
                    count={notificationCount}
                  />
                  <TouchableOpacity className="p-2 mr-2 bg-blue-50 rounded-full" onPress={navigateToReserveBooking}>
                    <MaterialIcons name="event" size={24} color="#4285F4" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="p-2 bg-gray-50 rounded-full"
                    onPress={() => {
                      fetchRideHistory()
                      setShowRideHistory(true)
                    }}
                  >
                    <MaterialIcons name="history" size={24} color="black" />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row justify-between items-center p-3 bg-gray-50 rounded-lg mb-4">
                <Text className="text-base font-bold">Status: {isOnline ? "Online" : "Offline"}</Text>
                <TouchableOpacity
                  className={`py-2 px-4 rounded ${isOnline ? "bg-red-500" : "bg-green-600"}`}
                  onPress={toggleOnlineStatus}
                  disabled={activeRide !== null} // Disable toggle if there's an active ride
                >
                  <Text className="text-white font-bold">{isOnline ? "Go Offline" : "Go Online"}</Text>
                </TouchableOpacity>
              </View>

              {isOnline && rideRequests.length > 0 && (
                <View className="mb-4">
                  <Text className="text-base font-bold mb-2">Ride Requests:</Text>
                  {rideRequests.map((ride) => (
                    <RideRequestCard key={ride._id} ride={ride} />
                  ))}
                </View>
              )}

              {activeRide && (
                <View className="bg-gray-50 p-3 rounded-lg">
                  <Text className="text-base font-bold mb-2">Active Ride:</Text>
                  <View className="mb-2">
                    <Text className="text-base font-medium">Status: {activeRide.status}</Text>
                  </View>

                  {/* Status updates section */}
                  {rideStatusUpdates.length > 0 && (
                    <View className="mb-3 bg-blue-50 p-2 rounded">
                      <Text className="font-bold mb-1">Status Updates:</Text>
                      {rideStatusUpdates.map((update, index) => (
                        <Text key={index} className="text-sm mb-1">
                          • {update}
                        </Text>
                      ))}
                    </View>
                  )}

                  <View className="bg-white p-3 rounded mb-3">
                    <Text className="font-bold mb-1">
                      Passenger: {passengerInfo?.username || activeRide.passenger?.username || "Unknown"}
                    </Text>
                    <Text>Phone: {passengerInfo?.phone || activeRide.passenger?.phone || "N/A"}</Text>
                  </View>

                  <View className="mb-3">
                    <View className="flex-row items-center mb-1">
                      <Ionicons name="location" size={16} color="green" />
                      <Text className="ml-1 flex-1">{activeRide.pickupLocationName}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="location" size={16} color="red" />
                      <Text className="ml-1 flex-1">{activeRide.dropoffLocationName}</Text>
                    </View>
                  </View>

                  {activeRide.distance && activeRide.estimatedTime && (
                    <View className="flex-row flex-wrap justify-between bg-white p-2 rounded mb-3">
                      <Text>Distance: {activeRide.distance.toFixed(1)} km</Text>
                      <Text>ETA: {activeRide.estimatedTime} min</Text>
                      {activeRide.fare && activeRide.fare > 0 ? (
                        <Text className="text-base font-bold mt-1 w-full">Fare: NPR {activeRide.fare}</Text>
                      ) : (
                        <Text className="text-base font-bold mt-1 w-full">
                          Fare: NPR {calculateFare(activeRide.distance, activeRide.vehicleType || "Bike")}
                        </Text>
                      )}
                    </View>
                  )}

                  <View className="mt-2">
                    {activeRide.status === "accepted" && (
                      <TouchableOpacity
                        className="bg-blue-500 py-3 rounded-lg items-center mb-2"
                        onPress={() => handleStatusUpdate("picked up")}
                      >
                        <Text className="text-white font-bold">Picked Up</Text>
                      </TouchableOpacity>
                    )}

                    {activeRide.status === "picked up" && (
                      <TouchableOpacity
                        className="bg-blue-500 py-3 rounded-lg items-center mb-2"
                        onPress={() => handleStatusUpdate("completed")}
                      >
                        <Text className="text-white font-bold">Complete Ride</Text>
                      </TouchableOpacity>
                    )}

                    {activeRide.status !== "completed" && (
                      <TouchableOpacity
                        className="bg-red-500 py-3 rounded-lg items-center"
                        onPress={() => handleStatusUpdate("canceled")}
                      >
                        <Text className="text-white font-bold">Cancel Ride</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {activeRide.status === "completed" && !paymentReceived && (
                    <View className="flex-row items-center justify-center mt-3 p-2 bg-yellow-100 rounded">
                      <Text className="mr-2 text-yellow-800">Waiting for passenger payment...</Text>
                      <ActivityIndicator size="small" color="#4285F4" />
                    </View>
                  )}

                  {activeRide.status === "completed" &&
                    (activeRide.paymentStatus === "completed" || paymentReceived) && (
                      <View className="flex-row items-center justify-center mt-3 p-2 bg-green-100 rounded">
                        <Text className="mr-2 text-green-800">Payment received. Ride completed successfully!</Text>
                        <Ionicons name="checkmark-circle" size={20} color="green" />
                      </View>
                    )}
                </View>
              )}
            </ScrollView>
          ) : (
            <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-4 h-[70%]">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold">Ride History</Text>
                <TouchableOpacity className="p-2" onPress={() => setShowRideHistory(false)}>
                  <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
              </View>

              {isLoading ? (
                <ActivityIndicator size="large" color="#4285F4" style={{ flex: 1 }} />
              ) : rideHistory.length > 0 ? (
                <FlatList
                  data={rideHistory}
                  renderItem={({ item }) => <RideHistoryItem ride={item} />}
                  keyExtractor={(item) => item._id || ""}
                  contentContainerStyle={{ paddingBottom: 20 }}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-base text-gray-600">No ride history found</Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  )
}

// Helper function to calculate fare
const calculateFare = (distance: number, vehicleType: string): number => {
  let baseFare = 0
  let ratePerKm = 0

  switch (vehicleType) {
    case "Bike":
      baseFare = 50 // NPR
      ratePerKm = 15
      break
    case "Car":
      baseFare = 100
      ratePerKm = 30
      break
    case "Electric":
      baseFare = 80
      ratePerKm = 25
      break
    default:
      baseFare = 50
      ratePerKm = 15
  }

  return Math.round(baseFare + distance * ratePerKm)
}

export default DriverDashboard

