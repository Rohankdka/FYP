// screens/Dashboard/driverDashboard.tsx
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { useAuth } from "../context/authContext";
import { useRouter } from "expo-router";

const DriverDashboard = () => {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "driver") {
      if (user?.status === "pending") {
        router.push("/Dashboard/pendingApproval"); // Redirect to pending approval screen
      } else if (user?.status === "approved") {
        // Optionally, you can handle the approved state here
        console.log("Driver approved, show dashboard content.");
      } else if (user?.status === "rejected") {
        // Handle rejected state, e.g., show a message or redirect
        console.log("Driver application rejected.");
        // You can redirect to a different screen or show a message
      }
    }
  }, [user]);

  return (
    <View>
      <Text>Welcome to the Driver Dashboard!</Text>
      {/* Additional dashboard content can go here */}
    </View>
  );
};

export default DriverDashboard;