"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Platform,
  Linking,
  AppState,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";
import getSocket from "../components/socket";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NotificationBadge from "../components/notification-badge";
import NotificationPanel from "../components/notification-panel";
import PaymentModal from "../components/payment-modal";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";

const API_URL = "http://192.168.1.70:3001";
const API_BASE_URL = "http://192.168.1.70:3001/api";
const GOOGLE_MAPS_API_KEY = "AIzaSyAfVD-fFk1aa4yy4YFesrLIXhxwNHhQtxU";

// Make sure WebBrowser can complete auth sessions
WebBrowser.maybeCompleteAuthSession();

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Ride {
  _id?: string;
  passengerId: string;
  driverId?: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLocationName: string;
  dropoffLocationName: string;
  status: string;
  distance?: number;
  estimatedTime?: number;
  vehicleType?: string;
  fare?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  createdAt?: string;
  driver?: any;
}

interface Driver {
  _id: string;
  fullName: string;
  vehicleType: string;
  numberPlate?: string;
  user?: {
    _id: string;
    username: string;
    phone: string;
  };
  currentLocation?: Coordinates;
  estimatedArrival?: number; // in minutes
  isOnline?: boolean; // Added to track online status
}

const PassengerDashboard = () => {
  const { passengerId } = useLocalSearchParams<{ passengerId: string }>();
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const socket = useRef(getSocket());
  const isInitialMount = useRef(true);
  const appState = useRef(AppState.currentState);
  const paymentInProgress = useRef(false);
  const lastPaymentPidx = useRef<string | null>(null);

  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [pickupLocationName, setPickupLocationName] = useState<string>("");
  const [dropoffLocationName, setDropoffLocationName] = useState<string>("");
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coordinates | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coordinates[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [driverInfo, setDriverInfo] = useState<Driver | null>(null);
  const [selectedVehicleType, setSelectedVehicleType] =
    useState<string>("Bike");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDriverList, setShowDriverList] = useState<boolean>(false);
  const [showRideHistory, setShowRideHistory] = useState<boolean>(false);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [driverLocation, setDriverLocation] = useState<Coordinates | null>(
    null
  );
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [hasLocationPermission, setHasLocationPermission] =
    useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>("cash");
  const [mapError, setMapError] = useState<boolean>(false);
  const [onlineDrivers, setOnlineDrivers] = useState<{
    [key: string]: boolean;
  }>({});
  const [token, setToken] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [rideStatusUpdates, setRideStatusUpdates] = useState<string[]>([]);
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [paymentProcessing, setPaymentProcessing] = useState<boolean>(false);
  const [storedPidx, setStoredPidx] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingLocations, setIsSearchingLocations] =
    useState<boolean>(false);
  const [searchType, setSearchType] = useState<"pickup" | "dropoff" | null>(
    null
  );

  // Get auth token
  useEffect(() => {
    const getToken = async () => {
      try {
        const authToken = await AsyncStorage.getItem("token");
        setToken(authToken);
      } catch (error) {
        console.error("Error getting token:", error);
      }
    };
    getToken();
  }, []);

  // Monitor app state changes for payment verification
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        paymentInProgress.current &&
        lastPaymentPidx.current &&
        activeRide?._id
      ) {
        console.log("App has come to the foreground after payment!");
        // Verify payment immediately when app comes to foreground
        verifyKhaltiPayment(lastPaymentPidx.current, activeRide._id);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [activeRide]);

  // Function to decode Google's encoded polyline
  const decodePolyline = (encoded: string): [number, number][] => {
    const poly: [number, number][] = [];
    let index = 0,
      lat = 0,
      lng = 0;

    while (index < encoded.length) {
      let b,
        shift = 0,
        result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push([lat / 1e5, lng / 1e5]);
    }

    return poly;
  };

  // Set up deep link handler for payment verification
  useEffect(() => {
    // Function to handle deep links
    const handleDeepLink = async (event: { url: string }) => {
      console.log("Deep link received in PassengerDashboard:", event.url);

      try {
        // Parse the URL
        const url = new URL(event.url);

        // Check if this is a payment verification link
        if (
          url.pathname.includes("/payment/verify") ||
          (url.hostname === "payment" && url.pathname.includes("/verify"))
        ) {
          const pidx = url.searchParams.get("pidx");
          const status = url.searchParams.get("status");

          console.log("Payment verification deep link detected:", {
            pidx,
            status,
          });

          if (status === "success" || (pidx && !status)) {
            try {
              // If we have a pidx, verify it
              if (pidx && activeRide && activeRide._id) {
                // Reset payment in progress flag
                paymentInProgress.current = false;
                lastPaymentPidx.current = null;

                // Immediately verify the payment
                verifyKhaltiPayment(pidx, activeRide._id);
              }
            } catch (error) {
              console.error("Deep link handling error:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error parsing deep link URL:", error);
      }
    };

    // Add event listener for URL changes
    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Clean up
    return () => {
      subscription.remove();
    };
  }, [activeRide]);

  const geocodeLocation = async (
    locationName: string
  ): Promise<Coordinates | null> => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          locationName
        )}&key=${GOOGLE_MAPS_API_KEY}`
      );
      if (response.data.results.length > 0) {
        const { lat, lng } = response.data.results[0].geometry.location;
        return { latitude: lat, longitude: lng };
      }
      return null;
    } catch (error) {
      console.error("❌ Error geocoding location:", error);
      return null;
    }
  };

  // Search for locations using Google Places API
  const searchLocations = async (query: string, type: "pickup" | "dropoff") => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearchingLocations(true);
    setSearchType(type);

    try {
      // Use nearby search if we have current location
      let endpoint = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        query
      )}&key=${GOOGLE_MAPS_API_KEY}`;

      if (currentLocation) {
        endpoint += `&location=${currentLocation.coords.latitude},${currentLocation.coords.longitude}&radius=50000`;
      }

      const response = await axios.get(endpoint);

      if (response.data.predictions) {
        setSearchResults(response.data.predictions);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching locations:", error);
      setSearchResults([]);
    } finally {
      setIsSearchingLocations(false);
    }
  };

  // Handle location selection from search results
  const handleLocationSelect = async (place: any) => {
    try {
      // Get place details to get coordinates
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}`
      );

      if (response.data.result && response.data.result.geometry) {
        const { lat, lng } = response.data.result.geometry.location;
        const coords = { latitude: lat, longitude: lng };
        const address = place.description;

        if (searchType === "pickup") {
          setPickupLocationName(address);
          setPickupCoords(coords);
        } else if (searchType === "dropoff") {
          setDropoffLocationName(address);
          setDropoffCoords(coords);
        }
      }

      // Clear search results
      setSearchResults([]);
      setSearchType(null);
    } catch (error) {
      console.error("Error getting place details:", error);
      Alert.alert("Error", "Failed to get location details");
    }
  };

  // Use current location as pickup
  const useCurrentLocationAsPickup = async () => {
    if (!currentLocation) {
      Alert.alert("Error", "Current location not available");
      return;
    }

    try {
      // Reverse geocode to get address
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${currentLocation.coords.latitude},${currentLocation.coords.longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );

      if (response.data.results && response.data.results.length > 0) {
        const address = response.data.results[0].formatted_address;
        setPickupLocationName(address);
        setPickupCoords({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } else {
        setPickupLocationName("Current Location");
        setPickupCoords({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      }

      // Clear any search results
      setSearchResults([]);
      setSearchType(null);
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      setPickupLocationName("Current Location");
      setPickupCoords({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    }
  };

  const calculateDistanceAndETA = async (
    pickup: Coordinates,
    dropoff: Coordinates
  ): Promise<
    { distance: number; eta: number; route: Coordinates[] } | undefined
  > => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.latitude},${pickup.longitude}&destination=${dropoff.latitude},${dropoff.longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );

      // Check if routes exist and have valid data
      if (
        !response.data.routes ||
        response.data.routes.length === 0 ||
        !response.data.routes[0].legs ||
        response.data.routes[0].legs.length === 0
      ) {
        console.error("Invalid route data received:", response.data);
        return undefined;
      }

      const route = response.data.routes[0];
      const distanceKm = route.legs[0].distance.value / 1000;
      const etaMinutes = Math.round(route.legs[0].duration.value / 60);

      // Decode the polyline to get route coordinates
      const points = decodePolyline(route.overview_polyline.points);
      const routeCoords = points.map((point) => ({
        latitude: point[0],
        longitude: point[1],
      }));

      setDistance(distanceKm);
      setEta(etaMinutes);
      return { distance: distanceKm, eta: etaMinutes, route: routeCoords };
    } catch (error) {
      console.error("Error calculating distance:", error);
      return undefined;
    }
  };

  // Fix the fetchRideHistory function to properly handle ObjectId
  const fetchRideHistory = async () => {
    try {
      setIsLoading(true);

      // Ensure passengerId is a string
      const id =
        typeof passengerId === "object"
          ? (passengerId as any)._id
            ? (passengerId as any)._id.toString()
            : String(passengerId)
          : String(passengerId);

      const response = await axios.get(
        `${API_URL}/ride/history?userId=${id}&userType=passenger`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );

      // Ensure driver data is populated for each ride
      const ridesWithDriverData = await Promise.all(
        response.data.map(async (ride: Ride) => {
          if (ride.driverId && !ride.driver) {
            try {
              // Ensure driverId is a string
              const driverId =
                typeof ride.driverId === "object"
                  ? (ride.driverId as any)._id
                    ? (ride.driverId as any)._id.toString()
                    : String(ride.driverId)
                  : String(ride.driverId);

              // Skip invalid IDs
              if (
                !driverId ||
                driverId === "undefined" ||
                driverId === "null"
              ) {
                return ride;
              }

              const driverResponse = await axios.get(
                `${API_URL}/driver/${driverId}`,
                {
                  headers: {
                    Authorization: token ? `Bearer ${token}` : "",
                  },
                }
              );
              return {
                ...ride,
                driver: driverResponse.data,
              };
            } catch (error) {
              console.error("Error fetching driver for ride history:", error);
              return ride;
            }
          }
          return ride;
        })
      );

      setRideHistory(ridesWithDriverData);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching ride history:", error);
      Alert.alert("Error", "Failed to fetch ride history");
      setIsLoading(false);
    }
  };

  const checkForActiveRide = async () => {
    try {
      console.log("Checking for active ride for passenger:", passengerId);
      const response = await axios.get(
        `${API_URL}/ride/active?userId=${passengerId}&userType=passenger`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );
      if (response.data) {
        const ride = response.data;
        console.log("Active ride found:", ride);
        setActiveRide(ride);

        // Get pickup and dropoff coordinates
        const [pickupLat, pickupLng] = ride.pickupLocation
          .split(",")
          .map(Number);
        const [dropoffLat, dropoffLng] = ride.dropoffLocation
          .split(",")
          .map(Number);

        setPickupCoords({ latitude: pickupLat, longitude: pickupLng });
        setDropoffCoords({ latitude: dropoffLat, longitude: dropoffLng });
        setPickupLocationName(ride.pickupLocationName);
        setDropoffLocationName(ride.dropoffLocationName);

        // Calculate route
        calculateDistanceAndETA(
          { latitude: pickupLat, longitude: pickupLng },
          { latitude: dropoffLat, longitude: dropoffLng }
        ).then((result) => {
          if (result) {
            setRouteCoords(result.route);
          }
        });

        // If ride is accepted, get driver info
        if (ride.status !== "requested" && ride.driverId) {
          try {
            const driverResponse = await axios.get(
              `${API_URL}/driver/${ride.driverId}`,
              {
                headers: {
                  Authorization: token ? `Bearer ${token}` : "",
                },
              }
            );
            setDriverInfo(driverResponse.data);
          } catch (driverError) {
            console.error("Error fetching driver info:", driverError);
          }
        }

        // Fit map to show both pickup and dropoff
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(
            [
              { latitude: pickupLat, longitude: pickupLng },
              { latitude: dropoffLat, longitude: dropoffLng },
            ],
            {
              edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
              animated: true,
            }
          );
        }

        // Add status update based on ride status
        let statusMessage = "";
        switch (ride.status) {
          case "requested":
            statusMessage = "Ride requested. Waiting for a driver...";
            break;
          case "accepted":
            statusMessage = "Driver has accepted your ride request!";
            break;
          case "picked up":
            statusMessage = "Driver has picked you up. Enjoy your ride!";
            break;
          case "completed":
            statusMessage = "Your ride has been completed.";
            if (ride.paymentStatus !== "completed") {
              statusMessage += " Please complete payment.";
            } else {
              statusMessage += " Payment completed.";
            }
            break;
          default:
            statusMessage = `Current ride status: ${ride.status}`;
        }

        setRideStatusUpdates((prev) => {
          if (!prev.includes(statusMessage)) {
            return [...prev, statusMessage];
          }
          return prev;
        });
      }
    } catch (error) {
      // Only log the error if it's not a 404 (no active ride)
      if (axios.isAxiosError(error) && error.response?.status !== 404) {
        console.error("Error checking for active ride:", error);
      }
    }
  };

  const handleSearch = async () => {
    if (!pickupLocationName || !dropoffLocationName) {
      Alert.alert("Error", "Please enter both pickup and dropoff locations");
      return;
    }

    setIsSearching(true);
    setAvailableDrivers([]);

    // Use existing coordinates if available, otherwise geocode
    let pickup = pickupCoords;
    let dropoff = dropoffCoords;

    if (!pickup) {
      pickup = await geocodeLocation(pickupLocationName);
    }

    if (!dropoff) {
      dropoff = await geocodeLocation(dropoffLocationName);
    }

    if (pickup && dropoff) {
      setPickupCoords(pickup);
      setDropoffCoords(dropoff);

      const distanceETA = await calculateDistanceAndETA(pickup, dropoff);

      if (distanceETA) {
        setRouteCoords(distanceETA.route);

        // Fit map to show both pickup and dropoff
        if (mapRef.current) {
          mapRef.current.fitToCoordinates([pickup, dropoff], {
            edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
            animated: true,
          });
        }

        // Search for drivers with the selected vehicle type
        try {
          const response = await axios.get(
            `${API_URL}/ride/search-drivers?vehicleType=${selectedVehicleType}&latitude=${pickup.latitude}&longitude=${pickup.longitude}`,
            {
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
              },
            }
          );

          // Calculate estimated arrival time for each driver
          const driversWithETA = await Promise.all(
            response.data.map(async (driver: Driver) => {
              // Check if driver is online
              const isOnline = onlineDrivers[driver.user?._id || ""] || false;

              // Only process online drivers with the selected vehicle type
              if (isOnline && driver.vehicleType === selectedVehicleType) {
                // If driver has location, calculate ETA
                if (driver.currentLocation) {
                  try {
                    const etaResponse = await axios.get(
                      `https://maps.googleapis.com/maps/api/directions/json?origin=${driver.currentLocation.latitude},${driver.currentLocation.longitude}&destination=${pickup.latitude},${pickup.longitude}&key=${GOOGLE_MAPS_API_KEY}`
                    );

                    if (
                      etaResponse.data.routes &&
                      etaResponse.data.routes.length > 0 &&
                      etaResponse.data.routes[0].legs &&
                      etaResponse.data.routes[0].legs.length > 0
                    ) {
                      const etaMinutes = Math.round(
                        etaResponse.data.routes[0].legs[0].duration.value / 60
                      );
                      return {
                        ...driver,
                        estimatedArrival: etaMinutes,
                        isOnline,
                      };
                    }
                    return { ...driver, estimatedArrival: null, isOnline };
                  } catch (error) {
                    console.error("Error calculating driver ETA:", error);
                    return { ...driver, estimatedArrival: null, isOnline };
                  }
                }
                return { ...driver, estimatedArrival: null, isOnline };
              }
              return null; // Skip offline drivers or wrong vehicle type
            })
          );

          // Filter out null values (offline drivers)
          const filteredDrivers = driversWithETA.filter(
            (driver) => driver !== null
          ) as Driver[];

          setAvailableDrivers(filteredDrivers);
          setShowDriverList(true);
        } catch (error) {
          console.error("Error searching for drivers:", error);
          Alert.alert("Error", "Failed to search for drivers");
        }
      }
    } else {
      Alert.alert("Error", "Unable to find one or both locations");
    }

    setIsSearching(false);
  };

  const handleRequestRide = (specificDriverId: string | null = null) => {
    if (!pickupCoords || !dropoffCoords) {
      Alert.alert("Error", "Please search for a route first");
      return;
    }

    const fare = calculateFare(distance || 0, selectedVehicleType);

    const ride = {
      passengerId,
      pickupLocation: `${pickupCoords.latitude},${pickupCoords.longitude}`,
      dropoffLocation: `${dropoffCoords.latitude},${dropoffCoords.longitude}`,
      pickupLocationName,
      dropoffLocationName,
      status: "requested",
      distance,
      estimatedTime: eta,
      vehicleType: selectedVehicleType,
      specificDriverId,
      fare,
    };

    console.log("Requesting ride:", ride);
    socket.current.emit("request-ride", ride);
    setActiveRide(ride as Ride);
    setShowDriverList(false);

    // Add status update
    setRideStatusUpdates((prev) => {
      const message = "Ride requested. Waiting for a driver...";
      if (!prev.includes(message)) {
        return [...prev, message];
      }
      return prev;
    });
  };

  const handleCancelRide = () => {
    if (activeRide && activeRide._id) {
      console.log("Canceling ride:", activeRide._id);
      socket.current.emit("ride-status-update", {
        rideId: activeRide._id,
        status: "canceled",
      });

      // Clear active ride state immediately
      setActiveRide(null);
      setDriverInfo(null);
      setDriverLocation(null);
      setRouteCoords([]);
      setPickupCoords(null);
      setDropoffCoords(null);
      setPickupLocationName("");
      setDropoffLocationName("");
      setRideStatusUpdates([]);

      Alert.alert("Ride Canceled", "Your ride has been canceled successfully.");
    }
  };

  // Handle payment with improved Khalti integration
  const handlePayment = (method: string) => {
    if (!activeRide || !activeRide._id) {
      Alert.alert("Error", "No active ride found. Please try again.");
      return;
    }

    if (method === "khalti") {
      setPaymentProcessing(true);
      paymentInProgress.current = true;

      try {
        console.log("Initializing Khalti payment for ride:", activeRide._id);

        // Try both possible endpoints for Khalti initialization
        let initPromise;

        // First try the primary endpoint
        initPromise = axios
          .get(`${API_BASE_URL}/payments/initialize/${activeRide._id}`, {
            params: {
              amount: (activeRide.fare || 0) * 100, // Amount in paisa
              passengerId: passengerId,
              timestamp: new Date().getTime(),
            },
          })
          .catch((error) => {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              // If 404, try the alternative endpoint
              console.log(
                "Primary endpoint not found, trying alternative endpoint..."
              );
              return axios.post(`${API_BASE_URL}/khalti/initialize`, {
                rideId: activeRide._id,
                amount: (activeRide.fare || 0) * 100, // Amount in paisa
                passengerId: passengerId,
              });
            }
            throw error;
          });

        initPromise
          .then(async (response) => {
            if (response.data && response.data.payment_url) {
              // Store the pidx for later verification
              const pidx = response.data.pidx;
              setStoredPidx(pidx);
              lastPaymentPidx.current = pidx;
              await Clipboard.setStringAsync(pidx);
              console.log("PIDX stored:", pidx);

              // Close payment modal before opening browser
              setShowPaymentModal(false);

              // Open Payment URL with pidx in return URL
              // Use a more specific return URL format that works better across platforms
              const returnUrl =
                Platform.OS === "ios"
                  ? `nepride://payment/verify?pidx=${pidx}&status=success`
                  : `nepride://payment/verify?pidx=${pidx}`;

              const result = await WebBrowser.openAuthSessionAsync(
                response.data.payment_url,
                returnUrl,
                {
                  showInRecents: true,
                  // Force Safari/Chrome to open in a new window
                  presentationStyle:
                    WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                }
              );

              console.log("WebBrowser result:", result);

              // If the WebBrowser doesn't redirect properly, handle it manually
              if (result.type !== "success") {
                // For Android, we'll rely on the AppState change to trigger verification
                if (Platform.OS === "ios") {
                  // For iOS, try to verify immediately
                  const clipboardPidx = await Clipboard.getStringAsync();
                  const pidxToUse =
                    storedPidx || clipboardPidx || lastPaymentPidx.current;

                  if (pidxToUse && activeRide._id) {
                    // Manually verify the payment
                    verifyKhaltiPayment(pidxToUse, activeRide._id);
                  } else {
                    // If we don't have a pidx, assume payment was cancelled
                    setPaymentProcessing(false);
                    paymentInProgress.current = false;
                    Alert.alert(
                      "Payment Cancelled",
                      "The payment process was cancelled or failed."
                    );
                  }
                }
              }
            } else {
              throw new Error(
                "Payment initialization failed - no URL received"
              );
            }
          })
          .catch((error) => {
            console.error("Error initializing Khalti payment:", error);

            // Provide more helpful error messages based on error type
            if (axios.isAxiosError(error)) {
              if (error.response?.status === 404) {
                Alert.alert(
                  "Payment Service Unavailable",
                  "The Khalti payment service is currently unavailable. Please use cash payment instead.",
                  [
                    {
                      text: "Use Cash Instead",
                      onPress: () => {
                        setSelectedPaymentMethod("cash");
                        handlePayment("cash");
                      },
                    },
                    {
                      text: "Cancel",
                      style: "cancel",
                      onPress: () => {
                        setPaymentProcessing(false);
                        paymentInProgress.current = false;
                      },
                    },
                  ]
                );
              } else {
                Alert.alert(
                  "Payment Error",
                  error.response?.data?.message ||
                    "Failed to process payment. Please try again or use cash payment."
                );
              }
            } else {
              Alert.alert(
                "Payment Error",
                error instanceof Error ? error.message : "Payment failed"
              );
            }

            setPaymentProcessing(false);
            paymentInProgress.current = false;
          });
      } catch (error) {
        console.error("Error in Khalti payment flow:", error);
        Alert.alert(
          "Payment Error",
          "An unexpected error occurred. Please try again."
        );
        setPaymentProcessing(false);
        paymentInProgress.current = false;
      }
    } else if (method === "cash") {
      // Send payment completed event to server with the selected payment method
      const paymentData = {
        rideId: activeRide._id,
        paymentMethod: method,
        passengerId: passengerId,
        fare: activeRide.fare,
      };

      console.log("Emitting payment-completed event:", paymentData);
      socket.current.emit("payment-completed", paymentData);

      // Close payment modal
      setShowPaymentModal(false);

      // Update local ride state to reflect payment
      setActiveRide((prev) => {
        if (prev) {
          return {
            ...prev,
            paymentStatus: "completed",
            paymentMethod: method,
          } as Ride;
        }
        return prev;
      });

      // Add status update
      setRideStatusUpdates((prev) => {
        const message = `Payment completed via ${method}.`;
        if (!prev.includes(message)) {
          return [...prev, message];
        }
        return prev;
      });

      // Show success message
      Alert.alert("Payment", "Payment completed successfully!", [
        {
          text: "OK",
          onPress: () => {
            // Show a temporary success message
            setRideStatusUpdates((prev) => {
              const message = "Resetting dashboard...";
              if (!prev.includes(message)) {
                return [...prev, message];
              }
              return prev;
            });

            // Reset ride state after a delay to allow user to see the confirmation
            setTimeout(() => {
              // Reset all ride-related state
              setActiveRide(null);
              setDriverInfo(null);
              setDriverLocation(null);
              setPickupCoords(null);
              setDropoffCoords(null);
              setPickupLocationName("");
              setDropoffLocationName("");
              setRideStatusUpdates([]);
              setRouteCoords([]);
              setDistance(null);
              setEta(null);
            }, 2000); // 2 second delay before resetting
          },
        },
      ]);
    }
  };

  // Helper function to verify Khalti payment with improved error handling
  const verifyKhaltiPayment = async (pidx: string, rideId: string) => {
    try {
      console.log("Verifying payment with pidx:", pidx);
      setPaymentProcessing(true);

      // Try both possible verification endpoints
      let verifyPromise;

      try {
        // First try the primary endpoint
        verifyPromise = axios.get(
          `${API_BASE_URL}/payments/verify?pidx=${pidx}`
        );
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          // If 404, try the alternative endpoint
          console.log(
            "Primary verify endpoint not found, trying alternative endpoint..."
          );
          verifyPromise = axios.post(`${API_BASE_URL}/khalti/verify`, {
            pidx,
            rideId,
          });
        } else {
          throw error;
        }
      }

      const verifyResponse = await verifyPromise;
      console.log("Verification response:", verifyResponse.data);

      // Update ride payment status directly via API
      try {
        await axios.put(`${API_URL}/ride/payment`, {
          rideId,
          paymentStatus: "completed",
          paymentMethod: "khalti",
        });
        console.log("Ride payment status updated via API");
      } catch (updateError) {
        console.error(
          "Failed to update ride payment status via API:",
          updateError
        );
      }

      if (
        verifyResponse?.data?.success ||
        verifyResponse?.data?.status === "Completed"
      ) {
        // Reset payment flags
        paymentInProgress.current = false;
        lastPaymentPidx.current = null;

        // Update local ride state
        setActiveRide((prev) => {
          if (prev) {
            return {
              ...prev,
              paymentStatus: "completed",
              paymentMethod: "khalti",
            } as Ride;
          }
          return prev;
        });

        // Add status update
        setRideStatusUpdates((prev) => {
          const message = "Payment completed via Khalti.";
          if (!prev.includes(message)) {
            return [...prev, message];
          }
          return prev;
        });

        // Close payment modal
        setShowPaymentModal(false);
        setPaymentProcessing(false);

        // Navigate to success page immediately
        router.replace({
          pathname: "/payment/success",
          params: {
            pidx,
            rideId,
            passengerId,
            amount: activeRide?.fare?.toString() || "0",
          },
        });
      } else {
        // If verification failed, navigate to failure page immediately
        paymentInProgress.current = false;
        lastPaymentPidx.current = null;
        setPaymentProcessing(false);

        router.replace({
          pathname: "/payment/failure",
          params: { passengerId },
        });
      }
    } catch (error) {
      console.error("Manual verification error:", error);
      paymentInProgress.current = false;
      lastPaymentPidx.current = null;
      setPaymentProcessing(false);

      // Navigate to failure page immediately
      router.replace({
        pathname: "/payment/failure",
        params: { passengerId },
      });
    }
  };

  const navigateToReserveBooking = () => {
    // Use absolute path to avoid routing issues on Android
    router.push({
      pathname: "/Dashboard/passengerReserveBookings",
      params: { passengerId },
    });
  };

  // Fix the setupSocketEvents function to properly handle ride status updates
  const setupSocketEvents = useCallback(() => {
    const currentSocket = socket.current;

    // Add connection event listeners
    currentSocket.on("connect", () => {
      console.log("Socket connected with ID:", currentSocket.id);
      setSocketConnected(true);

      // Join rooms after connection is established
      const id =
        typeof passengerId === "object"
          ? (passengerId as any)._id
            ? (passengerId as any)._id.toString()
            : String(passengerId)
          : String(passengerId);

      console.log("Joining rooms for passenger:", id);
      currentSocket.emit("join-user", id);
      currentSocket.emit("join", `passenger-${id}`);

      // Check for active ride after connection
      checkForActiveRide();
    });

    currentSocket.on("connect_error", (error: any) => {
      console.error("Socket connection error:", error);
      setSocketConnected(false);
    });

    currentSocket.on("disconnect", (reason: any) => {
      console.log("Socket disconnected:", reason);
      setSocketConnected(false);
    });

    // Remove any existing listeners to prevent duplicates
    currentSocket.off("driver-available");
    currentSocket.off("ride-status");
    currentSocket.off("driver-location-update");
    currentSocket.off("ride-notification");
    currentSocket.off("ride-completed");
    currentSocket.off("active-ride-found");
    currentSocket.off("new-notification");
    currentSocket.off("notifications-count");
    currentSocket.off("payment-completed");
    currentSocket.off("payment-confirmation");

    // Set up new listeners with improved logging
    currentSocket.on(
      "ride-status",
      (data: {
        status: string;
        rideId?: string;
        fare?: number;
        driverId?: string;
        paymentStatus?: string;
      }) => {
        console.log(
          "Ride status update received in passenger dashboard:",
          data
        );

        // Add status update to the list
        let statusMessage = "";
        switch (data.status) {
          case "accepted":
            statusMessage = "Driver has accepted your ride request!";
            break;
          case "picked up":
            statusMessage = "Driver has picked you up. Enjoy your ride!";
            break;
          case "completed":
            statusMessage = "Your ride has been completed.";
            if (data.paymentStatus !== "completed") {
              statusMessage += " Please complete payment.";
            } else {
              statusMessage += " Payment completed.";
            }
            break;
          case "canceled":
            statusMessage = "Your ride has been canceled.";
            break;
          default:
            statusMessage = `Ride status updated to: ${data.status}`;
        }

        // Don't add duplicate status messages
        setRideStatusUpdates((prev) => {
          if (!prev.includes(statusMessage)) {
            return [...prev, statusMessage];
          }
          return prev;
        });

        setActiveRide((prev) => {
          if (prev && (prev._id === data.rideId || !prev._id)) {
            return {
              ...prev,
              _id: data.rideId || prev._id,
              status: data.status,
              fare: data.fare || prev.fare,
              driverId: data.driverId || prev.driverId,
              paymentStatus: data.paymentStatus || prev.paymentStatus,
            };
          }
          return prev;
        });

        if (data.status === "accepted" && data.driverId) {
          // Ensure driverId is a string
          const driverId =
            typeof data.driverId === "object"
              ? (data.driverId as any)._id
                ? (data.driverId as any)._id.toString()
                : String(data.driverId)
              : String(data.driverId);

          // Fetch driver info
          axios
            .get(`${API_URL}/driver/${driverId}`, {
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
              },
            })
            .then((driverResponse) => {
              setDriverInfo(driverResponse.data);
              // Alert the user that a driver has accepted
              Alert.alert(
                "Ride Accepted",
                "A driver has accepted your ride request!"
              );
            })
            .catch((error) => {
              console.error("Error fetching driver info:", error);
              Alert.alert("Error", "Failed to fetch driver info");
            });
        } else if (data.status === "picked up") {
          // Alert the user that they've been picked up
          Alert.alert(
            "Picked Up",
            "Your driver has picked you up. Enjoy your ride!"
          );
        }

        // If ride is canceled, clear active ride
        if (data.status === "canceled") {
          setActiveRide(null);
          setDriverInfo(null);
          setDriverLocation(null);
          setRouteCoords([]);
          setPickupCoords(null);
          setDropoffCoords(null);
          setPickupLocationName("");
          setDropoffLocationName("");
          setRideStatusUpdates([]);
        }
      }
    );

    currentSocket.on(
      "driver-available",
      (data: {
        driverId: string;
        status: string;
        vehicleType: string;
        location: Coordinates | null;
      }) => {
        // Update online drivers tracking
        setOnlineDrivers((prev) => ({
          ...prev,
          [data.driverId]: data.status === "online",
        }));

        if (
          data.status === "online" &&
          data.vehicleType === selectedVehicleType
        ) {
          setAvailableDrivers((prev) => {
            // Check if driver already exists in the list
            const driverExists = prev.some(
              (driver) => driver.user?._id === data.driverId
            );
            if (!driverExists) {
              // Fetch driver details
              axios
                .get(`${API_URL}/driver/${data.driverId}`, {
                  headers: {
                    Authorization: token ? `Bearer ${token}` : "",
                  },
                })
                .then((response) => {
                  const driverData = response.data;
                  setAvailableDrivers((current) => [
                    ...current,
                    {
                      ...driverData,
                      currentLocation: data.location,
                      estimatedArrival: 0, // Will be calculated later
                      isOnline: true,
                    },
                  ]);
                })
                .catch((error) =>
                  console.error("Error fetching driver details:", error)
                );
            }
            return prev;
          });
        } else if (data.status === "offline") {
          setAvailableDrivers((prev) =>
            prev.filter((driver) => driver.user?._id !== data.driverId)
          );
        }
      }
    );

    currentSocket.on(
      "driver-location-update",
      (data: { rideId: string; location: Coordinates }) => {
        console.log("Driver location update received:", data);
        if (activeRide && (activeRide._id === data.rideId || !activeRide._id)) {
          setDriverLocation(data.location);
        }
      }
    );

    currentSocket.on(
      "ride-notification",
      ({ message }: { message: string }) => {
        console.log("Ride notification received:", message);
        Alert.alert("Ride Update", message);
        // Don't add duplicate messages
        setRideStatusUpdates((prev) => {
          if (!prev.includes(message)) {
            return [...prev, message];
          }
          return prev;
        });
      }
    );

    currentSocket.on(
      "ride-completed",
      ({
        message,
        fare,
        rideId,
      }: {
        message: string;
        fare: number;
        rideId: string;
      }) => {
        console.log("Ride completed event received:", {
          message,
          fare,
          rideId,
        });
        Alert.alert("Ride Completed", message);

        // Update active ride with the correct fare and ID
        setActiveRide((prev) => {
          if (prev) {
            const updatedRide = {
              ...prev,
              _id: rideId || prev._id,
              fare,
              status: "completed",
            };
            console.log("Updated active ride:", updatedRide);
            return updatedRide;
          }
          return prev;
        });

        // Add status update
        const statusMessage = "Ride completed. Please complete payment.";
        setRideStatusUpdates((prev) => {
          if (!prev.includes(statusMessage)) {
            return [...prev, statusMessage];
          }
          return prev;
        });
      }
    );

    currentSocket.on(
      "active-ride-found",
      ({ ride, driverInfo }: { ride: Ride; driverInfo?: Driver }) => {
        console.log("Active ride found:", ride);
        setActiveRide(ride);
        if (driverInfo) {
          setDriverInfo(driverInfo);
        }

        // Get pickup and dropoff coordinates
        const [pickupLat, pickupLng] = ride.pickupLocation
          .split(",")
          .map(Number);
        const [dropoffLat, dropoffLng] = ride.dropoffLocation
          .split(",")
          .map(Number);

        setPickupCoords({ latitude: pickupLat, longitude: pickupLng });
        setDropoffCoords({ latitude: dropoffLat, longitude: dropoffLng });
        setPickupLocationName(ride.pickupLocationName);
        setDropoffLocationName(ride.dropoffLocationName);

        // Calculate route
        calculateDistanceAndETA(
          { latitude: pickupLat, longitude: pickupLng },
          { latitude: dropoffLat, longitude: dropoffLng }
        ).then((result) => {
          if (result) {
            setRouteCoords(result.route);
          }
        });

        // Add status update based on ride status
        let statusMessage = "";
        switch (ride.status) {
          case "requested":
            statusMessage = "Ride requested. Waiting for a driver...";
            break;
          case "accepted":
            statusMessage = "Driver has accepted your ride request!";
            break;
          case "picked up":
            statusMessage = "Driver has picked you up. Enjoy your ride!";
            break;
          case "completed":
            statusMessage = "Your ride has been completed.";
            if (ride.paymentStatus !== "completed") {
              statusMessage += " Please complete payment.";
            } else {
              statusMessage += " Payment completed.";
            }
            break;
          default:
            statusMessage = `Current ride status: ${ride.status}`;
        }

        setRideStatusUpdates([statusMessage]);
      }
    );

    currentSocket.on("new-notification", (notification: any) => {
      console.log("New notification received:", notification);
      // Refresh notification count with proper ID handling
      const id =
        typeof passengerId === "object"
          ? (passengerId as any)._id
            ? (passengerId as any)._id.toString()
            : String(passengerId)
          : passengerId;
      currentSocket.emit("get-notifications-count", id);
    });

    currentSocket.on("notifications-count", ({ count }: { count: number }) => {
      console.log("Received notification count:", count);
      setNotificationCount(count);
    });

    // Add handler for payment confirmation
    currentSocket.on(
      "payment-confirmation",
      (data: { rideId: string; status: string; message: string }) => {
        console.log("Payment confirmation received:", data);

        if (activeRide && activeRide._id === data.rideId) {
          setActiveRide((prev) => {
            if (prev) {
              return {
                ...prev,
                paymentStatus: "completed",
              };
            }
            return prev;
          });

          // Add status update
          setRideStatusUpdates((prev) => {
            const message = "Payment confirmed by the system.";
            if (!prev.includes(message)) {
              return [...prev, message];
            }
            return prev;
          });

          Alert.alert("Payment Confirmation", data.message, [
            {
              text: "OK",
              onPress: () => {
                // Show a temporary success message
                setRideStatusUpdates((prev) => {
                  const message = "Resetting dashboard...";
                  if (!prev.includes(message)) {
                    return [...prev, message];
                  }
                  return prev;
                });

                // Reset ride state after a delay
                setTimeout(() => {
                  // Reset all ride-related state
                  setActiveRide(null);
                  setDriverInfo(null);
                  setDriverLocation(null);
                  setPickupCoords(null);
                  setDropoffCoords(null);
                  setPickupLocationName("");
                  setDropoffLocationName("");
                  setRideStatusUpdates([]);
                  setRouteCoords([]);
                  setDistance(null);
                  setEta(null);
                }, 2000); // 2 second delay before resetting
              },
            },
          ]);
        }
      }
    );

    return () => {
      // Clean up listeners
      currentSocket.off("driver-available");
      currentSocket.off("ride-status");
      currentSocket.off("driver-location-update");
      currentSocket.off("ride-notification");
      currentSocket.off("ride-completed");
      currentSocket.off("active-ride-found");
      currentSocket.off("new-notification");
      currentSocket.off("notifications-count");
      currentSocket.off("payment-confirmation");
    };
  }, [passengerId, selectedVehicleType, activeRide, token, showRideHistory]);

  // Get current location
  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setHasLocationPermission(status === "granted");
    if (status === "granted") {
      try {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
        setPickupCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.error("Error getting location:", error);
        Alert.alert(
          "Location Error",
          "Unable to get your current location. Please check your device settings."
        );
      }
    }
  };

  // Reconnect socket if disconnected
  useEffect(() => {
    if (!socketConnected) {
      console.log("Socket disconnected, attempting to reconnect...");
      const currentSocket = socket.current;

      if (currentSocket) {
        currentSocket.connect();
      }
    }
  }, [socketConnected]);

  // Main effect for initialization
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      getLocation();

      // Initialize socket connection
      const currentSocket = socket.current;
      if (currentSocket) {
        // Force reconnect to ensure fresh connection
        if (currentSocket.connected) {
          currentSocket.disconnect();
        }
        currentSocket.connect();
      }

      setupSocketEvents();
      checkForActiveRide();

      // Get initial notification count
      if (passengerId && socket.current) {
        // Ensure passengerId is a string
        const id =
          typeof passengerId === "object"
            ? (passengerId as any)._id
              ? (passengerId as any)._id.toString()
              : String(passengerId)
            : passengerId;
        console.log("Getting initial notification count for user:", id);
        socket.current.emit("get-notifications-count", id);
      }
    }

    // Set up periodic checking for active ride
    const activeRideInterval = setInterval(() => {
      if (!activeRide && socketConnected) {
        checkForActiveRide();
      }
    }, 10000); // Check every 10 seconds

    // Set up periodic socket connection check
    const socketCheckInterval = setInterval(() => {
      const currentSocket = socket.current;
      if (currentSocket && !currentSocket.connected) {
        console.log("Socket not connected, attempting to reconnect...");
        currentSocket.connect();
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(activeRideInterval);
      clearInterval(socketCheckInterval);
    };
  }, [setupSocketEvents, activeRide, socketConnected]);

  // Effect for socket events
  useEffect(() => {
    const cleanup = setupSocketEvents();
    return cleanup;
  }, [setupSocketEvents]);

  // Handle map errors
  const handleMapError = () => {
    setMapError(true);
    console.error("MapView error occurred");
  };

  const DriverCard = ({ driver }: { driver: Driver }) => (
    <View className="p-3 bg-white rounded-lg my-1.5 border border-gray-200">
      <Text className="text-base font-bold mb-1">
        {driver.fullName || "Unknown Driver"}
      </Text>
      <View className="flex-row justify-between mb-1">
        <Text>Vehicle: {driver.vehicleType || "N/A"}</Text>
        {driver.numberPlate ? <Text>Plate: {driver.numberPlate}</Text> : null}
      </View>
      <View className="flex-row justify-between mb-2">
        <Text>Rating: ★★★★☆</Text>
        {driver.estimatedArrival ? (
          <Text>ETA: {driver.estimatedArrival} min</Text>
        ) : (
          <Text>ETA: Calculating...</Text>
        )}
      </View>
      <TouchableOpacity
        className="bg-green-600 py-2 rounded items-center"
        onPress={() => handleRequestRide(driver.user?._id || null)}
      >
        <Text className="text-white font-bold">Request Ride</Text>
      </TouchableOpacity>
    </View>
  );

  const RideHistoryItem = ({ ride }: { ride: Ride }) => (
    <View className="p-3 bg-white rounded-lg my-1.5 border border-gray-200">
      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-600">
          {new Date(ride.createdAt || "").toLocaleDateString()}
        </Text>
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
        <Text>Vehicle: {ride.vehicleType}</Text>
        <Text>Distance: {ride.distance?.toFixed(1)} km</Text>
        <Text>Fare: NPR {ride.fare || 0}</Text>
      </View>
      {ride.driver && (
        <View className="mt-1">
          <Text>Driver: {ride.driver.fullName || "Unknown"}</Text>
        </View>
      )}
      {ride.paymentStatus && (
        <View className="mt-1">
          <Text>
            Payment:{" "}
            {ride.paymentStatus.charAt(0).toUpperCase() +
              ride.paymentStatus.slice(1)}
            {ride.paymentMethod ? ` (${ride.paymentMethod})` : ""}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View className="flex-1">
      {!socketConnected && (
        <View className="absolute top-0 left-0 right-0 bg-red-500 p-2 z-50">
          <Text className="text-white text-center">
            Reconnecting to server...
          </Text>
        </View>
      )}

      {showNotifications ? (
        <NotificationPanel
          userId={passengerId}
          token={token}
          onClose={() => setShowNotifications(false)}
        />
      ) : (
        <>
          {mapError ? (
            <View className="flex-1 justify-center items-center bg-gray-100 p-5">
              <Text className="text-base text-center text-gray-600">
                Unable to load map. Please check your internet connection and
                try again.
              </Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              provider={Platform.OS === "ios" ? undefined : PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              region={{
                latitude:
                  pickupCoords?.latitude ||
                  currentLocation?.coords.latitude ||
                  27.7172,
                longitude:
                  pickupCoords?.longitude ||
                  currentLocation?.coords.longitude ||
                  85.324,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              onMapReady={() => console.log("Map loaded successfully")}
            >
              {currentLocation && !pickupCoords && (
                <Marker
                  coordinate={{
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                  }}
                  title="You"
                />
              )}
              {pickupCoords && (
                <Marker
                  coordinate={pickupCoords}
                  title="Pickup"
                  pinColor="green"
                />
              )}
              {dropoffCoords && (
                <Marker
                  coordinate={dropoffCoords}
                  title="Dropoff"
                  pinColor="red"
                />
              )}
              {driverLocation && (
                <Marker
                  coordinate={driverLocation}
                  title="Driver"
                  pinColor="blue"
                >
                  <View className="bg-blue-500 p-1.5 rounded-full">
                    <FontAwesome5 name="car" size={20} color="white" />
                  </View>
                </Marker>
              )}
              {routeCoords.length > 0 && (
                <Polyline
                  coordinates={routeCoords}
                  strokeColor="#4285F4"
                  strokeWidth={4}
                />
              )}
            </MapView>
          )}

          {!showRideHistory ? (
            <ScrollView className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-4 max-h-[60%]">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold">Book a Ride</Text>
                <View className="flex-row">
                  <NotificationBadge
                    userId={passengerId}
                    onPress={() => setShowNotifications(true)}
                    count={notificationCount}
                  />
                  <TouchableOpacity
                    className="p-2 mr-2 bg-blue-50 rounded-full"
                    onPress={navigateToReserveBooking}
                  >
                    <MaterialIcons name="event" size={24} color="#4285F4" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="p-2 bg-gray-50 rounded-full"
                    onPress={() => {
                      fetchRideHistory();
                      setShowRideHistory(true);
                    }}
                  >
                    <MaterialIcons name="history" size={24} color="black" />
                  </TouchableOpacity>
                </View>
              </View>

              {!activeRide ? (
                <>
                  <View className="flex-row justify-between mb-4">
                    <TouchableOpacity
                      className={`flex-1 items-center py-3 rounded-lg mx-1 border ${
                        selectedVehicleType === "Bike"
                          ? "bg-blue-500 border-blue-500"
                          : "bg-white border-gray-200"
                      }`}
                      onPress={() => setSelectedVehicleType("Bike")}
                    >
                      <Ionicons
                        name="bicycle"
                        size={24}
                        color={
                          selectedVehicleType === "Bike" ? "white" : "black"
                        }
                      />
                      <Text
                        className={`mt-1 ${
                          selectedVehicleType === "Bike"
                            ? "text-white"
                            : "text-black"
                        }`}
                      >
                        Bike
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 items-center py-3 rounded-lg mx-1 border ${
                        selectedVehicleType === "Car"
                          ? "bg-blue-500 border-blue-500"
                          : "bg-white border-gray-200"
                      }`}
                      onPress={() => setSelectedVehicleType("Car")}
                    >
                      <Ionicons
                        name="car"
                        size={24}
                        color={
                          selectedVehicleType === "Car" ? "white" : "black"
                        }
                      />
                      <Text
                        className={`mt-1 ${
                          selectedVehicleType === "Car"
                            ? "text-white"
                            : "text-black"
                        }`}
                      >
                        Car
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 items-center py-3 rounded-lg mx-1 border ${
                        selectedVehicleType === "Electric"
                          ? "bg-blue-500 border-blue-500"
                          : "bg-white border-gray-200"
                      }`}
                      onPress={() => setSelectedVehicleType("Electric")}
                    >
                      <Ionicons
                        name="flash"
                        size={24}
                        color={
                          selectedVehicleType === "Electric" ? "white" : "black"
                        }
                      />
                      <Text
                        className={`mt-1 ${
                          selectedVehicleType === "Electric"
                            ? "text-white"
                            : "text-black"
                        }`}
                      >
                        Electric
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View className="relative mb-2">
                    <View className="flex-row items-center">
                      <TextInput
                        className="h-10 border border-gray-200 rounded-lg px-2 flex-1"
                        placeholder="Pickup Location"
                        value={pickupLocationName}
                        onChangeText={(text) => {
                          setPickupLocationName(text);
                          searchLocations(text, "pickup");
                        }}
                      />
                      <TouchableOpacity
                        className="ml-2 bg-blue-500 p-2 rounded-full"
                        onPress={useCurrentLocationAsPickup}
                      >
                        <Ionicons name="locate" size={20} color="white" />
                      </TouchableOpacity>
                    </View>

                    {searchType === "pickup" && searchResults.length > 0 && (
                      <View className="absolute top-11 left-0 right-0 bg-white border border-gray-200 rounded-lg z-10 max-h-40">
                        <ScrollView>
                          {searchResults.map((place, index) => (
                            <TouchableOpacity
                              key={place.place_id || index}
                              className="p-2 border-b border-gray-100"
                              onPress={() => handleLocationSelect(place)}
                            >
                              <Text className="text-sm">
                                {place.description}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <View className="relative mb-2">
                    <TextInput
                      className="h-10 border border-gray-200 rounded-lg mb-2 px-2"
                      placeholder="Dropoff Location"
                      value={dropoffLocationName}
                      onChangeText={(text) => {
                        setDropoffLocationName(text);
                        searchLocations(text, "dropoff");
                      }}
                    />

                    {searchType === "dropoff" && searchResults.length > 0 && (
                      <View className="absolute top-11 left-0 right-0 bg-white border border-gray-200 rounded-lg z-10 max-h-40">
                        <ScrollView>
                          {searchResults.map((place, index) => (
                            <TouchableOpacity
                              key={place.place_id || index}
                              className="p-2 border-b border-gray-100"
                              onPress={() => handleLocationSelect(place)}
                            >
                              <Text className="text-sm">
                                {place.description}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {distance && eta && (
                    <View className="bg-gray-50 p-2 rounded-lg mb-3">
                      <Text className="text-sm">
                        Distance: {distance.toFixed(1)} km | ETA: {eta} min
                      </Text>
                      {selectedVehicleType && (
                        <Text className="text-base font-bold mt-1">
                          Estimated Fare: NPR{" "}
                          {calculateFare(distance, selectedVehicleType)}
                        </Text>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    className="bg-blue-500 py-3 rounded-lg items-center"
                    onPress={handleSearch}
                    disabled={isSearching}
                  >
                    {isSearching ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-bold">Search</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <View className="bg-gray-50 p-3 rounded-lg">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-base font-bold">
                      Status: {activeRide.status}
                    </Text>
                    {activeRide.status !== "completed" && (
                      <TouchableOpacity
                        className="bg-red-500 px-3 py-1.5 rounded"
                        onPress={handleCancelRide}
                      >
                        <Text className="text-white">Cancel</Text>
                      </TouchableOpacity>
                    )}
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

                  <View className="mb-3">
                    <View className="flex-row items-center mb-1">
                      <Ionicons name="location" size={16} color="green" />
                      <Text className="ml-1 flex-1">
                        {activeRide.pickupLocationName}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="location" size={16} color="red" />
                      <Text className="ml-1 flex-1">
                        {activeRide.dropoffLocationName}
                      </Text>
                    </View>
                  </View>

                  {distance && eta && (
                    <View className="bg-white p-2 rounded mb-3">
                      <Text>
                        Distance: {distance.toFixed(1)} km | ETA: {eta} min
                      </Text>
                      {activeRide.fare && activeRide.fare > 0 && (
                        <Text className="text-base font-bold mt-1">
                          Fare: NPR {activeRide.fare}
                        </Text>
                      )}
                    </View>
                  )}

                  {driverInfo && (
                    <View className="bg-white p-3 rounded-lg border border-gray-100">
                      <Text className="text-base font-bold mb-1">
                        Driver Information
                      </Text>
                      <Text>Name: {driverInfo.fullName}</Text>
                      <Text>Vehicle: {driverInfo.vehicleType}</Text>
                      {driverInfo.numberPlate && (
                        <Text>Plate: {driverInfo.numberPlate}</Text>
                      )}
                      <Text>Rating: ★★★★☆</Text>
                    </View>
                  )}

                  {activeRide.status === "completed" &&
                    activeRide.paymentStatus !== "completed" && (
                      <View className="mt-3">
                        <Text className="text-sm font-medium mb-1">
                          Select Payment Method:
                        </Text>
                        <View className="flex-row mb-2">
                          <TouchableOpacity
                            className={`flex-1 items-center py-2 rounded-lg mx-1 border ${
                              selectedPaymentMethod === "cash"
                                ? "bg-blue-500 border-blue-500"
                                : "bg-white border-gray-200"
                            }`}
                            onPress={() => setSelectedPaymentMethod("cash")}
                          >
                            <MaterialIcons
                              name="attach-money"
                              size={20}
                              color={
                                selectedPaymentMethod === "cash"
                                  ? "white"
                                  : "black"
                              }
                            />
                            <Text
                              className={`${
                                selectedPaymentMethod === "cash"
                                  ? "text-white"
                                  : "text-black"
                              }`}
                            >
                              Cash
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            className={`flex-1 items-center py-2 rounded-lg mx-1 border ${
                              selectedPaymentMethod === "khalti"
                                ? "bg-purple-600 border-purple-600"
                                : "bg-white border-gray-200"
                            }`}
                            onPress={() => setSelectedPaymentMethod("khalti")}
                          >
                            <MaterialIcons
                              name="payment"
                              size={20}
                              color={
                                selectedPaymentMethod === "khalti"
                                  ? "white"
                                  : "black"
                              }
                            />
                            <Text
                              className={`${
                                selectedPaymentMethod === "khalti"
                                  ? "text-white"
                                  : "text-black"
                              }`}
                            >
                              Khalti
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          className="bg-green-600 py-3 rounded-lg items-center"
                          onPress={() => handlePayment(selectedPaymentMethod)}
                          disabled={paymentProcessing}
                        >
                          {paymentProcessing ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Text className="text-white font-bold">
                              Complete Payment
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                  {/* Payment completed message */}
                  {activeRide.status === "completed" &&
                    activeRide.paymentStatus === "completed" && (
                      <View className="mt-3 bg-green-100 p-3 rounded-lg">
                        <Text className="text-green-700 text-center font-bold">
                          Payment completed via{" "}
                          {activeRide.paymentMethod || "cash"}
                        </Text>
                      </View>
                    )}
                </View>
              )}

              {showDriverList && availableDrivers.length > 0 && (
                <View className="mt-4">
                  <Text className="text-base font-bold mb-2">
                    Available Drivers
                  </Text>
                  {availableDrivers.map((driver) => (
                    <DriverCard key={driver._id} driver={driver} />
                  ))}
                </View>
              )}

              {showDriverList &&
                availableDrivers.length === 0 &&
                !isSearching && (
                  <View className="items-center mt-4 p-4 bg-gray-50 rounded-lg">
                    <Text className="text-base mb-3">No drivers available</Text>
                    <TouchableOpacity
                      className="bg-orange-500 py-2 px-4 rounded w-full items-center"
                      onPress={() => handleRequestRide(null)}
                    >
                      <Text className="text-white font-bold">
                        Request Any Driver
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
            </ScrollView>
          ) : (
            <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-4 h-[70%]">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold">Ride History</Text>
                <TouchableOpacity
                  className="p-2"
                  onPress={() => setShowRideHistory(false)}
                >
                  <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
              </View>

              {isLoading ? (
                <ActivityIndicator
                  size="large"
                  color="#4285F4"
                  style={{ flex: 1 }}
                />
              ) : rideHistory.length > 0 ? (
                <FlatList
                  data={rideHistory}
                  renderItem={({ item }) => <RideHistoryItem ride={item} />}
                  keyExtractor={(item) => item._id || ""}
                  contentContainerStyle={{ paddingBottom: 20 }}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-base text-gray-600">
                    No ride history found
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* Payment Modal */}
      <PaymentModal
        visible={showPaymentModal}
        amount={activeRide?.fare || 0}
        rideId={activeRide?._id}
        passengerId={passengerId as string}
        onClose={() => setShowPaymentModal(false)}
        onPayment={handlePayment}
      />
    </View>
  );
};

// Helper function to calculate fare
const calculateFare = (distance: number, vehicleType: string): number => {
  let baseFare = 0;
  let ratePerKm = 0;

  switch (vehicleType) {
    case "Bike":
      baseFare = 50; // NPR
      ratePerKm = 15;
      break;
    case "Car":
      baseFare = 100;
      ratePerKm = 30;
      break;
    case "Electric":
      baseFare = 80;
      ratePerKm = 25;
      break;
    default:
      baseFare = 50;
      ratePerKm = 15;
  }

  return Math.round(baseFare + distance * ratePerKm);
};

export default PassengerDashboard;
