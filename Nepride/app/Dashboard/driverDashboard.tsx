// screens/Dashboard/driverDashboard.tsx
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { useAuth } from "../context/authContext";
import { useRouter } from "expo-router";

const DriverDashboard = () => {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "driver" && user?.status !== "approved") {
      router.push("/Dashboard/pendingApproval"); // Redirect to pending approval screen
    }
  }, [user]);

  return (
    <View>
      <Text>Welcome to the Driver Dashboard!</Text>
    </View>
  );
};

export default DriverDashboard;