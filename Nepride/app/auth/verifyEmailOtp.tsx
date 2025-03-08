import React, { useState, useEffect } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const EmailVerificationScreen = () => {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const handleResendOtp = async () => {
    try {
      setLoading(true);
      await axios.post("http://localhost:3001/auth/resend-email-otp", {
        email,
      });
      setTimeLeft(30);
      Alert.alert("Success", "New OTP has been sent to your email");
    } catch (error) {
      Alert.alert("Error", "Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!otp.trim()) {
      Alert.alert("Error", "Please enter the OTP");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(
        "http://192.168.1.70:3001/auth/verify-email",
        { email, otp }
      );

      if (response.data.message === "Email verified successfully") {
        const userRole = response.data.role;
        if (userRole === "driver") {
          // Pass both email and userId
          router.push({
            pathname: "/DriverForm/PersonalInformationForm",
            params: {
              email,
              userId: response.data._id,
            },
          });
        }else if (userRole === "passenger") {
          // Redirect passenger to login page
          router.push("/auth/login");
        }
      }
    } catch (error) {
      Alert.alert("Error", "Invalid or expired OTP. Please try again.");
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
        <View className="flex-1 p-6 justify-center">
          <View className="items-center mb-8">
            <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-4">
              <Ionicons name="mail-outline" size={40} color="#3B82F6" />
            </View>
            <Text className="text-3xl font-bold text-gray-800 mb-2">
              Verify Your Email
            </Text>
            <Text className="text-gray-600 text-center mb-2">
              We've sent a verification code to
            </Text>
            <Text className="text-blue-500 font-semibold">{email}</Text>
          </View>

          <View className="mb-6">
            <Text className="text-gray-700 text-sm mb-2 font-medium">
              Enter Verification Code
            </Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg p-3 bg-gray-50">
              <Ionicons name="key-outline" size={24} color="#4B5563" />
              <TextInput
                className="flex-1 ml-2 text-base text-gray-800"
                placeholder="Enter OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="numeric"
                maxLength={6}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <TouchableOpacity
            className={`rounded-lg p-4 ${
              loading ? "bg-blue-300" : "bg-blue-500"
            } mb-4`}
            onPress={handleVerifyEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                Verify Email
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResendOtp}
            disabled={timeLeft > 0 || loading}
            className="mt-2"
          >
            <Text
              className={`text-center ${
                timeLeft > 0 || loading ? "text-gray-400" : "text-blue-500"
              }`}
            >
              {timeLeft > 0
                ? `Resend code in ${timeLeft}s`
                : "Resend verification code"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EmailVerificationScreen;
