// screens/pendingApproval.tsx
import React from "react";
import { View, Text, Button } from "react-native";
import { useAuth } from "../context/authContext";
import { useRouter } from "expo-router";

const PendingApproval = () => {
  const { user } = useAuth();
  const router = useRouter();

  const handleRefresh = () => {
    // Logic to refresh user status, e.g., re-fetch user data
    // This could involve calling an API to check the user's current status
    // For now, we'll just navigate back to the dashboard
    router.push("/Dashboard/driverDashboard");
  };

  return (
    <View>
      <Text>Your driver application is pending approval.</Text>
      <Button title="Refresh Status" onPress={handleRefresh} />
    </View>
  );
};

export default PendingApproval;