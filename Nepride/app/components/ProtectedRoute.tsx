// components/ProtectedRoute.tsx
import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../context/authContext";
import { Text } from "react-native";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "driver" | "passenger";
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Text>Loading...</Text>; // Show a loading spinner
  }

  if (!user) {
    return <Redirect href="/auth/login" />; // Redirect to login if not authenticated
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Redirect href="/" />; // Redirect to home if role doesn't match
  }

  return <>{children}</>;
};

export default ProtectedRoute;