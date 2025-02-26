// screens/auth/LoginScreen.js
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
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/authContext";

const LoginScreen = () => {
  const router = useRouter();
  const { login, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateForm = () => {
    if (!validateEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return false;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
  
    setIsLoggingIn(true);
    try {
      await login(email, password); // This will handle navigation with the `id`
    } catch (error) {
      Alert.alert("Error", "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-6">
          <View className="items-center mb-12 mt-8">
            <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-4">
              <Ionicons name="person-outline" size={40} color="#3B82F6" />
            </View>
            <Text className="text-3xl font-bold text-gray-800 mb-2">
              Welcome Back
            </Text>
            <Text className="text-gray-600 text-center">
              Sign in to continue your journey
            </Text>
          </View>

          <View className="mb-6">
            <Text className="text-gray-700 text-sm mb-2 font-medium">
              Email
            </Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg p-3 bg-gray-50">
              <Ionicons name="mail-outline" size={24} color="#4B5563" />
              <TextInput
                className="flex-1 ml-2 text-base text-gray-800"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-gray-700 text-sm mb-2 font-medium">
              Password
            </Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg p-3 bg-gray-50">
              <Ionicons name="lock-closed-outline" size={24} color="#4B5563" />
              <TextInput
                className="flex-1 ml-2 text-base text-gray-800"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={24}
                  color="#4B5563"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            className="mb-6"
            onPress={() => router.push("/auth/forgotPassword")}
          >
            <Text className="text-blue-500 text-right font-medium">
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`rounded-lg p-4 ${
              isLoggingIn || authLoading ? "bg-blue-300" : "bg-blue-500"
            } mb-6`}
            onPress={handleLogin}
            disabled={isLoggingIn || authLoading}
          >
            {isLoggingIn || authLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                Sign In
              </Text>
            )}
          </TouchableOpacity>

          <View className="flex-row justify-center items-center">
            <Text className="text-gray-600">Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/sendPhoneOtp")}>
              <Text className="text-blue-500 font-medium">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
