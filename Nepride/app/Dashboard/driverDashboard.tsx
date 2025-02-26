import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  ScrollView,
  Switch,
  StyleSheet,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import io from "socket.io-client";
import { useLocalSearchParams } from "expo-router";

interface RideRequest {
  _id: string;
  passengerId: string;
  pickupLocation: string; // Coordinates (latitude,longitude)
  dropoffLocation: string; // Coordinates (latitude,longitude)
  pickupLocationName: string; // Human-readable name (e.g., "Baneshwor")
  dropoffLocationName: string; // Human-readable name (e.g., "Koteshwor")
  status: string;
}

const DriverDashboard = () => {
  const { driverId } = useLocalSearchParams<{ driverId: string }>();
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [rideHistory, setRideHistory] = useState<RideRequest[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false); // Track driver's online status
  const socket = io("http://192.168.1.70:3001");

  // Get the driver's current location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("Permission to access location was denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
    })();
  }, []);

  // Handle driver going online/offline
  const toggleOnlineStatus = () => {
    if (isOnline) {
      // Go offline
      socket.emit("driver-offline", driverId);
      setIsOnline(false);
      setRideRequests([]); // Clear ride requests when going offline
    } else {
      // Go online
      socket.emit("driver-online", driverId);
      setIsOnline(true);
    }
  };

  // Listen for ride requests (only when online)
  useEffect(() => {
    if (isOnline) {
      socket.on("ride-request", (ride: RideRequest) => {
        setRideRequests((prev) => [...prev, ride]);
      });
    }

    return () => {
      socket.off("ride-request"); // Stop listening when offline
    };
  }, [isOnline]);

  // Handle accepting a ride request
  const handleAcceptRide = (rideId: string) => {
    setIsLoading(true);
    socket.emit("ride-response", { rideId, driverId, status: "accepted" });
    const acceptedRide = rideRequests.find((ride) => ride._id === rideId);
    if (acceptedRide) {
      setActiveRide(acceptedRide);
      setRideRequests((prev) => prev.filter((ride) => ride._id !== rideId));
    }
    setIsLoading(false);
  };

  // Handle updating ride status
  const handleUpdateRideStatus = (status: string) => {
    if (activeRide) {
      socket.emit("ride-status-update", { rideId: activeRide._id, status });
      if (status === "completed") {
        setRideHistory((prev) => [...prev, { ...activeRide, status }]);
        setEarnings((prev) => prev + 10); // Assuming a fixed fare of $10 for simplicity
        setActiveRide(null);
      } else {
        setActiveRide((prev) => (prev ? { ...prev, status } : null));
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Online/Offline Toggle */}
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleText}>{isOnline ? "Online" : "Offline"}</Text>
        <Switch
          value={isOnline}
          onValueChange={toggleOnlineStatus}
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={isOnline ? "#f5dd4b" : "#f4f3f4"}
        />
      </View>

      {/* Map Section */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.coords.latitude || 27.7172,
          longitude: currentLocation?.coords.longitude || 85.324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {/* Driver's Current Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            }}
            title="Your Location"
          />
        )}

        {/* Ride Request Markers */}
        {rideRequests.map((ride) => (
          <Marker
            key={ride._id}
            coordinate={{
              latitude: parseFloat(ride.pickupLocation.split(",")[0]),
              longitude: parseFloat(ride.pickupLocation.split(",")[1]),
            }}
            title={`Ride Request: ${ride.pickupLocationName}`}
          />
        ))}

        {/* Active Ride Polyline */}
        {activeRide && (
          <Polyline
            coordinates={[
              {
                latitude: parseFloat(activeRide.pickupLocation.split(",")[0]),
                longitude: parseFloat(activeRide.pickupLocation.split(",")[1]),
              },
              {
                latitude: parseFloat(activeRide.dropoffLocation.split(",")[0]),
                longitude: parseFloat(activeRide.dropoffLocation.split(",")[1]),
              },
            ]}
            strokeColor="#000"
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Ride Request List */}
      <View style={styles.rideRequestContainer}>
        <Text style={styles.heading}>Ride Requests</Text>

        {rideRequests.length === 0 ? (
          <Text style={styles.noRidesText}>No ride requests yet.</Text>
        ) : (
          rideRequests.map((ride) => (
            <View key={ride._id} style={styles.rideCard}>
              <Text style={styles.rideTitle}>Ride Request from Passenger</Text>
              <Text>Pickup: {ride.pickupLocationName}</Text>
              <Text>Dropoff: {ride.dropoffLocationName}</Text>
              <Text>Status: {ride.status}</Text>
              {ride.status === "requested" && (
                <Button
                  title={isLoading ? "Accepting..." : "Accept Ride"}
                  onPress={() => handleAcceptRide(ride._id)}
                  disabled={isLoading}
                />
              )}
            </View>
          ))
        )}
      </View>

      {/* Active Ride Section */}
      {activeRide && (
        <View style={styles.activeRideContainer}>
          <Text style={styles.heading}>Active Ride</Text>
          <Text>Pickup: {activeRide.pickupLocationName}</Text>
          <Text>Dropoff: {activeRide.dropoffLocationName}</Text>
          <Text>Status: {activeRide.status}</Text>
          <Button
            title="Mark as Picked Up"
            onPress={() => handleUpdateRideStatus("picked up")}
            disabled={activeRide.status === "picked up"}
          />
          <Button
            title="Mark as Completed"
            onPress={() => handleUpdateRideStatus("completed")}
            disabled={activeRide.status !== "picked up"}
          />
        </View>
      )}

      {/* Ride History Section */}
      <View style={styles.historyContainer}>
        <Text style={styles.heading}>Ride History</Text>
        <ScrollView>
          {rideHistory.map((ride) => (
            <View key={ride._id} style={styles.rideCard}>
              <Text style={styles.rideTitle}>Ride with Passenger</Text>
              <Text>Pickup: {ride.pickupLocationName}</Text>
              <Text>Dropoff: {ride.dropoffLocationName}</Text>
              <Text>Status: {ride.status}</Text>
              <Text>Fare: $10</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Earnings Section */}
      <View style={styles.earningsContainer}>
        <Text style={styles.heading}>Earnings</Text>
        <Text>Total Earnings: ${earnings}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#f0f0f0",
  },
  toggleText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  rideRequestContainer: {
    padding: 16,
    backgroundColor: "#f0f0f0",
  },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  noRidesText: {
    color: "#666",
    textAlign: "center",
  },
  rideCard: {
    padding: 16,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderColor: "#ccc",
    borderWidth: 1,
  },
  rideTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  activeRideContainer: {
    padding: 16,
    backgroundColor: "#e0f7fa",
  },
  historyContainer: {
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  earningsContainer: {
    padding: 16,
    backgroundColor: "#fff3e0",
  },
});

export default DriverDashboard;
