import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/authContext";

type RouteType =
  | "/DriverForm/PersonalInformationForm"
  | "/DriverForm/VehicleInformationForm"
  | "/DriverForm/LicenseInformationForm";

interface FormOption {
  title: string;
  route: RouteType;
  icon: string;
  description: string;
}

const DriverForm = () => {
  const router = useRouter();
  const { user, loading } = useAuth(); // Getting user details from context

  
  // Check if user is a driver, otherwise navigate away or show an error
  useEffect(() => {
    if (loading) return; // Wait until loading is complete
    if (user?.role !== "driver") {
      // If the user is not a driver, navigate to a different page (like dashboard)
      router.push("/auth/login");
    }
  }, [user, loading]);

  const formOptions: FormOption[] = [
    {
      title: "Personal Information",
      route: "/DriverForm/PersonalInformationForm",
      icon: "👤",
      description: "Add your basic details and photo",
    },
    {
      title: "Vehicle Information",
      route: "/DriverForm/VehicleInformationForm",
      icon: "🚗",
      description: "Enter your vehicle details and documents",
    },
    {
      title: "License Information",
      route: "/DriverForm/LicenseInformationForm",
      icon: "📄",
      description: "Provide your license details",
    },
  ] as const;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Driver Registration</Text>
          <Text style={styles.subtitle}>
            Complete all sections to register as a driver
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {formOptions.map((option, index) => (
            <TouchableOpacity
              key={option.route}
              style={[
                styles.card,
                index === formOptions.length - 1 && styles.lastCard,
              ]}
              onPress={() => router.push(option.route)}
            >
              <View style={styles.cardContent}>
                <View style={styles.iconContainer}>
                  <Text style={styles.icon}>{option.icon}</Text>
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.cardTitle}>{option.title}</Text>
                  <Text style={styles.cardDescription}>
                    {option.description}
                  </Text>
                </View>
                <Text style={styles.arrowIcon}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Please complete all sections in order
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },
  cardsContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginBottom: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  lastCard: {
    marginBottom: 0,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0f7ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
  },
  arrowIcon: {
    fontSize: 20,
    color: "#2196F3",
    marginLeft: 16,
  },
  footer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#666",
  },
});

export default DriverForm;
