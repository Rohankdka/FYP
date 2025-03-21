"use client"

import { useEffect, useState } from "react"
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import axios from "axios"
import { Ionicons } from "@expo/vector-icons"

const API_URL = "http://192.168.1.70:3001"

const PaymentVerificationScreen = () => {
  const { pidx, payment_id, rideId, passengerId } = useLocalSearchParams<{
    pidx: string
    payment_id: string
    rideId: string
    passengerId: string
  }>()

  const router = useRouter()
  const [verifying, setVerifying] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentData, setPaymentData] = useState<any>(null)

  useEffect(() => {
    if (!pidx) {
      setError("Missing payment information")
      setVerifying(false)
      return
    }

    const verifyPayment = async () => {
      try {
        console.log("Verifying payment with pidx:", pidx)
        const response = await axios.get(`${API_URL}/payments/verify?pidx=${pidx}`)

        console.log("Payment verification response:", response.data)

        if (response.data.success) {
          setSuccess(true)
          setPaymentData(response.data.data)

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
                  fare: paymentData?.total_amount / 100, // Convert from paisa to NPR
                })
              }
            } catch (socketError) {
              console.error("Error emitting socket event:", socketError)
            }
          }
        } else {
          setSuccess(false)
          setError("Payment verification failed")
        }
      } catch (err) {
        console.error("Error verifying payment:", err)
        setSuccess(false)
        setError("Failed to verify payment. Please contact support.")
      } finally {
        setVerifying(false)
      }
    }

    verifyPayment()
  }, [pidx, rideId, passengerId, paymentData])

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
        <Text className="text-2xl font-bold text-center mb-6">Payment Verification</Text>

        {verifying ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#4285F4" />
            <Text className="mt-4 text-gray-600 text-center">Verifying your payment...</Text>
          </View>
        ) : success ? (
          <View className="items-center py-4">
            <View className="bg-green-100 p-4 rounded-full mb-4">
              <Ionicons name="checkmark-circle" size={64} color="green" />
            </View>
            <Text className="text-xl font-bold text-green-600 mb-2">Payment Successful!</Text>
            <Text className="text-gray-600 text-center mb-4">Your payment has been successfully processed.</Text>
            {paymentData && (
              <View className="bg-gray-50 p-4 rounded-lg w-full mb-4">
                <Text className="font-medium">Transaction Details:</Text>
                <Text className="text-gray-600">Amount: NPR {paymentData.total_amount / 100}</Text>
                <Text className="text-gray-600">Transaction ID: {paymentData.transaction_id}</Text>
                <Text className="text-gray-600">Status: {paymentData.status}</Text>
              </View>
            )}
            <TouchableOpacity className="bg-blue-500 py-3 px-6 rounded-lg w-full" onPress={handleGoBack}>
              <Text className="text-white font-bold text-center">Return to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
        )}
      </View>
    </View>
  )
}

export default PaymentVerificationScreen

