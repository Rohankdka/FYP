import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Link } from "expo-router"; // Import the Link component

export default function Landing() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
      }}
    >
      {/* Logo Image */}
      <Image
        source={require("../photos/logo.png")} // Ensure the path to the image is correct
        style={{
          width: 144, // Tailwind's w-36 = 144px
          height: 144, // Tailwind's h-36 = 144px
          marginBottom: 24,
        }}
        resizeMode="contain"
      />

      <Text style={{ fontSize: 32, fontWeight: "bold", marginBottom: 24 }}>
        NEPRIDE
      </Text>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>
        Ride Sharing System
      </Text>

      {/* Use Link to navigate to /register */}
      <Link href="/auth/sendPhoneOtp">
        <TouchableOpacity
          style={{
            backgroundColor: "#3b82f6",
            paddingVertical: 16,
            paddingHorizontal: 32,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "white", fontSize: 18 }}>Get Started</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
