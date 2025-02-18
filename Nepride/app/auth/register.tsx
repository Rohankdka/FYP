import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInputProps,
  Modal,
} from "react-native";
import axios from "axios";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type Role = "driver" | "passenger";

type IconName =
  | "person-outline"
  | "mail-outline"
  | "lock-closed-outline"
  | "eye-outline"
  | "eye-off-outline"
  | "car-outline"
  | "car-sport-outline";

interface InputProps extends TextInputProps {
  label: string;
  icon: IconName;
  hasPasswordToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: "error" | "success";
}

const CustomInput: React.FC<InputProps> = ({
  label,
  icon,
  hasPasswordToggle,
  showPassword,
  onTogglePassword,
  ...props
}) => (
  <View className="mb-4">
    <Text className="text-gray-700 text-sm mb-2 font-medium">{label}</Text>
    <View className="flex-row items-center border border-gray-300 rounded-lg p-3 bg-gray-50">
      <Ionicons name={icon} size={24} color="#4B5563" />
      <TextInput
        className="flex-1 ml-2 text-base text-gray-800"
        placeholderTextColor="#9CA3AF"
        {...props}
      />
      {hasPasswordToggle && (
        <TouchableOpacity onPress={onTogglePassword}>
          <Ionicons
            name={showPassword ? "eye-outline" : "eye-off-outline"}
            size={24}
            color="#4B5563"
          />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const CustomAlert = ({
  visible,
  title,
  message,
  type,
  onClose,
}: AlertState & { onClose: () => void }) => (
  <Modal
    animationType="fade"
    transparent={true}
    visible={visible}
    onRequestClose={onClose}
  >
    <View className="flex-1 justify-center items-center bg-black/50">
      <View className="bg-white rounded-lg p-6 m-4 w-5/6 max-w-sm">
        <Text
          className={`text-lg font-bold mb-2 ${
            type === "error" ? "text-red-600" : "text-green-600"
          }`}
        >
          {title}
        </Text>
        <Text className="text-gray-700 mb-4">{message}</Text>
        <TouchableOpacity
          onPress={onClose}
          className={`py-2 px-4 rounded ${
            type === "error" ? "bg-red-600" : "bg-green-600"
          }`}
        >
          <Text className="text-white text-center font-semibold">OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

interface RoleOption {
  id: Role;
  icon: IconName;
  label: string;
}

const RegistrationScreen = () => {
  const router = useRouter();
  const { token } = useLocalSearchParams();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("passenger");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alert, setAlert] = useState<AlertState>({
    visible: false,
    title: "",
    message: "",
    type: "error",
  });

  const roles: RoleOption[] = [
    { id: "passenger", icon: "car-outline", label: "Passenger" },
    { id: "driver", icon: "car-sport-outline", label: "Driver" },
  ];

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const showAlert = (
    title: string,
    message: string,
    type: "error" | "success"
  ) => {
    setAlert({
      visible: true,
      title,
      message,
      type,
    });
  };

  const validateForm = (): boolean => {
    console.log("Validating form...");

    if (!username || username.length < 3) {
      console.log("Username validation failed");
      showAlert(
        "Invalid Username",
        "Username must be at least 3 characters long",
        "error"
      );
      return false;
    }

    if (!validateEmail(email)) {
      console.log("Email validation failed");
      showAlert("Invalid Email", "Please enter a valid email address", "error");
      return false;
    }

    if (password.length < 6) {
      console.log("Password validation failed");
      showAlert(
        "Invalid Password",
        "Password must be at least 6 characters long",
        "error"
      );
      return false;
    }

    if (password !== confirmPassword) {
      console.log("Password confirmation failed");
      showAlert("Password Mismatch", "Passwords do not match", "error");
      return false;
    }

    console.log("Form validation passed!");
    return true;
  };

  const handleRegister = async () => {
    console.log("Register button clicked");

    if (!validateForm()) {
      console.log("Form validation failed");
      return;
    }

    console.log("Form validated successfully");
    setLoading(true);

    try {
      console.log("Sending registration request...");
      const response = await axios.post(
        "http://localhost:3001/auth/register",
        { username, email, password, confirmPassword, role },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log("Registration response:", response.data);

      showAlert(
        "Success",
        "Registration successful! Please verify your email.",
        "success"
      );
    } catch (error: any) {
      console.error("Registration error:", error);

      const errorMessage = error.response?.data?.message
        ? error.response.data.message
        : error.message === "Network Error"
        ? "Unable to connect to server. Please check your internet connection."
        : "Registration failed. Please try again.";

      showAlert("Registration Error", errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAlertClose = () => {
    setAlert((prev) => ({ ...prev, visible: false }));

    // If it was a success alert, navigate after closing
    if (alert.type === "success") {
      router.push({ pathname: "/auth/verifyEmailOtp", params: { email } });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 p-6">
        <View className="mb-8">
          <Text className="text-3xl font-bold text-gray-800 mb-2">
            Create Account
          </Text>
          <Text className="text-gray-600 text-base">
            Join our community and start your journey
          </Text>
        </View>

        <CustomInput
          label="Username"
          icon="person-outline"
          value={username}
          onChangeText={setUsername}
          placeholder="Enter your username"
          autoCapitalize="none"
        />

        <CustomInput
          label="Email"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <CustomInput
          label="Password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry={!showPassword}
          hasPasswordToggle
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword(!showPassword)}
        />

        <CustomInput
          label="Confirm Password"
          icon="lock-closed-outline"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm your password"
          secureTextEntry={!showConfirmPassword}
          hasPasswordToggle
          showPassword={showConfirmPassword}
          onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
        />

        <View className="mb-6">
          <Text className="text-gray-700 text-sm mb-2 font-medium">
            Select Role
          </Text>
          <View className="flex-row justify-between">
            {roles.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setRole(item.id)}
                className={`flex-1 mx-1 p-3 rounded-lg border ${
                  role === item.id
                    ? "bg-blue-500 border-blue-500"
                    : "bg-gray-50 border-gray-300"
                }`}
              >
                <View className="items-center">
                  <Ionicons
                    name={item.icon}
                    size={24}
                    color={role === item.id ? "#ffffff" : "#4B5563"}
                  />
                  <Text
                    className={`text-sm mt-1 ${
                      role === item.id ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {item.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          className={`rounded-lg p-4 ${
            loading ? "bg-blue-300" : "bg-blue-500"
          } mb-4`}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold text-lg">
              Register
            </Text>
          )}
        </TouchableOpacity>

        <CustomAlert
          visible={alert.visible}
          title={alert.title}
          message={alert.message}
          type={alert.type}
          onClose={handleAlertClose}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default RegistrationScreen;
