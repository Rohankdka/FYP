"use client"

import { View, Text, TouchableOpacity, SafeAreaView, StatusBar } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

export default function PaymentFailure() {
  const router = useRouter()
  const { passengerId } = useLocalSearchParams<{ passengerId: string }>()

  const handleRetry = () => {
    // Go back to the dashboard where they can try payment again
    router.replace({
      pathname: "/Dashboard/passengerDashboard",
      params: { passengerId },
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View className="flex-1 justify-center items-center p-4">
        <View className="bg-red-100 rounded-full p-6 mb-4">
          <Ionicons name="close-circle" size={80} color="#ef4444" />
        </View>

        <Text className="text-2xl font-bold text-red-600 mb-2">Payment Failed</Text>
        <Text className="text-base text-center text-gray-600 mb-8">
          We couldn't process your payment. Please try again or choose a different payment method.
        </Text>

        <TouchableOpacity className="bg-blue-500 py-3 px-6 rounded-lg w-64" onPress={handleRetry}>
          <Text className="text-white font-bold text-center">Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

