"use client";

import { useState } from "react";
import { TouchableOpacity, Text, ActivityIndicator, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import axios from "axios";
import { MaterialIcons } from "@expo/vector-icons";

interface KhaltiButtonProps {
  rideId: string;
  passengerId: string;
  amount: number;
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
}

const API_URL = "http://192.168.1.70:3001";

const KhaltiButton = ({
  rideId,
  passengerId,
  amount,
  onSuccess,
  onFailure,
}: KhaltiButtonProps) => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePayment = async () => {
    if (!rideId) {
      Alert.alert("Cannot process payment", "Missing ride information");
      if (onFailure) onFailure("Missing ride ID");
      return;
    }

    setLoading(true);
    try {
      // Initialize payment
      const initResponse = await axios.post(`${API_URL}/payments/initialize`, {
        rideId,
        amount,
        passengerId,
      });

      if (!initResponse.data?.payment_url) {
        throw new Error("No payment URL received");
      }

      // Open payment page
      const result = await WebBrowser.openAuthSessionAsync(
        initResponse.data.payment_url,
        "nepride://payment/verify"
      );

      if (result.type === "success") {
        const url = new URL(result.url);
        const pidx = url.searchParams.get("pidx");

        if (pidx) {
          // Verify payment - using exact URL format from your API
          const verifyResponse = await axios.get(
            `${API_URL}/payments/verify?pidx=${pidx}`
          );

          if (verifyResponse.data?.success) {
            if (onSuccess) onSuccess();
            router.push("/payment/success");
          } else {
            throw new Error(
              verifyResponse.data?.message || "Verification failed"
            );
          }
        }
      } else {
        throw new Error("Payment was cancelled");
      }
    } catch (error) {
      console.error("Payment error:", error);
      Alert.alert(
        "Payment Error",
        error instanceof Error ? error.message : "Payment failed"
      );
      if (onFailure) onFailure("Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      className="bg-purple-600 py-3 rounded-lg flex-row justify-center items-center"
      onPress={handlePayment}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <>
          <MaterialIcons
            name="account-balance-wallet"
            size={20}
            color="white"
          />
          <Text className="ml-2 text-white font-bold">Pay with Khalti</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default KhaltiButton;
