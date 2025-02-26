import React, { useEffect, useState } from "react";
import { View, Text, Button, ActivityIndicator, TextInput, StyleSheet, ScrollView } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import io from "socket.io-client";
import { useLocalSearchParams } from "expo-router";
import axios from "axios"; // For making API requests

interface Ride {
  _id: string;
  driverId: string;
  passengerId: string;
  pickupLocation: string; // Coordinates (latitude,longitude)
  dropoffLocation: string; // Coordinates (latitude,longitude)
  pickupLocationName: string; // Human-readable name (e.g., "Baneshwor")
  dropoffLocationName: string; // Human-readable name (e.g., "Koteshwor")
  status: string;
}

const PassengerDashboard = () => {
  const { passengerId } = useLocalSearchParams<{ passengerId: string }>();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [pickupLocationName, setPickupLocationName] = useState("");
  const [dropoffLocationName, setDropoffLocationName] = useState("");
  const [pickupLocationCoords, setPickupLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoffLocationCoords, setDropoffLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const socket = io("http://192.168.1.70:3001");

  // Get the passenger's current location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("Permission to access location was denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
      setPickupLocationCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

  // Geocode location name to coordinates
  const geocodeLocation = async (locationName: string) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationName)}&key=AIzaSyAfVD-fFk1aa4yy4YFesrLIXhxwNHhQtxU`
      );
      if (response.data.results.length > 0) {
        const { lat, lng } = response.data.results[0].geometry.location;
        return { latitude: lat, longitude: lng };
      } else {
        throw new Error("Location not found");
      }
    } catch (error) {
      console.error("❌ Error geocoding location:", error);
      return null;
    }
  };

  // Handle requesting a ride
  const handleRequestRide = async () => {
    if (!pickupLocationName || !dropoffLocationName) {
      alert("Please enter pickup and dropoff locations.");
      return;
    }

    setIsLoading(true);

    try {
      // Geocode pickup and dropoff locations
      const pickupCoords = await geocodeLocation(pickupLocationName);
      const dropoffCoords = await geocodeLocation(dropoffLocationName);

      if (!pickupCoords || !dropoffCoords) {
        alert("Invalid pickup or dropoff location.");
        return;
      }

      // Set coordinates for map display
      setPickupLocationCoords(pickupCoords);
      setDropoffLocationCoords(dropoffCoords);

      // Emit ride request to the server
      const ride = {
        passengerId,
        pickupLocation: `${pickupCoords.latitude},${pickupCoords.longitude}`,
        dropoffLocation: `${dropoffCoords.latitude},${dropoffCoords.longitude}`,
        pickupLocationName,
        dropoffLocationName,
      };

      socket.emit("request-ride", ride);
      console.log("🚕 Ride requested:", ride);
    } catch (error) {
      console.error("❌ Error requesting ride:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle canceling a ride
  const handleCancelRide = () => {
    if (activeRide) {
      socket.emit("ride-status-update", { rideId: activeRide._id, status: "canceled" });
      setActiveRide(null);
    }
  };

  // Listen for ride status updates
  useEffect(() => {
    socket.on("ride-status", (data: { rideId: string; status: string }) => {
      if (activeRide && activeRide._id === data.rideId) {
        setActiveRide((prev) => (prev ? { ...prev, status: data.status } : null));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeRide]);

  return (
    <View style={styles.container}>
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
        {/* Passenger's Current Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            }}
            title="Your Location"
          />
        )}

        {/* Pickup and Dropoff Markers */}
        {pickupLocationCoords && (
          <Marker coordinate={pickupLocationCoords} title="Pickup Location" />
        )}
        {dropoffLocationCoords && (
          <Marker coordinate={dropoffLocationCoords} title="Dropoff Location" />
        )}
      </MapView>

      {/* Ride Request Form */}
      <View style={styles.formContainer}>
        <Text style={styles.heading}>Request a Ride</Text>
        <TextInput
          style={styles.input}
          placeholder="Pickup Location"
          value={pickupLocationName}
          onChangeText={setPickupLocationName}
        />
        <TextInput
          style={styles.input}
          placeholder="Dropoff Location"
          value={dropoffLocationName}
          onChangeText={setDropoffLocationName}
        />
        <Button
          title={isLoading ? "Requesting..." : "Request Ride"}
          onPress={handleRequestRide}
          disabled={isLoading}
        />
      </View>

      {/* Active Ride Section */}
      {activeRide && (
        <View style={styles.activeRideContainer}>
          <Text style={styles.heading}>Active Ride</Text>
          <Text>Pickup: {activeRide.pickupLocationName}</Text>
          <Text>Dropoff: {activeRide.dropoffLocationName}</Text>
          <Text>Status: {activeRide.status}</Text>
          <Button title="Cancel Ride" onPress={handleCancelRide} />
        </View>
      )}

      {/* Ride History Section */}
      <View style={styles.historyContainer}>
        <Text style={styles.heading}>Ride History</Text>
        <ScrollView>
          {rideHistory.map((ride) => (
            <View key={ride._id} style={styles.rideCard}>
              <Text>Pickup: {ride.pickupLocationName}</Text>
              <Text>Dropoff: {ride.dropoffLocationName}</Text>
              <Text>Status: {ride.status}</Text>
            </View>
          ))}
        </ScrollView>
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
  formContainer: {
    padding: 16,
    backgroundColor: "#f0f0f0",
  },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  input: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
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
  rideCard: {
    padding: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 4,
    borderColor: "#ccc",
    borderWidth: 1,
  },
});

export default PassengerDashboard;