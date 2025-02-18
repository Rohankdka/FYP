import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import axios from "axios";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const PhoneVerificationScreen = () => {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const startResendTimer = () => {
    setTimeLeft(30);
    const interval = setInterval(() => {
      setTimeLeft((time) => {
        if (time <= 1) {
          clearInterval(interval);
          return 0;
        }
        return time - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:3001/auth/sendphoneotp",
        { phone }
      );
      console.log("Response:", response.data);

      if (response.data.message) {
        setIsOtpSent(true);
        startResendTimer();
        Alert.alert("Success", response.data.message);
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.log("Axios Error:", error.response?.data || error.message);
        Alert.alert(
          "Error",
          error.response?.data?.message || "Failed to send OTP."
        );
      } else {
        console.log("Unexpected Error:", error);
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) {
      Alert.alert("Error", "Please enter a valid OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:3001/auth/verifyphoneotp",
        { phone, otp }
      );
      console.log("Response:", response.data);

      if (response.data.message === "Phone verified successfully") {
        const { token } = response.data;
        Alert.alert("Success", "Phone verified successfully!");
        router.push({ pathname: "/auth/register", params: { token } });
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.log("Axios Error:", error.response?.data || error.message);
        Alert.alert(
          "Error",
          error.response?.data?.message || "Invalid or expired OTP."
        );
      } else {
        console.log("Unexpected Error:", error);
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="p-6 flex-1 justify-center">
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-800 mb-2">
              Phone Verification
            </Text>
            <Text className="text-gray-600 text-base">
              We'll send you a one-time code to verify your phone number
            </Text>
          </View>

          {/* Phone Number Input */}
          <View className="mb-6">
            <Text className="text-gray-700 text-sm mb-2 font-medium">
              Phone Number
            </Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg p-3 bg-gray-50">
              <Ionicons
                name="phone-portrait-outline"
                size={24}
                color="#4B5563"
              />
              <TextInput
                className="flex-1 ml-2 text-base text-gray-800"
                placeholder="Enter your phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!isOtpSent}
                maxLength={15}
              />
            </View>
          </View>

          {/* OTP Input */}
          {isOtpSent && (
            <View className="mb-6">
              <Text className="text-gray-700 text-sm mb-2 font-medium">
                Enter OTP
              </Text>
              <View className="flex-row items-center border border-gray-300 rounded-lg p-3 bg-gray-50">
                <Ionicons
                  name="lock-closed-outline"
                  size={24}
                  color="#4B5563"
                />
                <TextInput
                  className="flex-1 ml-2 text-base text-gray-800"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry
                />
              </View>
            </View>
          )}

          {/* Send OTP / Verify OTP Button */}
          <TouchableOpacity
            className={`rounded-lg p-4 ${
              loading ? "bg-blue-300" : "bg-blue-500"
            } mb-4`}
            onPress={isOtpSent ? handleVerifyOtp : handleSendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                {isOtpSent ? "Verify OTP" : "Send OTP"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend OTP */}
          {isOtpSent && (
            <TouchableOpacity
              disabled={timeLeft > 0}
              onPress={handleSendOtp}
              className="mt-2"
            >
              <Text
                className={`text-center ${
                  timeLeft > 0 ? "text-gray-400" : "text-blue-500"
                }`}
              >
                {timeLeft > 0 ? `Resend OTP in ${timeLeft}s` : "Resend OTP"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Already have an account? Login */}
          <TouchableOpacity
            className="mt-6"
            onPress={() => router.push("/auth/login")}
          >
            <Text className="text-center text-blue-500 font-medium">
              Already have an account? Log in
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default PhoneVerificationScreen;
