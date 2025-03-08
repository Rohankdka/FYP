import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Switch,
  Dimensions,
  Platform,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import axios from "axios";
import socket from "../components/socket";
import { useRouter } from "expo-router";
import {
  Ionicons,
  MaterialIcons,
  FontAwesome5,
  Feather,
} from "@expo/vector-icons";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Ride {
  _id?: string;
  passengerId: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLocationName: string;
  dropoffLocationName: string;
  status: string;
  distance?: number;
  estimatedTime?: number;
  passenger?: { phone: string; username: string };
}

const { width, height } = Dimensions.get("window");

const DriverDashboard = () => {
  const { driverId } = useLocalSearchParams<{ driverId: string }>();
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coordinates | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coordinates[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [rideRequests, setRideRequests] = useState<Ride[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(true);
  const [mapError, setMapError] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const mapTimeout = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  // Use default provider on iOS to avoid Google Maps issues
  const mapProvider =
    Platform.OS === "ios" ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;

  // Set a timeout to detect if the map fails to load
  useEffect(() => {
    // Set a timeout to check if the map has loaded
    mapTimeout.current = setTimeout(() => {
      if (!mapReady) {
        setMapError(true);
      }
    }, 5000); // 5 seconds timeout

    return () => {
      if (mapTimeout.current) {
        clearTimeout(mapTimeout.current);
      }
    };
  }, []);

  const handleMapReady = () => {
    setMapReady(true);
    if (mapTimeout.current) {
      clearTimeout(mapTimeout.current);
    }
  };

  const getLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
        if (location) {
          console.log("Location obtained:", location.coords);
        }
      } else {
        Alert.alert(
          "Location Permission",
          "Please enable location services to use this app."
        );
        setMapError(true);
      }
    } catch (error) {
      console.error("Error getting location:", error);
      setMapError(true);
    }
    setLoading(false);
  };
  const calculateRoute = async (pickup: Coordinates, dropoff: Coordinates) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.latitude},${pickup.longitude}&destination=${dropoff.latitude},${dropoff.longitude}&key=AIzaSyAfVD-fFk1aa4yy4YFesrLIXhxwNHhQtxU`
      );
      const route = response.data.routes[0];
      const points = route.legs[0].steps
        .map((step: { start_location: any }) => step.start_location)
        .concat(route.legs[0].end_location);
      const routeCoords = points.map((point: { lat: any; lng: any }) => ({
        latitude: point.lat,
        longitude: point.lng,
      }));
      setRouteCoords(routeCoords);
      setLoading(false);
    } catch (error) {
      console.error("Error calculating route:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const setupSocket = () => {
      if (isOnline) {
        socket.emit("driver-online", driverId);
        console.log(`Driver ${driverId} is online`);
      }

      socket.on("ride-request", (ride: Ride) => {
        if (isOnline) {
          setRideRequests((prev) => [...prev, ride]);
          Alert.alert("New Ride Request", `From: ${ride.passenger?.username}`);
        }
      });

      socket.on("ride-notification", ({ message }: { message: string }) => {
        Alert.alert("Ride Update", message);
      });

      socket.on("ride-status", (data: { rideId: string; status: string }) => {
        setActiveRide((prev) =>
          prev ? { ...prev, status: data.status } : null
        );
      });
    };

    getLocation();
    setupSocket();

    return () => {
      socket.emit("driver-offline", driverId);
      socket.off("ride-request");
      socket.off("ride-notification");
      socket.off("ride-status");
    };
  }, [driverId, isOnline]);

  const toggleOnlineStatus = () => {
    if (isOnline) {
      socket.emit("driver-offline", driverId);
      setIsOnline(false);
      setRideRequests([]);
      setActiveRide(null);
      setPickupCoords(null);
      setDropoffCoords(null);
      setRouteCoords([]);
      Alert.alert("Status", "You are now offline");
    } else {
      socket.emit("driver-online", driverId);
      setIsOnline(true);
      Alert.alert("Status", "You are now online");
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (activeRide) {
      try {
        setLoading(true);
        const response = await axios.put(
          "http://192.168.1.70:3001/ride/update",
          {
            rideId: activeRide._id,
            status,
          }
        );
        setActiveRide((prev) => (prev ? { ...prev, status } : null));
        socket.emit("ride-status-update", { rideId: activeRide._id, status });
        setLoading(false);
      } catch (error) {
        console.error("Error updating ride status:", error);
        Alert.alert("Error", "Failed to update ride status");
        setLoading(false);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "requested":
        return "#FFA500"; // Orange
      case "accepted":
        return "#4CAF50"; // Green
      case "picked up":
        return "#2196F3"; // Blue
      case "completed":
        return "#9C27B0"; // Purple
      case "canceled":
        return "#F44336"; // Red
      default:
        return "#757575"; // Grey
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "requested":
        return <Ionicons name="time-outline" size={18} color="#FFA500" />;
      case "accepted":
        return (
          <Ionicons name="checkmark-circle-outline" size={18} color="#4CAF50" />
        );
      case "picked up":
        return <Ionicons name="car-outline" size={18} color="#2196F3" />;
      case "completed":
        return <Ionicons name="flag-outline" size={18} color="#9C27B0" />;
      case "canceled":
        return (
          <Ionicons name="close-circle-outline" size={18} color="#F44336" />
        );
      default:
        return (
          <Ionicons name="help-circle-outline" size={18} color="#757575" />
        );
    }
  };

  const RideRequestCard = ({ ride }: { ride: Ride }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.passengerInfo}>
          <View style={styles.avatarContainer}>
            <FontAwesome5 name="user" size={16} color="#fff" />
          </View>
          <Text style={styles.passengerName}>{ride.passenger?.username}</Text>
        </View>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingText}>4.8</Text>
          <Ionicons name="star" size={14} color="#FFD700" />
        </View>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationItem}>
          <View style={styles.locationDot}>
            <View style={[styles.dot, { backgroundColor: "#4CAF50" }]} />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>
            {ride.pickupLocationName}
          </Text>
        </View>
        <View style={styles.locationDivider} />
        <View style={styles.locationItem}>
          <View style={styles.locationDot}>
            <View style={[styles.dot, { backgroundColor: "#F44336" }]} />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>
            {ride.dropoffLocationName}
          </Text>
        </View>
      </View>

      <View style={styles.tripDetails}>
        <View style={styles.tripDetail}>
          <Ionicons name="call-outline" size={16} color="#555" />
          <Text style={styles.tripDetailText}>{ride.passenger?.phone}</Text>
        </View>
        <View style={styles.tripDetail}>
          <Ionicons name="navigate-outline" size={16} color="#555" />
          <Text style={styles.tripDetailText}>{ride.distance} km</Text>
        </View>
        <View style={styles.tripDetail}>
          <Ionicons name="time-outline" size={16} color="#555" />
          <Text style={styles.tripDetailText}>{ride.estimatedTime} min</Text>
        </View>
        <View style={styles.tripDetail}>
          <MaterialIcons name="attach-money" size={16} color="#555" />
          <Text style={styles.tripDetailText}>
            ${(ride.distance || 0 * 1.5).toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={async () => {
            try {
              setLoading(true);
              socket.emit("ride-response", {
                rideId: ride._id,
                driverId,
                status: "accepted",
              });
              setActiveRide({ ...ride, status: "accepted" });
              setRideRequests((prev) => prev.filter((r) => r._id !== ride._id));
              const [pickupLat, pickupLng] = ride.pickupLocation
                .split(",")
                .map(Number);
              const [dropoffLat, dropoffLng] = ride.dropoffLocation
                .split(",")
                .map(Number);
              setPickupCoords({ latitude: pickupLat, longitude: pickupLng });
              setDropoffCoords({ latitude: dropoffLat, longitude: dropoffLng });
              await calculateRoute(
                { latitude: pickupLat, longitude: pickupLng },
                { latitude: dropoffLat, longitude: dropoffLng }
              );
              setLoading(false);
            } catch (error) {
              console.error("Error accepting ride:", error);
              Alert.alert("Error", "Failed to accept ride");
              setLoading(false);
            }
          }}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => {
            socket.emit("ride-response", {
              rideId: ride._id,
              driverId,
              status: "rejected",
            });
            setRideRequests((prev) => prev.filter((r) => r._id !== ride._id));
          }}
        >
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const ActiveRideCard = ({ ride }: { ride: Ride }) => (
    <View style={styles.activeRideCard}>
      <View style={styles.activeRideHeader}>
        <View style={styles.statusBadge}>
          {getStatusIcon(ride.status)}
          <Text
            style={[styles.statusText, { color: getStatusColor(ride.status) }]}
          >
            {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
          </Text>
        </View>
        <View style={styles.passengerInfo}>
          <View style={styles.avatarContainer}>
            <FontAwesome5 name="user" size={16} color="#fff" />
          </View>
          <Text style={styles.passengerName}>{ride.passenger?.username}</Text>
        </View>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationItem}>
          <View style={styles.locationDot}>
            <View style={[styles.dot, { backgroundColor: "#4CAF50" }]} />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>
            {ride.pickupLocationName}
          </Text>
        </View>
        <View style={styles.locationDivider} />
        <View style={styles.locationItem}>
          <View style={styles.locationDot}>
            <View style={[styles.dot, { backgroundColor: "#F44336" }]} />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>
            {ride.dropoffLocationName}
          </Text>
        </View>
      </View>

      <View style={styles.contactContainer}>
        <TouchableOpacity style={styles.contactButton}>
          <Ionicons name="call-outline" size={20} color="#4285F4" />
          <Text style={styles.contactText}>{ride.passenger?.phone}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.rideActions}>
        {ride.status === "accepted" && (
          <TouchableOpacity
            style={styles.rideActionButton}
            onPress={() => handleStatusUpdate("picked up")}
          >
            <Text style={styles.rideActionText}>Picked Up Passenger</Text>
          </TouchableOpacity>
        )}

        {ride.status === "picked up" && (
          <TouchableOpacity
            style={styles.rideActionButton}
            onPress={() => handleStatusUpdate("completed")}
          >
            <Text style={styles.rideActionText}>Complete Ride</Text>
          </TouchableOpacity>
        )}

        {ride.status !== "completed" && ride.status !== "canceled" && (
          <TouchableOpacity
            style={[styles.rideActionButton, styles.cancelButton]}
            onPress={() => handleStatusUpdate("canceled")}
          >
            <Text style={styles.cancelText}>Cancel Ride</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderMap = () => {
    if (mapError) {
      return (
        <View style={[styles.map, styles.mapErrorContainer]}>
          <MaterialIcons name="map" size={50} color="#999" />
          <Text style={styles.mapErrorText}>Map unavailable</Text>
          <Text style={styles.mapErrorSubtext}>
            Please check your connection or app permissions
          </Text>
        </View>
      );
    }

    return (
      <MapView
        provider={mapProvider}
        style={styles.map}
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
        showsUserLocation
        showsMyLocationButton
        showsCompass
        showsScale
        onMapReady={handleMapReady}
      >
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            }}
            title="You"
          >
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={20} color="#fff" />
            </View>
          </Marker>
        )}
        {pickupCoords && (
          <Marker coordinate={pickupCoords} title="Pickup">
            <View style={styles.pickupMarker}>
              <MaterialIcons name="location-on" size={24} color="#4CAF50" />
            </View>
          </Marker>
        )}
        {dropoffCoords && (
          <Marker coordinate={dropoffCoords} title="Dropoff">
            <View style={styles.dropoffMarker}>
              <MaterialIcons name="location-on" size={24} color="#F44336" />
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
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderMap()}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      )}

      <TouchableOpacity
        style={styles.expandButton}
        onPress={() => setExpanded(!expanded)}
      >
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-up"}
          size={24}
          color="#fff"
        />
      </TouchableOpacity>

      <View
        style={[
          styles.bottomSheet,
          { height: expanded ? "auto" : activeRide ? 180 : 100 },
        ]}
      >
        <View style={styles.statusToggleContainer}>
          <View style={styles.statusTextContainer}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: isOnline ? "#4CAF50" : "#757575" },
              ]}
            />
            <Text style={styles.statusToggleText}>
              {isOnline ? "You're Online" : "You're Offline"}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={toggleOnlineStatus}
            trackColor={{ false: "#e0e0e0", true: "#c8e6c9" }}
            thumbColor={isOnline ? "#4CAF50" : "#f5f5f5"}
            ios_backgroundColor="#e0e0e0"
          />
        </View>

        {expanded && (
          <ScrollView style={styles.scrollContent}>
            {isOnline && rideRequests.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Ride Requests</Text>
                {rideRequests.map((ride) => (
                  <RideRequestCard key={ride._id} ride={ride} />
                ))}
              </View>
            )}

            {activeRide && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Active Ride</Text>
                <ActiveRideCard ride={activeRide} />
              </View>
            )}

            {isOnline && rideRequests.length === 0 && !activeRide && (
              <View style={styles.emptyStateContainer}>
                <Feather name="radio" size={50} color="#4285F4" />
                <Text style={styles.emptyStateTitle}>Waiting for requests</Text>
                <Text style={styles.emptyStateText}>
                  You'll be notified when new ride requests come in
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        <TouchableOpacity
          style={styles.reserveButton}
          onPress={() => router.push("/Dashboard/driverReserveBookings")} // Navigate to ReserveBooking screen
        >
          <Text style={styles.reserveButtonText}>Reserve Booking</Text>
        </TouchableOpacity>

        {!expanded && activeRide && (
          <View style={styles.collapsedRideInfo}>
            <View style={styles.collapsedStatusBadge}>
              {getStatusIcon(activeRide.status)}
              <Text
                style={[
                  styles.collapsedStatusText,
                  { color: getStatusColor(activeRide.status) },
                ]}
              >
                {activeRide.status.charAt(0).toUpperCase() +
                  activeRide.status.slice(1)}
              </Text>
            </View>
            <Text style={styles.collapsedPassengerName}>
              {activeRide.passenger?.username}
            </Text>
          </View>
        )}

        {!expanded && !activeRide && (
          <Text style={styles.collapsedText}>
            {isOnline
              ? "Waiting for ride requests..."
              : "Go online to receive ride requests"}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  map: {
    flex: 1,
  },
  mapErrorContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  mapErrorText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#555",
    marginTop: 10,
  },
  mapErrorSubtext: {
    fontSize: 14,
    color: "#777",
    marginTop: 5,
    textAlign: "center",
    paddingHorizontal: 30,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
    minHeight: 100,
  },
  expandButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "#4285F4",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  statusToggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginBottom: 15,
  },
  statusTextContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusToggleText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  scrollContent: {
    maxHeight: height * 0.6,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  passengerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginRight: 4,
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  locationDot: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationText: {
    fontSize: 14,
    color: "#555",
    flex: 1,
  },
  locationDivider: {
    width: 1,
    height: 15,
    backgroundColor: "#ddd",
    marginLeft: 10,
    marginVertical: 2,
  },
  tripDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  tripDetail: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    marginBottom: 8,
  },
  tripDetailText: {
    fontSize: 14,
    color: "#555",
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: {
    backgroundColor: "#4CAF50",
    marginRight: 8,
  },
  acceptButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  rejectButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
    marginLeft: 8,
  },
  rejectButtonText: {
    color: "#555",
    fontWeight: "bold",
    fontSize: 16,
  },
  activeRideCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeRideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 4,
  },
  contactContainer: {
    marginVertical: 12,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f7ff",
    padding: 10,
    borderRadius: 8,
  },
  contactText: {
    marginLeft: 8,
    color: "#4285F4",
    fontWeight: "500",
  },
  rideActions: {
    marginTop: 8,
  },
  rideActionButton: {
    backgroundColor: "#4285F4",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  rideActionText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  cancelText: {
    color: "#F44336",
    fontWeight: "bold",
    fontSize: 16,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  collapsedText: {
    textAlign: "center",
    color: "#555",
    fontSize: 16,
  },
  collapsedRideInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  collapsedStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  collapsedStatusText: {
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 4,
  },
  collapsedPassengerName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  driverMarker: {
    backgroundColor: "#4285F4",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  pickupMarker: {
    alignItems: "center",
  },
  dropoffMarker: {
    alignItems: "center",
  },
  // Add the missing styles here
  reserveButton: {
    backgroundColor: "#4285F4",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 15,
  },
  reserveButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default DriverDashboard;
