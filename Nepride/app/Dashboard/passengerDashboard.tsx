import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
  ActivityIndicator,
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
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";

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
}

interface Driver {
  _id: string;
  fullName: string;
  vehicleType: string;
}

const { width, height } = Dimensions.get("window");

const PassengerDashboard = () => {
  const { passengerId } = useLocalSearchParams<{ passengerId: string }>();
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [pickupLocationName, setPickupLocationName] = useState<string>("");
  const [dropoffLocationName, setDropoffLocationName] = useState<string>("");
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coordinates | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coordinates[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<string[]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [driverInfo, setDriverInfo] = useState<Driver | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(true);
  const [mapError, setMapError] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const mapTimeout = useRef<NodeJS.Timeout | null>(null);

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

  const geocodeLocation = async (
    locationName: string
  ): Promise<Coordinates | null> => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          locationName
        )}&key=AIzaSyAfVD-fFk1aa4yy4YFesrLIXhxwNHhQtxU`
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

  const calculateDistanceAndETA = async (
    pickup: Coordinates,
    dropoff: Coordinates
  ): Promise<
    { distance: number; eta: number; route: Coordinates[] } | undefined
  > => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.latitude},${pickup.longitude}&destination=${dropoff.latitude},${dropoff.longitude}&key=AIzaSyAfVD-fFk1aa4yy4YFesrLIXhxwNHhQtxU`
      );
      const route = response.data.routes[0];
      const distanceKm = route.legs[0].distance.value / 1000;
      const etaMinutes = Math.round(route.legs[0].duration.value / 60);
      const points = route.legs[0].steps
        .map((step: { start_location: any }) => step.start_location)
        .concat(route.legs[0].end_location);
      const routeCoords = points.map((point: { lat: any; lng: any }) => ({
        latitude: point.lat,
        longitude: point.lng,
      }));

      setDistance(distanceKm);
      setEta(etaMinutes);
      return { distance: distanceKm, eta: etaMinutes, route: routeCoords };
    } catch (error) {
      console.error("Error calculating distance:", error);
      return undefined;
    }
  };

  useEffect(() => {
    const setupSocket = () => {
      socket.emit("join", `passenger-${passengerId}`);

      socket.on(
        "driver-available",
        (data: { driverId: string; status: string }) => {
          setAvailableDrivers((prev) => {
            if (data.status === "online") return [...prev, data.driverId];
            return prev.filter((id) => id !== data.driverId);
          });
        }
      );

      socket.on(
        "ride-status",
        async (data: { rideId: string; status: string; driverId?: string }) => {
          setActiveRide((prev) =>
            prev ? { ...prev, status: data.status } : null
          );
          if (data.status === "accepted" && data.driverId) {
            try {
              const driverResponse = await axios.get(
                `http://192.168.1.70:3001/driver/${data.driverId}`
              );
              setDriverInfo(driverResponse.data);
            } catch (error) {
              console.error("Error fetching driver info:", error);
              Alert.alert("Error", "Failed to fetch driver info");
            }
          }
        }
      );

      socket.on("ride-notification", ({ message }: { message: string }) => {
        Alert.alert("Ride Update", message);
      });

      socket.on("ride-completed", ({ message }: { message: string }) => {
        Alert.alert("Ride Completed", message);
        setActiveRide(null); // Clear the active ride
        setDriverInfo(null); // Clear the driver info
      });
    };

    const getLocation = async () => {
      setLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          setCurrentLocation(location);
          setPickupCoords({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
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

    getLocation();
    setupSocket();

    return () => {
      socket.off("driver-available");
      socket.off("ride-status");
      socket.off("ride-notification");
      socket.off("ride-completed");
    };
  }, [passengerId]);

  const handleRequestRide = async () => {
    if (!pickupLocationName || !dropoffLocationName) {
      Alert.alert("Error", "Please enter both pickup and dropoff locations");
      return;
    }

    setLoading(true);
    const pickup = await geocodeLocation(pickupLocationName);
    const dropoff = await geocodeLocation(dropoffLocationName);

    if (pickup && dropoff) {
      setPickupCoords(pickup);
      setDropoffCoords(dropoff);

      const distanceETA = await calculateDistanceAndETA(pickup, dropoff);

      if (distanceETA) {
        const ride: Ride = {
          passengerId,
          pickupLocation: `${pickup.latitude},${pickup.longitude}`,
          dropoffLocation: `${dropoff.latitude},${dropoff.longitude}`,
          pickupLocationName,
          dropoffLocationName,
          status: "requested",
          distance: distanceETA.distance,
          estimatedTime: distanceETA.eta,
        };

        setRouteCoords(distanceETA.route);
        socket.emit("request-ride", ride);
        setActiveRide(ride);
        setExpanded(false);
      }
    } else {
      Alert.alert("Error", "Unable to find one or both locations");
    }
    setLoading(false);
  };

  const getRideStatusColor = (status: string) => {
    switch (status) {
      case "requested":
        return "#FFA500"; // Orange
      case "accepted":
        return "#4CAF50"; // Green
      case "in-progress":
        return "#2196F3"; // Blue
      case "completed":
        return "#9C27B0"; // Purple
      default:
        return "#757575"; // Grey
    }
  };

  const getRideStatusText = (status: string) => {
    switch (status) {
      case "requested":
        return "Looking for drivers...";
      case "accepted":
        return "Driver is on the way";
      case "in-progress":
        return "On the way to destination";
      case "completed":
        return "Ride completed";
      default:
        return status;
    }
  };

  const DriverCard = ({ driver }: { driver: Driver }) => (
    <View style={styles.driverCard}>
      <View style={styles.driverAvatarContainer}>
        <View style={styles.driverAvatar}>
          <FontAwesome5 name="user-alt" size={24} color="#fff" />
        </View>
      </View>
      <View style={styles.driverInfo}>
        <Text style={styles.driverName}>{driver.fullName}</Text>
        <View style={styles.driverDetails}>
          <MaterialIcons name="directions-car" size={16} color="#555" />
          <Text style={styles.driverVehicle}>{driver.vehicleType}</Text>
        </View>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingText}>Rating: </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= 4 ? "star" : "star-outline"}
                size={14}
                color="#FFD700"
              />
            ))}
          </View>
        </View>
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
            <View style={styles.markerContainer}>
              <View style={styles.markerDot} />
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
        {expanded ? (
          <ScrollView style={styles.formContainer}>
            <Text style={styles.formTitle}>Where are you going?</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="location" size={20} color="#4CAF50" />
              <TextInput
                style={styles.input}
                placeholder="Pickup Location"
                value={pickupLocationName}
                onChangeText={setPickupLocationName}
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="location" size={20} color="#F44336" />
              <TextInput
                style={styles.input}
                placeholder="Dropoff Location"
                value={dropoffLocationName}
                onChangeText={setDropoffLocationName}
                placeholderTextColor="#999"
              />
            </View>
            {distance && eta && (
              <View style={styles.tripInfoContainer}>
                <View style={styles.tripInfoItem}>
                  <MaterialIcons name="directions" size={18} color="#555" />
                  <Text style={styles.tripInfoText}>
                    {distance.toFixed(1)} km
                  </Text>
                </View>
                <View style={styles.tripInfoItem}>
                  <Ionicons name="time-outline" size={18} color="#555" />
                  <Text style={styles.tripInfoText}>{eta} min</Text>
                </View>
                <View style={styles.tripInfoItem}>
                  <MaterialIcons name="attach-money" size={18} color="#555" />
                  <Text style={styles.tripInfoText}>
                    ${(distance * 1.5).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={styles.requestButton}
              onPress={handleRequestRide}
              disabled={loading}
            >
              <Text style={styles.requestButtonText}>
                {loading ? "Processing..." : "Request Ride"}
              </Text>
            </TouchableOpacity>

            {availableDrivers.length > 0 && (
              <View style={styles.driversAvailableContainer}>
                <Ionicons name="car-outline" size={18} color="#555" />
                <Text style={styles.driversAvailableText}>
                  {availableDrivers.length} driver
                  {availableDrivers.length !== 1 ? "s" : ""} nearby
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.collapsedContainer}>
            {activeRide ? (
              <>
                <View style={styles.statusContainer}>
                  <View
                    style={[
                      styles.statusIndicator,
                      {
                        backgroundColor: getRideStatusColor(activeRide.status),
                      },
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {getRideStatusText(activeRide.status)}
                  </Text>
                </View>
                {driverInfo && <DriverCard driver={driverInfo} />}
              </>
            ) : (
              <Text style={styles.collapsedText}>
                Tap to set your destination
              </Text>
            )}
          </View>
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
  formContainer: {
    paddingBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#eee",
  },
  input: {
    flex: 1,
    height: 45,
    paddingHorizontal: 10,
    color: "#333",
    fontSize: 16,
  },
  tripInfoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 15,
    backgroundColor: "#f0f8ff",
    padding: 12,
    borderRadius: 10,
  },
  tripInfoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripInfoText: {
    marginLeft: 5,
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  requestButton: {
    backgroundColor: "#4285F4",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 5,
  },
  requestButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  driversAvailableContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  driversAvailableText: {
    marginLeft: 5,
    color: "#555",
    fontSize: 14,
  },
  collapsedContainer: {
    paddingVertical: 15,
  },
  collapsedText: {
    textAlign: "center",
    color: "#555",
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  driverCard: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 12,
    marginTop: 5,
    alignItems: "center",
  },
  driverAvatarContainer: {
    marginRight: 15,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  driverDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  driverVehicle: {
    marginLeft: 5,
    fontSize: 14,
    color: "#555",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 14,
    color: "#555",
  },
  stars: {
    flexDirection: "row",
  },
  markerContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(66, 133, 244, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4285F4",
  },
  pickupMarker: {
    alignItems: "center",
  },
  dropoffMarker: {
    alignItems: "center",
  },
});

export default PassengerDashboard;
