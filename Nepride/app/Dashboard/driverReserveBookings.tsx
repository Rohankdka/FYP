"use client";

import { useState, useEffect } from "react";
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
  Switch,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://192.168.1.70:3001";

interface Trip {
  _id: string;
  driver: {
    _id: string;
    username: string;
    phone: string;
  } | null;
  departureLocation: string;
  destinationLocation: string;
  departureDate: string;
  departureTime: string;
  price: number;
  availableSeats: number;
  status: string;
  description: string;
  vehicleDetails: {
    model: string;
    color: string;
    plateNumber: string;
  };
  preferences: {
    smoking: boolean;
    pets: boolean;
    music: boolean;
  };
  bookedSeats: string[];
  seatsAvailable: number;
}

interface Passenger {
  _id: string;
  username: string;
  phone: string;
}

const DriverReserveBooking = () => {
  const { driverId } = useLocalSearchParams<{ driverId: string }>();
  const router = useRouter();

  const [myTrips, setMyTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [showPassengers, setShowPassengers] = useState(false);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [token, setToken] = useState<string | null>(null);

  // Form states for creating/editing a trip
  const [departureLocation, setDepartureLocation] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [departureDate, setDepartureDate] = useState(new Date());
  const [departureDateString, setDepartureDateString] = useState("");
  const [departureTime, setDepartureTime] = useState("08:00");
  const [price, setPrice] = useState("");
  const [availableSeats, setAvailableSeats] = useState("4");
  const [description, setDescription] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState("");
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [musicAllowed, setMusicAllowed] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // Setup axios headers with token
  const getAuthHeaders = () => {
    return {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    };
  };

  // Fetch driver's trips
  const fetchMyTrips = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/trip/driver/${driverId}/trips`,
        getAuthHeaders()
      );

      // Filter trips based on active tab
      const filteredTrips = response.data.filter((trip: Trip) => {
        if (activeTab === "active") {
          return trip.status === "scheduled" || trip.status === "in-progress";
        } else {
          return trip.status === "completed" || trip.status === "cancelled";
        }
      });

      setMyTrips(filteredTrips);
    } catch (error) {
      console.error("Error fetching trips:", error);
      Alert.alert("Error", "Failed to fetch your trips");
    } finally {
      setLoading(false);
    }
  };

  // Create a new trip
  const createTrip = async () => {
    // Validate form
    if (
      !departureLocation ||
      !destinationLocation ||
      !departureDateString ||
      !departureTime ||
      !price ||
      !availableSeats ||
      !vehicleModel ||
      !vehicleColor ||
      !vehiclePlateNumber
    ) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    if (isNaN(Number(availableSeats)) || Number(availableSeats) <= 0) {
      Alert.alert("Error", "Please enter a valid number of seats");
      return;
    }

    setActionLoading(true);
    try {
      const tripData = {
        driver: driverId,
        departureLocation,
        destinationLocation,
        departureDate: departureDateString,
        departureTime,
        price: Number(price),
        availableSeats: Number(availableSeats),
        description,
        vehicleDetails: {
          model: vehicleModel,
          color: vehicleColor,
          plateNumber: vehiclePlateNumber,
        },
        preferences: {
          smoking: smokingAllowed,
          pets: petsAllowed,
          music: musicAllowed,
        },
      };

      await axios.post(
        `${API_URL}/trip/create/${driverId}`,
        tripData,
        getAuthHeaders()
      );
      Alert.alert("Success", "Trip created successfully!");

      // Reset form
      resetForm();
      setShowCreateModal(false);
      fetchMyTrips();
    } catch (error) {
      console.error("Error creating trip:", error);
      Alert.alert("Error", "Failed to create trip. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Edit an existing trip
  const editTrip = async () => {
    if (!selectedTrip) return;

    // Validate form
    if (
      !departureLocation ||
      !destinationLocation ||
      !departureDateString ||
      !departureTime ||
      !price ||
      !availableSeats ||
      !vehicleModel ||
      !vehicleColor ||
      !vehiclePlateNumber
    ) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    if (isNaN(Number(availableSeats)) || Number(availableSeats) <= 0) {
      Alert.alert("Error", "Please enter a valid number of seats");
      return;
    }

    setActionLoading(true);
    try {
      const tripData = {
        departureLocation,
        destinationLocation,
        departureDate: departureDateString,
        departureTime,
        price: Number(price),
        availableSeats: Number(availableSeats),
        description,
        vehicleDetails: {
          model: vehicleModel,
          color: vehicleColor,
          plateNumber: vehiclePlateNumber,
        },
        preferences: {
          smoking: smokingAllowed,
          pets: petsAllowed,
          music: musicAllowed,
        },
      };

      await axios.put(
        `${API_URL}/trip/${selectedTrip._id}/${driverId}`,
        tripData,
        getAuthHeaders()
      );
      Alert.alert("Success", "Trip updated successfully!");

      // Reset form
      resetForm();
      setShowEditModal(false);
      fetchMyTrips();

      // Send notification to booked passengers about the update
      if (selectedTrip.bookedSeats && selectedTrip.bookedSeats.length > 0) {
        try {
          await axios.post(
            `${API_URL}/trip/${selectedTrip._id}/notify`,
            {
              message:
                "Your booked trip has been updated. Please check the details.",
              type: "trip_update",
            },
            getAuthHeaders()
          );
        } catch (notifyError) {
          console.error("Error sending notifications:", notifyError);
        }
      }
    } catch (error) {
      console.error("Error updating trip:", error);
      Alert.alert("Error", "Failed to update trip. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Reset form fields
  const resetForm = () => {
    setDepartureLocation("");
    setDestinationLocation("");
    setDepartureDate(new Date());
    setDepartureDateString("");
    setDepartureTime("08:00");
    setPrice("");
    setAvailableSeats("4");
    setDescription("");
    setVehicleModel("");
    setVehicleColor("");
    setVehiclePlateNumber("");
    setSmokingAllowed(false);
    setPetsAllowed(false);
    setMusicAllowed(true);
  };

  // Load trip data for editing
  const loadTripForEdit = (trip: Trip) => {
    setDepartureLocation(trip.departureLocation);
    setDestinationLocation(trip.destinationLocation);
    setDepartureDate(new Date(trip.departureDate));
    setDepartureDateString(trip.departureDate);
    setDepartureTime(trip.departureTime);
    setPrice(trip.price.toString());
    setAvailableSeats(trip.availableSeats.toString());
    setDescription(trip.description || "");
    setVehicleModel(trip.vehicleDetails.model);
    setVehicleColor(trip.vehicleDetails.color);
    setVehiclePlateNumber(trip.vehicleDetails.plateNumber);
    setSmokingAllowed(trip.preferences.smoking);
    setPetsAllowed(trip.preferences.pets);
    setMusicAllowed(trip.preferences.music);
    setSelectedTrip(trip);
    setShowEditModal(true);
  };

  // Update trip status
  const updateTripStatus = async (tripId: string, status: string) => {
    setActionLoading(true);
    try {
      await axios.put(
        `${API_URL}/trip/${tripId}/${driverId}`,
        { status },
        getAuthHeaders()
      );
      Alert.alert("Success", `Trip ${status} successfully!`);
      fetchMyTrips();
      setShowTripDetails(false);

      // Send notification to booked passengers about the status change
      if (
        selectedTrip &&
        selectedTrip.bookedSeats &&
        selectedTrip.bookedSeats.length > 0
      ) {
        try {
          await axios.post(
            `${API_URL}/trip/${tripId}/notify`,
            {
              message: `Your trip status has been updated to: ${status}`,
              type: "status_update",
            },
            getAuthHeaders()
          );
        } catch (notifyError) {
          console.error("Error sending notifications:", notifyError);
        }
      }
    } catch (error) {
      console.error("Error updating trip status:", error);
      Alert.alert("Error", "Failed to update trip status. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete trip
  const deleteTrip = async (tripId: string) => {
    setActionLoading(true);
    try {
      // Notify passengers before deleting
      if (
        selectedTrip &&
        selectedTrip.bookedSeats &&
        selectedTrip.bookedSeats.length > 0
      ) {
        try {
          await axios.post(
            `${API_URL}/trip/${tripId}/notify`,
            {
              message: "Your booked trip has been cancelled by the driver.",
              type: "trip_cancelled",
            },
            getAuthHeaders()
          );
        } catch (notifyError) {
          console.error("Error sending notifications:", notifyError);
        }
      }

      await axios.delete(
        `${API_URL}/trip/${tripId}/${driverId}`,
        getAuthHeaders()
      );
      Alert.alert("Success", "Trip deleted successfully!");
      fetchMyTrips();
      setShowTripDetails(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error deleting trip:", error);
      Alert.alert("Error", "Failed to delete trip. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch passengers for a trip
  const fetchPassengers = async (tripId: string) => {
    setActionLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/trip/${tripId}`,
        getAuthHeaders()
      );
      const trip = response.data;

      if (trip.bookedSeats && trip.bookedSeats.length > 0) {
        // Fetch passenger details
        const passengersData = await Promise.all(
          trip.bookedSeats.map(async (passengerId: string) => {
            try {
              const passengerResponse = await axios.get(
                `${API_URL}/users/${passengerId}`,
                getAuthHeaders()
              );
              return passengerResponse.data;
            } catch (error) {
              console.error("Error fetching passenger:", error);
              return { _id: passengerId, username: "Unknown", phone: "N/A" };
            }
          })
        );
        setPassengers(passengersData);
      } else {
        setPassengers([]);
      }
      setShowPassengers(true);
    } catch (error) {
      console.error("Error fetching passengers:", error);
      Alert.alert("Error", "Failed to fetch passengers. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    setDepartureDate(date);
    const formattedDate = date.toISOString().split("T")[0];
    setDepartureDateString(formattedDate);
  };

  // Handle time selection
  const handleTimeSelect = (time: string) => {
    setDepartureTime(time);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Initialize data
  useEffect(() => {
    if (token) {
      fetchMyTrips();
    }
  }, [driverId, activeTab, token]);

  // Render trip item
  const renderTripItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      className="bg-white rounded-lg p-4 mb-3 shadow-sm border border-gray-100"
      onPress={() => {
        setSelectedTrip(item);
        setShowTripDetails(true);
      }}
    >
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center">
          <FontAwesome5 name="car" size={16} color="#4285F4" />
          <Text className="ml-2 font-bold text-base">
            {item.vehicleDetails.model}
          </Text>
        </View>
        <View
          className={`px-2 py-1 rounded ${
            item.status === "scheduled"
              ? "bg-blue-100"
              : item.status === "in-progress"
              ? "bg-green-100"
              : item.status === "completed"
              ? "bg-gray-100"
              : "bg-red-100"
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              item.status === "scheduled"
                ? "text-blue-700"
                : item.status === "in-progress"
                ? "text-green-700"
                : item.status === "completed"
                ? "text-gray-700"
                : "text-red-700"
            }`}
          >
            {item.status.toUpperCase()}
          </Text>
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
            <Text className="ml-1 text-gray-700">
              {item.destinationLocation}
            </Text>
          </View>
        </View>
        <View className="ml-2">
          <Text className="text-gray-600">
            {formatDate(item.departureDate)}
          </Text>
          <Text className="text-gray-600">{item.departureTime}</Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-gray-100">
        <Text className="text-green-600 font-bold">NPR {item.price}</Text>
        <View className="flex-row items-center">
          <Ionicons name="people" size={16} color="#4285F4" />
          <Text className="ml-1 text-gray-600">
            {item.bookedSeats.length}/{item.availableSeats} booked
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Custom date picker for Android compatibility
  const CustomDatePicker = () => {
    const [year, setYear] = useState(departureDate.getFullYear().toString());
    const [month, setMonth] = useState(
      (departureDate.getMonth() + 1).toString().padStart(2, "0")
    );
    const [day, setDay] = useState(
      departureDate.getDate().toString().padStart(2, "0")
    );

    const handleSave = () => {
      const newDate = new Date(`${year}-${month}-${day}T00:00:00`);
      if (!isNaN(newDate.getTime())) {
        handleDateSelect(newDate);
        setShowDatePicker(false);
      } else {
        Alert.alert("Invalid Date", "Please enter a valid date");
      }
    };

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
          <TouchableOpacity
            className="bg-gray-200 px-4 py-2 rounded mr-2"
            onPress={() => setShowDatePicker(false)}
          >
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-blue-500 px-4 py-2 rounded"
            onPress={handleSave}
          >
            <Text className="text-white">Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Custom time picker for Android compatibility
  const CustomTimePicker = () => {
    const [hours, setHours] = useState(departureTime.split(":")[0]);
    const [minutes, setMinutes] = useState(departureTime.split(":")[1]);

    const handleSave = () => {
      const hoursNum = Number.parseInt(hours);
      const minutesNum = Number.parseInt(minutes);

      if (
        isNaN(hoursNum) ||
        isNaN(minutesNum) ||
        hoursNum < 0 ||
        hoursNum > 23 ||
        minutesNum < 0 ||
        minutesNum > 59
      ) {
        Alert.alert("Invalid Time", "Please enter a valid time");
        return;
      }

      const formattedHours = hoursNum.toString().padStart(2, "0");
      const formattedMinutes = minutesNum.toString().padStart(2, "0");
      handleTimeSelect(`${formattedHours}:${formattedMinutes}`);
      setShowTimePicker(false);
    };

    return (
      <View className="bg-white p-4 rounded-lg">
        <Text className="text-lg font-bold mb-4">Select Time</Text>

        <View className="flex-row justify-center mb-4">
          <View className="w-16 mr-2">
            <Text className="mb-1 text-center">Hours</Text>
            <TextInput
              className="border border-gray-300 rounded p-2 text-center"
              value={hours}
              onChangeText={setHours}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <Text className="text-2xl self-end mb-2">:</Text>
          <View className="w-16 ml-2">
            <Text className="mb-1 text-center">Minutes</Text>
            <TextInput
              className="border border-gray-300 rounded p-2 text-center"
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>

        <View className="flex-row justify-end">
          <TouchableOpacity
            className="bg-gray-200 px-4 py-2 rounded mr-2"
            onPress={() => setShowTimePicker(false)}
          >
            <Text>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-blue-500 px-4 py-2 rounded"
            onPress={handleSave}
          >
            <Text className="text-white">Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-4 px-4 shadow-sm">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <Text className="text-xl font-bold">My Scheduled Rides</Text>
          <TouchableOpacity onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add-circle" size={24} color="#4285F4" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View className="flex-row mt-4">
          <TouchableOpacity
            className={`flex-1 py-2 ${
              activeTab === "active" ? "border-b-2 border-blue-500" : ""
            }`}
            onPress={() => setActiveTab("active")}
          >
            <Text
              className={`text-center font-medium ${
                activeTab === "active" ? "text-blue-500" : "text-gray-500"
              }`}
            >
              Active Trips
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 ${
              activeTab === "past" ? "border-b-2 border-blue-500" : ""
            }`}
            onPress={() => setActiveTab("past")}
          >
            <Text
              className={`text-center font-medium ${
                activeTab === "past" ? "text-blue-500" : "text-gray-500"
              }`}
            >
              Past Trips
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
          {myTrips.length > 0 ? (
            <FlatList
              data={myTrips}
              renderItem={renderTripItem}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          ) : (
            <View className="flex-1 justify-center items-center">
              <Ionicons name="car-outline" size={64} color="gray" />
              <Text className="mt-4 text-gray-500 text-center">
                {activeTab === "active"
                  ? "You don't have any active trips"
                  : "You don't have any past trips"}
              </Text>
              <TouchableOpacity
                className="mt-4 bg-blue-500 px-4 py-2 rounded-lg"
                onPress={() => setShowCreateModal(true)}
              >
                <Text className="text-white font-medium">Create New Trip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Create Trip Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 bg-black bg-opacity-50">
          <View className="bg-white rounded-t-3xl mt-10 flex-1">
            <View className="flex-row justify-between items-center p-5 border-b border-gray-200">
              <Text className="text-xl font-bold">Create New Trip</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5">
              <Text className="font-medium mb-2">Departure Location*</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Enter departure location"
                value={departureLocation}
                onChangeText={setDepartureLocation}
              />

              <Text className="font-medium mb-2">Destination*</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Enter destination"
                value={destinationLocation}
                onChangeText={setDestinationLocation}
              />

              <Text className="font-medium mb-2">Departure Date*</Text>
              <TouchableOpacity
                className="border border-gray-200 rounded-lg p-3 mb-4 flex-row justify-between items-center"
                onPress={() => setShowDatePicker(true)}
              >
                <Text className="text-gray-700">
                  {departureDateString
                    ? formatDate(departureDateString)
                    : "Select date"}
                </Text>
                <Ionicons name="calendar" size={20} color="#4285F4" />
              </TouchableOpacity>

              {showDatePicker && (
                <View className="mb-4">
                  <CustomDatePicker />
                </View>
              )}

              <Text className="font-medium mb-2">Departure Time*</Text>
              <TouchableOpacity
                className="border border-gray-200 rounded-lg p-3 mb-4 flex-row justify-between items-center"
                onPress={() => setShowTimePicker(true)}
              >
                <Text className="text-gray-700">{departureTime}</Text>
                <Ionicons name="time" size={20} color="#4285F4" />
              </TouchableOpacity>

              {showTimePicker && (
                <View className="mb-4">
                  <CustomTimePicker />
                </View>
              )}

              <Text className="font-medium mb-2">Price (NPR)*</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Enter price"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />

              <Text className="font-medium mb-2">Available Seats*</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Enter number of seats"
                value={availableSeats}
                onChangeText={setAvailableSeats}
                keyboardType="numeric"
              />

              <Text className="font-medium mb-2">Description</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Enter trip description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text className="font-medium mb-2">Vehicle Details</Text>
              <View className="border border-gray-200 rounded-lg p-3 mb-4">
                <TextInput
                  className="border-b border-gray-200 p-2 mb-2"
                  placeholder="Vehicle Model*"
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                />
                <TextInput
                  className="border-b border-gray-200 p-2 mb-2"
                  placeholder="Vehicle Color*"
                  value={vehicleColor}
                  onChangeText={setVehicleColor}
                />
                <TextInput
                  className="p-2"
                  placeholder="License Plate Number*"
                  value={vehiclePlateNumber}
                  onChangeText={setVehiclePlateNumber}
                />
              </View>

              <Text className="font-medium mb-2">Preferences</Text>
              <View className="border border-gray-200 rounded-lg p-3 mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center">
                    <MaterialIcons
                      name="smoking-rooms"
                      size={20}
                      color={smokingAllowed ? "#4285F4" : "gray"}
                    />
                    <Text className="ml-2 text-gray-700">Smoking Allowed</Text>
                  </View>
                  <Switch
                    value={smokingAllowed}
                    onValueChange={setSmokingAllowed}
                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                    thumbColor={smokingAllowed ? "#4285F4" : "#f4f3f4"}
                  />
                </View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-700">Pets Allowed</Text>
                  <Switch
                    value={petsAllowed}
                    onValueChange={setPetsAllowed}
                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                    thumbColor={petsAllowed ? "#4285F4" : "#f4f3f4"}
                  />
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-700">Music Allowed</Text>
                  <Switch
                    value={musicAllowed}
                    onValueChange={setMusicAllowed}
                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                    thumbColor={musicAllowed ? "#4285F4" : "#f4f3f4"}
                  />
                </View>
              </View>

              <TouchableOpacity
                className={`py-3 rounded-lg ${
                  actionLoading ? "bg-blue-300" : "bg-blue-500"
                }`}
                onPress={createTrip}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-center text-white font-bold text-lg">
                    Create Trip
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Trip Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View className="flex-1 bg-black bg-opacity-50">
          <View className="bg-white rounded-t-3xl mt-10 flex-1">
            <View className="flex-row justify-between items-center p-5 border-b border-gray-200">
              <Text className="text-xl font-bold">Edit Trip</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5">
              <Text className="font-medium mb-2">Departure Location*</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Enter departure location"
                value={departureLocation}
                onChangeText={setDepartureLocation}
              />

              <Text className="font-medium mb-2">Destination*</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Enter destination"
                value={destinationLocation}
                onChangeText={setDestinationLocation}
              />

              <Text className="font-medium mb-2">Departure Date*</Text>
              <TouchableOpacity
                className="border border-gray-200 rounded-lg p-3 mb-4 flex-row justify-between items-center"
                onPress={() => setShowDatePicker(true)}
              >
                <Text className="text-gray-700">
                  {departureDateString
                    ? formatDate(departureDateString)
                    : "Select date"}
                </Text>
                <Ionicons name="calendar" size={20} color="#4285F4" />
              </TouchableOpacity>

              {showDatePicker && (
                <View className="mb-4">
                  <CustomDatePicker />
                </View>
              )}

              <Text className="font-medium mb-2">Departure Time*</Text>
              <TouchableOpacity
                className="border border-gray-200 rounded-lg p-3 mb-4 flex-row justify-between items-center"
                onPress={() => setShowTimePicker(true)}
              >
                <Text className="text-gray-700">{departureTime}</Text>
                <Ionicons name="time" size={20} color="#4285F4" />
              </TouchableOpacity>

              {showTimePicker && (
                <View className="mb-4">
                  <CustomTimePicker />
                </View>
              )}

              <Text className="font-medium mb-2">Price (NPR)*</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Enter price"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />

              <Text className="font-medium mb-2">Available Seats*</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Enter number of seats"
                value={availableSeats}
                onChangeText={setAvailableSeats}
                keyboardType="numeric"
              />

              <Text className="font-medium mb-2">Description</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Enter trip description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text className="font-medium mb-2">Vehicle Details</Text>
              <View className="border border-gray-200 rounded-lg p-3 mb-4">
                <TextInput
                  className="border-b border-gray-200 p-2 mb-2"
                  placeholder="Vehicle Model*"
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                />
                <TextInput
                  className="border-b border-gray-200 p-2 mb-2"
                  placeholder="Vehicle Color*"
                  value={vehicleColor}
                  onChangeText={setVehicleColor}
                />
                <TextInput
                  className="p-2"
                  placeholder="License Plate Number*"
                  value={vehiclePlateNumber}
                  onChangeText={setVehiclePlateNumber}
                />
              </View>

              <Text className="font-medium mb-2">Preferences</Text>
              <View className="border border-gray-200 rounded-lg p-3 mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center">
                    <MaterialIcons
                      name="smoking-rooms"
                      size={20}
                      color={smokingAllowed ? "#4285F4" : "gray"}
                    />
                    <Text className="ml-2 text-gray-700">Smoking Allowed</Text>
                  </View>
                  <Switch
                    value={smokingAllowed}
                    onValueChange={setSmokingAllowed}
                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                    thumbColor={smokingAllowed ? "#4285F4" : "#f4f3f4"}
                  />
                </View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-700">Pets Allowed</Text>
                  <Switch
                    value={petsAllowed}
                    onValueChange={setPetsAllowed}
                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                    thumbColor={petsAllowed ? "#4285F4" : "#f4f3f4"}
                  />
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-700">Music Allowed</Text>
                  <Switch
                    value={musicAllowed}
                    onValueChange={setMusicAllowed}
                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                    thumbColor={musicAllowed ? "#4285F4" : "#f4f3f4"}
                  />
                </View>
              </View>

              <TouchableOpacity
                className={`py-3 rounded-lg ${
                  actionLoading ? "bg-blue-300" : "bg-blue-500"
                }`}
                onPress={editTrip}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-center text-white font-bold text-lg">
                    Update Trip
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
          <View
            className="bg-white rounded-t-3xl p-5"
            style={{ maxHeight: "80%" }}
          >
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
                        <Ionicons name="car" size={20} color="#4285F4" />
                        <Text className="ml-2 font-bold text-base">
                          {selectedTrip.vehicleDetails.model}
                        </Text>
                      </View>
                      <View
                        className={`px-2 py-1 rounded ${
                          selectedTrip.status === "scheduled"
                            ? "bg-blue-100"
                            : selectedTrip.status === "in-progress"
                            ? "bg-green-100"
                            : selectedTrip.status === "completed"
                            ? "bg-gray-100"
                            : "bg-red-100"
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            selectedTrip.status === "scheduled"
                              ? "text-blue-700"
                              : selectedTrip.status === "in-progress"
                              ? "text-green-700"
                              : selectedTrip.status === "completed"
                              ? "text-gray-700"
                              : "text-red-700"
                          }`}
                        >
                          {selectedTrip.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center mt-2">
                      <Text className="text-gray-700">
                        {selectedTrip.vehicleDetails.color} •{" "}
                        {selectedTrip.vehicleDetails.plateNumber}
                      </Text>
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="font-bold text-base mb-2">
                      Trip Information
                    </Text>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="location" size={20} color="green" />
                      <Text className="ml-2 text-gray-700">
                        {selectedTrip.departureLocation}
                      </Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="location" size={20} color="red" />
                      <Text className="ml-2 text-gray-700">
                        {selectedTrip.destinationLocation}
                      </Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="calendar" size={20} color="#4285F4" />
                      <Text className="ml-2 text-gray-700">
                        {formatDate(selectedTrip.departureDate)} at{" "}
                        {selectedTrip.departureTime}
                      </Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="people" size={20} color="#4285F4" />
                      <Text className="ml-2 text-gray-700">
                        {selectedTrip.bookedSeats.length}/
                        {selectedTrip.availableSeats} seats booked
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="cash" size={20} color="green" />
                      <Text className="ml-2 font-bold text-green-600">
                        NPR {selectedTrip.price}
                      </Text>
                    </View>
                  </View>

                  {selectedTrip.description && (
                    <View className="mb-4">
                      <Text className="font-bold text-base mb-2">
                        Description
                      </Text>
                      <Text className="text-gray-700">
                        {selectedTrip.description}
                      </Text>
                    </View>
                  )}

                  <View className="mb-4">
                    <Text className="font-bold text-base mb-2">
                      Preferences
                    </Text>
                    <View className="flex-row flex-wrap">
                      <View className="flex-row items-center mr-4 mb-2">
                        <MaterialIcons
                          name="smoking-rooms"
                          size={20}
                          color={
                            selectedTrip.preferences.smoking ? "green" : "gray"
                          }
                        />
                        <Text className="ml-1 text-gray-700">
                          {selectedTrip.preferences.smoking
                            ? "Smoking allowed"
                            : "No smoking"}
                        </Text>
                      </View>
                      <View className="flex-row items-center mr-4 mb-2">
                        <Ionicons
                          name="paw"
                          size={20}
                          color={
                            selectedTrip.preferences.pets ? "green" : "gray"
                          }
                        />
                        <Text className="ml-1 text-gray-700">
                          {selectedTrip.preferences.pets
                            ? "Pets allowed"
                            : "No pets"}
                        </Text>
                      </View>
                      <View className="flex-row items-center mb-2">
                        <Ionicons
                          name="musical-notes"
                          size={20}
                          color={
                            selectedTrip.preferences.music ? "green" : "gray"
                          }
                        />
                        <Text className="ml-1 text-gray-700">
                          {selectedTrip.preferences.music
                            ? "Music allowed"
                            : "No music"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="mb-4">
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="font-bold text-base">Passengers</Text>
                      <TouchableOpacity
                        className="bg-blue-100 px-3 py-1 rounded"
                        onPress={() => fetchPassengers(selectedTrip._id)}
                      >
                        <Text className="text-blue-700">View</Text>
                      </TouchableOpacity>
                    </View>
                    <Text className="text-gray-700">
                      {selectedTrip.bookedSeats.length} passenger
                      {selectedTrip.bookedSeats.length !== 1 ? "s" : ""} booked
                    </Text>
                  </View>

                  {/* Action buttons based on trip status */}
                  <View className="flex-row justify-between mb-3">
                    {selectedTrip.status === "scheduled" && (
                      <TouchableOpacity
                        className="flex-1 bg-blue-500 py-3 rounded-lg mr-2"
                        onPress={() => loadTripForEdit(selectedTrip)}
                      >
                        <Text className="text-center text-white font-medium">
                          Edit Trip
                        </Text>
                      </TouchableOpacity>
                    )}

                    {(selectedTrip.status === "completed" ||
                      selectedTrip.status === "cancelled" ||
                      selectedTrip.status === "scheduled") && (
                      <TouchableOpacity
                        className="flex-1 bg-red-500 py-3 rounded-lg ml-2"
                        onPress={() => setShowDeleteConfirm(true)}
                      >
                        <Text className="text-center text-white font-medium">
                          Delete Trip
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Status change buttons */}
                  <View className="flex-row justify-between">
                    {selectedTrip.status === "scheduled" && (
                      <>
                        <TouchableOpacity
                          className="flex-1 bg-green-600 py-3 rounded-lg mr-2"
                          onPress={() =>
                            updateTripStatus(selectedTrip._id, "in-progress")
                          }
                          disabled={actionLoading}
                        >
                          <Text className="text-center text-white font-medium">
                            Start Trip
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="flex-1 bg-red-500 py-3 rounded-lg ml-2"
                          onPress={() => {
                            Alert.alert(
                              "Cancel Trip",
                              "Are you sure you want to cancel this trip?",
                              [
                                { text: "No", style: "cancel" },
                                {
                                  text: "Yes",
                                  onPress: () =>
                                    updateTripStatus(
                                      selectedTrip._id,
                                      "cancelled"
                                    ),
                                },
                              ]
                            );
                          }}
                          disabled={actionLoading}
                        >
                          <Text className="text-center text-white font-medium">
                            Cancel Trip
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {selectedTrip.status === "in-progress" && (
                      <TouchableOpacity
                        className="flex-1 bg-green-500 py-3 rounded-lg"
                        onPress={() =>
                          updateTripStatus(selectedTrip._id, "completed")
                        }
                        disabled={actionLoading}
                      >
                        <Text className="text-center text-white font-medium">
                          Complete Trip
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-lg p-5 w-4/5">
            <Text className="text-lg font-bold mb-3">Delete Trip</Text>
            <Text className="mb-4">
              Are you sure you want to delete this trip? This action cannot be
              undone.
              {selectedTrip &&
                selectedTrip.bookedSeats &&
                selectedTrip.bookedSeats.length > 0 &&
                "\n\nNote: This trip has passengers who have booked seats. They will be notified of the cancellation."}
            </Text>
            <View className="flex-row justify-end">
              <TouchableOpacity
                className="bg-gray-200 px-4 py-2 rounded mr-2"
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-red-500 px-4 py-2 rounded"
                onPress={() => selectedTrip && deleteTrip(selectedTrip._id)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white">Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Passengers Modal */}
      <Modal
        visible={showPassengers}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPassengers(false)}
      >
        <View className="flex-1 justify-end bg-black bg-opacity-50">
          <View
            className="bg-white rounded-t-3xl p-5"
            style={{ maxHeight: "60%" }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold">Passengers</Text>
              <TouchableOpacity onPress={() => setShowPassengers(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            {actionLoading ? (
              <ActivityIndicator size="large" color="#4285F4" />
            ) : passengers.length > 0 ? (
              <FlatList
                data={passengers}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <View className="bg-gray-50 p-3 rounded-lg mb-2">
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center">
                        <FontAwesome5
                          name="user-circle"
                          size={20}
                          color="#4285F4"
                        />
                        <Text className="ml-2 font-medium">
                          {item.username}
                        </Text>
                      </View>
                      <TouchableOpacity
                        className="bg-blue-100 px-3 py-1 rounded"
                        onPress={() => {
                          // Open phone dialer
                          if (Platform.OS === "android") {
                            Linking.openURL(`tel:${item.phone}`);
                          } else {
                            Linking.openURL(`telprompt:${item.phone}`);
                          }
                        }}
                      >
                        <Text className="text-blue-700">{item.phone}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <View className="flex-1 justify-center items-center">
                <Text className="text-gray-500">
                  No passengers have booked this trip yet
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default DriverReserveBooking;
