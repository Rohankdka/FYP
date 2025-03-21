"use client"

import { View, Text, TouchableOpacity } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

const PaymentFailureScreen = () => {
  const { passengerId, error } = useLocalSearchParams<{
    passengerId: string
    error: string
  }>()

  const router = useRouter()

  const handleGoBack = () => {
    // Navigate back to the dashboard
    router.push({
      pathname: "/Dashboard/passengerDashboard",
      params: { passengerId },
    })
  }

  return (
    <View className="flex-1 bg-white p-6 justify-center items-center">
      <View className="w-full max-w-md bg-white rounded-xl p-6 shadow-md">
        <View className="items-center py-4">
          <View className="bg-red-100 p-4 rounded-full mb-4">
            <Ionicons name="close-circle" size={64} color="red" />
          </View>
          <Text className="text-xl font-bold text-red-600 mb-2">Payment Failed</Text>
          <Text className="text-gray-600 text-center mb-4">
            {error || "There was an issue processing your payment."}
          </Text>
          <TouchableOpacity className="bg-blue-500 py-3 px-6 rounded-lg w-full" onPress={handleGoBack}>
            <Text className="text-white font-bold text-center">Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default PaymentFailureScreen

