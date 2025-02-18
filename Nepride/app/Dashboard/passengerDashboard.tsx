import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/authContext";

export default function PassengerDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  if (!user) {
    return <Text>Please log in to access the dashboard.</Text>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Passenger Dashboard</Text>
        <Text style={styles.subtitle}>Welcome, Passenger!</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Book a Ride</Text>
          <Text style={styles.cardText}>
            Find and book a ride to your destination.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ride History</Text>
          <Text style={styles.cardText}>
            View your past rides and receipts.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile</Text>
          <Text style={styles.cardText}>
            Update your profile and payment methods.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },
  scrollContainer: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: "#666",
  },
});