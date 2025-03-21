"use client"

import { useEffect } from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

const PaymentSuccessScreen = () => {
  const { rideId, passengerId, amount } = useLocalSearchParams<{
    rideId: string
    passengerId: string
    amount: string
  }>()

  const router = useRouter()

  useEffect(() => {
    // Notify the server about the successful payment
    if (rideId && passengerId) {
      try {
        // Emit socket event for payment completion
        const socket = (window as any).socket
        if (socket) {
          socket.emit("payment-completed", {
            rideId,
            paymentMethod: "khalti",
            passengerId,
            fare: Number.parseFloat(amount || "0"),
          })
        }
      } catch (error) {
        console.error("Error emitting socket event:", error)
      }
    }
  }, [rideId, passengerId, amount])

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
          <View className="bg-green-100 p-4 rounded-full mb-4">
            <Ionicons name="checkmark-circle" size={64} color="green" />
          </View>
          <Text className="text-xl font-bold text-green-600 mb-2">Payment Successful!</Text>
          <Text className="text-gray-600 text-center mb-4">Your payment has been successfully processed.</Text>
          <View className="bg-gray-50 p-4 rounded-lg w-full mb-4">
            <Text className="font-medium">Payment Details:</Text>
            <Text className="text-gray-600">Amount: NPR {amount || "0"}</Text>
            <Text className="text-gray-600">Payment Method: Khalti</Text>
            <Text className="text-gray-600">Status: Completed</Text>
          </View>
          <TouchableOpacity className="bg-blue-500 py-3 px-6 rounded-lg w-full" onPress={handleGoBack}>
            <Text className="text-white font-bold text-center">Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default PaymentSuccessScreen

