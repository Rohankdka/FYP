import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import "../global.css"; // Make sure this is valid, or you might need to import CSS in a different way
import { AuthProvider } from "./context/authContext";
export default function Layout() {
  const commonHeaderStyle = {
    headerStyle: styles.header,
    headerTitleStyle: styles.headerTitle,
    headerTintColor: "#FFFFFF",
    headerShadowVisible: false,
    headerBackTitleVisible: false,
    headerBackImage: () => (
      <Ionicons
        name="chevron-back"
        size={24}
        color="#FFFFFF"
        style={styles.backIcon}
      />
    ),
  };

  return (
    <AuthProvider>
      <Stack
        initialRouteName="landing/index"
        screenOptions={{
          animation: "slide_from_right",
          ...commonHeaderStyle,
          contentStyle: { backgroundColor: "#F5F6F8" },
        }}
      >
        {/* Landing Page */}
        <Stack.Screen
          name="landing/index"
          options={{
            headerShown: false,
          }}
        />

        {/* Auth Screens */}
        <Stack.Screen
          name="auth/login"
          options={{
            title: "Welcome Back",
            headerRight: () => (
              <Ionicons
                name="help-circle-outline"
                size={24}
                color="#FFFFFF"
                style={styles.helpIcon}
              />
            ),
          }}
        />
        <Stack.Screen
          name="auth/register"
          options={{
            title: "Register",
          }}
        />
        <Stack.Screen
          name="auth/forgotPassword"
          options={{
            title: "Forgot Password",
          }}
        />
        <Stack.Screen
          name="auth/resetPassword"
          options={{
            title: "Reset Password",
          }}
        />
        <Stack.Screen
          name="auth/sendPhoneOtp"
          options={{
            title: "Send Phone OTP",
          }}
        />
        <Stack.Screen
          name="auth/verifyEmailOtp"
          options={{
            title: "Verify Email",
          }}
        />

        {/* Driver Form Screens */}
        <Stack.Screen
          name="DriverForm/PersonalInformationForm"
          options={{
            title: "Personal Information",
          }}
        />
        <Stack.Screen
          name="DriverForm/VehicleInformationForm"
          options={{
            title: "Vehicle Information",
          }}
        />
        <Stack.Screen
          name="DriverForm/LicenseInformationForm"
          options={{
            title: "License Information",
          }}
        />
        <Stack.Screen
          name="DriverForm/driverForm"
          options={{
            title: "Driver Information",
          }}
        />

        {/* Dashboard Screens */}
        <Stack.Screen
          name="Dashboard/driverDashboard"
          options={{
            title: "Driver",
          }}
        />
        <Stack.Screen
          name="Dashboard/passengerDashboard"
          options={{
            title: "Passenger",
          }}
        />
        <Stack.Screen
          name="Dashboard/adminDashboard"
          options={{
            title: "Admin",
          }}
        />
      </Stack>
   </AuthProvider>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#2196F3",
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  backIcon: {
    marginLeft: 8,
  },
  helpIcon: {
    marginRight: 16,
  },
});
