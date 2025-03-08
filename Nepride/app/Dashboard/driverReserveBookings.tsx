import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the API URL
const API_URL = 'http://192.168.1.70:3001/trip'; 

// Define route param types
type RouteParams = {
  tripId?: string;
};

// Define types
interface Trip {
  _id: string;
  departureLocation: string;
  destinationLocation: string;
  departureDate: string;
  departureTime: string;
  price: number;
  availableSeats: number;
  description?: string;
  vehicleDetails?: string;
  preferences?: string[];
  driver: {
    _id: string;
    fullName: string;
    phoneNumber: string;
  };
}

interface BookingDetails {
  seats: number;
  specialRequests?: string;
}

const ReserveBooking = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const tripId = route.params?.tripId;

  // States
  const [loading, setLoading] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({
    seats: 1,
    specialRequests: '',
  });
  const [searchParams, setSearchParams] = useState({
    departureLocation: '',
    destinationLocation: '',
    departureDate: new Date(),
    availableSeats: 1,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchResults, setSearchResults] = useState<Trip[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Fetch token on component mount
  useEffect(() => {
    const getToken = async () => {
      const userToken = await AsyncStorage.getItem('userToken');
      setToken(userToken);
    };
    getToken();
  }, []);

  // Fetch trip details if tripId is provided
  useEffect(() => {
    if (tripId) {
      fetchTripDetails();
    }
  }, [tripId]);

  const fetchTripDetails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/trips/${tripId}`);
      if (response.data.success) {
        setTrip(response.data.data.trip);
      } else {
        Alert.alert('Error', 'Failed to fetch trip details');
      }
    } catch (error) {
      console.error('Error fetching trip details:', error);
      Alert.alert('Error', 'An error occurred while fetching trip details');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const formattedDate = searchParams.departureDate.toISOString().split('T')[0];
      
      const response = await axios.get(`${API_URL}/trips/search`, {
        params: {
          departureLocation: searchParams.departureLocation,
          destinationLocation: searchParams.destinationLocation,
          departureDate: formattedDate,
          availableSeats: searchParams.availableSeats,
        },
      });

      if (response.data.success) {
        setSearchResults(response.data.data.trips);
      } else {
        Alert.alert('Search Failed', 'No trips found matching your criteria');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching trips:', error);
      Alert.alert('Error', 'An error occurred while searching for trips');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookTrip = async () => {
    if (!token) {
      Alert.alert('Authentication Required', 'Please log in to book a trip');
      // Navigate to login screen
      // navigation.navigate('Login');
      return;
    }

    if (!trip) return;

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/bookings/create`,
        {
          tripId: trip._id,
          seats: bookingDetails.seats,
          specialRequests: bookingDetails.specialRequests,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setBookingSuccess(true);
        setTimeout(() => {
          setShowBookingModal(false);
          setBookingSuccess(false);
          // Navigate to bookings screen or refresh current screen
          // navigation.navigate('MyBookings');
        }, 2000);
      } else {
        Alert.alert('Booking Failed', response.data.errors[0].message);
      }
    } catch (error: any) {
      console.error('Error booking trip:', error);
      Alert.alert(
        'Booking Failed',
        error.response?.data?.errors?.[0]?.message || 'An error occurred while booking the trip'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setSearchParams({ ...searchParams, departureDate: selectedDate });
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const renderSearchForm = () => (
    <View className="bg-white rounded-lg p-4 shadow-md mb-4">
      <Text className="text-lg font-bold mb-4 text-gray-800">Find a Trip</Text>
      
      <View className="mb-4">
        <Text className="text-gray-700 mb-1">From</Text>
        <View className="flex-row items-center border border-gray-300 rounded-md px-3 py-2">
          <Ionicons name="location-outline" size={20} color="#4CAF50" />
          <TextInput
            className="flex-1 ml-2 text-gray-800"
            placeholder="Departure Location"
            value={searchParams.departureLocation}
            onChangeText={(text) => setSearchParams({ ...searchParams, departureLocation: text })}
          />
        </View>
      </View>
      
      <View className="mb-4">
        <Text className="text-gray-700 mb-1">To</Text>
        <View className="flex-row items-center border border-gray-300 rounded-md px-3 py-2">
          <Ionicons name="location-outline" size={20} color="#F44336" />
          <TextInput
            className="flex-1 ml-2 text-gray-800"
            placeholder="Destination Location"
            value={searchParams.destinationLocation}
            onChangeText={(text) => setSearchParams({ ...searchParams, destinationLocation: text })}
          />
        </View>
      </View>
      
      <View className="mb-4">
        <Text className="text-gray-700 mb-1">Date</Text>
        <TouchableOpacity 
          className="flex-row items-center border border-gray-300 rounded-md px-3 py-2"
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#2196F3" />
          <Text className="flex-1 ml-2 text-gray-800">
            {formatDate(searchParams.departureDate)}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={searchParams.departureDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
      </View>
      
      <View className="mb-4">
        <Text className="text-gray-700 mb-1">Seats</Text>
        <View className="flex-row items-center border border-gray-300 rounded-md px-3 py-2">
          <Ionicons name="people-outline" size={20} color="#9C27B0" />
          <TextInput
            className="flex-1 ml-2 text-gray-800"
            placeholder="Number of Seats"
            keyboardType="numeric"
            value={searchParams.availableSeats.toString()}
            onChangeText={(text) => {
              const seats = parseInt(text) || 1;
              setSearchParams({ ...searchParams, availableSeats: seats });
            }}
          />
        </View>
      </View>
      
      <TouchableOpacity
        className="bg-blue-500 py-3 rounded-md items-center"
        onPress={handleSearch}
        disabled={isSearching}
      >
        {isSearching ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-white font-bold">Search Trips</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSearchResults = () => (
    <View className="mb-4">
      <Text className="text-lg font-bold mb-2 text-gray-800">
        {searchResults.length > 0 
          ? `Found ${searchResults.length} trips` 
          : 'No trips found'}
      </Text>
      
      {searchResults.map((trip) => (
        <TouchableOpacity
          key={trip._id}
          className="bg-white rounded-lg p-4 shadow-md mb-3"
          onPress={() => {
            setTrip(trip);
            setShowBookingModal(true);
          }}
        >
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-lg font-bold text-gray-800">
              {trip.departureLocation} to {trip.destinationLocation}
            </Text>
            <Text className="text-green-600 font-bold">${trip.price}</Text>
          </View>
          
          <View className="flex-row mb-2">
            <View className="flex-row items-center mr-4">
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text className="ml-1 text-gray-600">
                {new Date(trip.departureDate).toLocaleDateString()}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text className="ml-1 text-gray-600">{trip.departureTime}</Text>
            </View>
          </View>
          
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <FontAwesome5 name="user-alt" size={14} color="#666" />
              <Text className="ml-1 text-gray-600">{trip.driver.fullName}</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="car-outline" size={16} color="#666" />
              <Text className="ml-1 text-gray-600">{trip.availableSeats} seats available</Text>
            </View>
          </View>
          
          <View className="mt-2 pt-2 border-t border-gray-200">
            <Text className="text-blue-500">Tap to view details and book</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTripDetails = () => {
    if (!trip) return null;
    
    return (
      <View className="bg-white rounded-lg p-4 shadow-md mb-4">
        <Text className="text-xl font-bold mb-3 text-gray-800">Trip Details</Text>
        
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
              <Ionicons name="location" size={20} color="#4CAF50" />
            </View>
            <View className="ml-3">
              <Text className="text-xs text-gray-500">From</Text>
              <Text className="text-base font-medium text-gray-800">{trip.departureLocation}</Text>
            </View>
          </View>
          
          <View className="h-10 border-l-2 border-dashed border-gray-300 ml-5" />
          
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
              <Ionicons name="location" size={20} color="#F44336" />
            </View>
            <View className="ml-3">
              <Text className="text-xs text-gray-500">To</Text>
              <Text className="text-base font-medium text-gray-800">{trip.destinationLocation}</Text>
            </View>
          </View>
        </View>
        
        <View className="flex-row mb-4 justify-between">
          <View className="flex-1 mr-2 p-3 bg-gray-50 rounded-lg">
            <Text className="text-xs text-gray-500">Date</Text>
            <Text className="text-sm font-medium text-gray-800">
              {new Date(trip.departureDate).toLocaleDateString()}
            </Text>
          </View>
          <View className="flex-1 ml-2 p-3 bg-gray-50 rounded-lg">
            <Text className="text-xs text-gray-500">Time</Text>
            <Text className="text-sm font-medium text-gray-800">{trip.departureTime}</Text>
          </View>
        </View>
        
        <View className="flex-row mb-4 justify-between">
          <View className="flex-1 mr-2 p-3 bg-gray-50 rounded-lg">
            <Text className="text-xs text-gray-500">Price</Text>
            <Text className="text-sm font-medium text-green-600">${trip.price}</Text>
          </View>
          <View className="flex-1 ml-2 p-3 bg-gray-50 rounded-lg">
            <Text className="text-xs text-gray-500">Available Seats</Text>
            <Text className="text-sm font-medium text-gray-800">{trip.availableSeats}</Text>
          </View>
        </View>
        
        <View className="p-3 bg-gray-50 rounded-lg mb-4">
          <Text className="text-xs text-gray-500">Driver</Text>
          <View className="flex-row items-center mt-1">
            <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
              <FontAwesome5 name="user-alt" size={14} color="#2196F3" />
            </View>
            <Text className="ml-2 text-sm font-medium text-gray-800">{trip.driver.fullName}</Text>
          </View>
        </View>
        
        {trip.description && (
          <View className="p-3 bg-gray-50 rounded-lg mb-4">
            <Text className="text-xs text-gray-500">Description</Text>
            <Text className="text-sm text-gray-800 mt-1">{trip.description}</Text>
          </View>
        )}
        
        {trip.vehicleDetails && (
          <View className="p-3 bg-gray-50 rounded-lg mb-4">
            <Text className="text-xs text-gray-500">Vehicle Details</Text>
            <Text className="text-sm text-gray-800 mt-1">{trip.vehicleDetails}</Text>
          </View>
        )}
        
        <TouchableOpacity
          className="bg-blue-500 py-3 rounded-md items-center"
          onPress={() => setShowBookingModal(true)}
        >
          <Text className="text-white font-bold">Book This Trip</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderBookingModal = () => (
    <Modal
      visible={showBookingModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowBookingModal(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
        <View className="bg-black bg-opacity-50 flex-1 justify-end">
          <View className="bg-white rounded-t-3xl p-5">
            {bookingSuccess ? (
              <View className="items-center py-10">
                <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                <Text className="text-xl font-bold mt-4 text-gray-800">Booking Successful!</Text>
                <Text className="text-gray-600 text-center mt-2">
                  Your trip has been booked successfully. You can view your booking details in the My Bookings section.
                </Text>
              </View>
            ) : (
              <>
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-xl font-bold text-gray-800">Book Trip</Text>
                  <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                
                {trip && (
                  <View className="mb-4">
                    <Text className="text-lg font-semibold text-gray-800">
                      {trip.departureLocation} to {trip.destinationLocation}
                    </Text>
                    <Text className="text-gray-600">
                      {new Date(trip.departureDate).toLocaleDateString()} at {trip.departureTime}
                    </Text>
                  </View>
                )}
                
                <View className="mb-4">
                  <Text className="text-gray-700 mb-1">Number of Seats</Text>
                  <View className="flex-row items-center border border-gray-300 rounded-md px-3 py-2">
                    <Ionicons name="people-outline" size={20} color="#666" />
                    <TextInput
                      className="flex-1 ml-2 text-gray-800"
                      placeholder="Number of Seats"
                      keyboardType="numeric"
                      value={bookingDetails.seats.toString()}
                      onChangeText={(text) => {
                        const seats = parseInt(text) || 1;
                        setBookingDetails({ ...bookingDetails, seats });
                      }}
                    />
                  </View>
                  {trip && bookingDetails.seats > trip.availableSeats && (
                    <Text className="text-red-500 text-xs mt-1">
                      Only {trip.availableSeats} seats available
                    </Text>
                  )}
                </View>
                
                <View className="mb-4">
                  <Text className="text-gray-700 mb-1">Special Requests (Optional)</Text>
                  <TextInput
                    className="border border-gray-300 rounded-md px-3 py-2 text-gray-800 h-20"
                    placeholder="Any special requests or notes for the driver"
                    multiline
                    value={bookingDetails.specialRequests}
                    onChangeText={(text) => setBookingDetails({ ...bookingDetails, specialRequests: text })}
                  />
                </View>
                
                {trip && (
                  <View className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <Text className="text-gray-700 font-semibold">Price Summary</Text>
                    <View className="flex-row justify-between mt-2">
                      <Text className="text-gray-600">Price per seat</Text>
                      <Text className="text-gray-800">${trip.price}</Text>
                    </View>
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-gray-600">Number of seats</Text>
                      <Text className="text-gray-800">x {bookingDetails.seats}</Text>
                    </View>
                    <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
                      <Text className="text-gray-800 font-bold">Total</Text>
                      <Text className="text-green-600 font-bold">
                        ${(trip.price * bookingDetails.seats).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}
                
                <TouchableOpacity
                  className="bg-blue-500 py-3 rounded-md items-center"
                  onPress={handleBookTrip}
                  disabled={loading || (trip ? bookingDetails.seats > trip.availableSeats : false)}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white font-bold">Confirm Booking</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView className="flex-1 p-4">
        {tripId ? (
          // If tripId is provided, show trip details
          loading ? (
            <View className="flex-1 justify-center items-center py-10">
              <ActivityIndicator size="large" color="#4285F4" />
              <Text className="mt-4 text-gray-600">Loading trip details...</Text>
            </View>
          ) : (
            renderTripDetails()
          )
        ) : (
          // If no tripId, show search form and results
          <>
            {renderSearchForm()}
            {searchResults.length > 0 && renderSearchResults()}
          </>
        )}
      </ScrollView>
      
      {renderBookingModal()}
    </SafeAreaView>
  );
};

export default ReserveBooking;