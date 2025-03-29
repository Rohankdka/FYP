"use client"

import { useEffect, useState } from "react"
import { View, Text, TouchableOpacity, Image, ActivityIndicator, SafeAreaView, StatusBar } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import axios from "axios"
import getSocket from "../components/socket"

const API_BASE_URL = "http://192.168.1.70:3001/api"
const API_URL = "http://192.168.1.70:3001"

const PaymentSuccessScreen = () => {
  const { rideId, passengerId, amount, pidx } = useLocalSearchParams<{
    rideId: string
    passengerId: string
    amount: string
    pidx?: string
  }>()

  const [isVerifying, setIsVerifying] = useState<boolean>(!!pidx)
  const [verificationComplete, setVerificationComplete] = useState<boolean>(false)
  const [isEmittingEvent, setIsEmittingEvent] = useState<boolean>(false)
  const [eventEmitted, setEventEmitted] = useState<boolean>(false)
  const [retryCount, setRetryCount] = useState<number>(0)
  const router = useRouter()
  const socket = getSocket()

  // Log params for debugging
  useEffect(() => {
    console.log("Success screen params:", { rideId, passengerId, amount, pidx })
  }, [rideId, passengerId, amount, pidx])

  // Verify payment status if pidx is provided
  useEffect(() => {
    const verifyPayment = async () => {
      if (pidx) {
        try {
          setIsVerifying(true)
          console.log("Verifying payment with pidx:", pidx)

          // Try both possible verification endpoints
          let verifyResponse
          try {
            verifyResponse = await axios.get(`${API_BASE_URL}/payments/verify?pidx=${pidx}`)
            console.log("Verification response from primary endpoint:", verifyResponse.data)
          } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              // If 404, try the alternative endpoint
              console.log("Primary verify endpoint not found, trying alternative endpoint...")
              verifyResponse = await axios.post(`${API_BASE_URL}/khalti/verify`, {
                pidx,
                rideId,
              })
              console.log("Verification response from alternative endpoint:", verifyResponse.data)
            } else {
              throw error
            }
          }

          if (!verifyResponse?.data?.success && !verifyResponse?.data?.status) {
            // If verification failed, redirect to failure page
            console.error("Payment verification failed:", verifyResponse?.data)
            router.replace({
              pathname: "/payment/failure",
              params: { passengerId },
            })
            return
          }

          // Update ride payment status directly via API
          try {
            await axios.put(`${API_URL}/ride/payment`, {
              rideId,
              paymentStatus: "completed",
              paymentMethod: "khalti",
            })
            console.log("Ride payment status updated via API")
          } catch (updateError) {
            console.error("Failed to update ride payment status via API:", updateError)
          }

          setVerificationComplete(true)
        } catch (error) {
          console.error("Error verifying payment:", error)
          // On error, redirect to failure page
          router.replace({
            pathname: "/payment/failure",
            params: { passengerId },
          })
        } finally {
          setIsVerifying(false)
        }
      } else {
        // If no pidx, assume payment was already verified
        setVerificationComplete(true)
        setIsVerifying(false)
      }
    }

    verifyPayment()
  }, [pidx, router, rideId, passengerId])

  // Emit payment completed event to socket
  useEffect(() => {
    // Notify the server about the successful payment
    if (rideId && passengerId && verificationComplete && !eventEmitted) {
      const emitPaymentEvent = () => {
        try {
          setIsEmittingEvent(true)

          // Emit socket event for payment completion
          if (socket && socket.connected) {
            console.log("Emitting payment-completed event:", {
              rideId,
              paymentMethod: "khalti",
              passengerId,
              amount: Number.parseFloat(amount || "0"),
            })

            // First, emit a direct notification to the driver
            const driverNotification = {
              title: "Payment Received",
              message: `Payment of NPR ${amount} received via Khalti`,
              type: "payment_received",
              rideId: rideId,
            }

            // Emit the payment completed event
            socket.emit("payment-completed", {
              rideId,
              paymentMethod: "khalti",
              passengerId,
              amount: Number.parseFloat(amount || "0"),
            })

            // Also emit a direct notification event
            socket.emit("create-ride-notification", {
              rideId,
              message: `Payment of NPR ${amount} received via Khalti`,
              notificationType: "payment_received",
            })

            // Add a listener for confirmation
            const handleConfirmation = (data: any) => {
              console.log("Payment confirmation received:", data)
              setEventEmitted(true)
              setIsEmittingEvent(false)
              // Remove the listener after receiving confirmation
              socket.off("payment-confirmation", handleConfirmation)
            }

            socket.on("payment-confirmation", handleConfirmation)

            // Set a timeout to mark as emitted even if no confirmation is received
            setTimeout(() => {
              if (!eventEmitted) {
                setEventEmitted(true)
                setIsEmittingEvent(false)
                socket.off("payment-confirmation", handleConfirmation)
              }
            }, 5000)
          } else {
            console.error("Socket not connected, attempting to reconnect...")
            socket.connect()

            // Increment retry count
            setRetryCount((prev) => prev + 1)

            // If we've tried too many times, just mark as emitted
            if (retryCount >= 3) {
              console.log("Max retries reached, marking event as emitted")
              setEventEmitted(true)
              setIsEmittingEvent(false)
            } else {
              // Try again after a delay
              setTimeout(() => {
                setIsEmittingEvent(false)
              }, 2000)
            }
          }
        } catch (error) {
          console.error("Error emitting socket event:", error)
          setEventEmitted(true)
          setIsEmittingEvent(false)
        }
      }

      emitPaymentEvent()
    }
  }, [rideId, passengerId, amount, verificationComplete, socket, eventEmitted, retryCount])

  const handleGoBack = () => {
    // Navigate back to the dashboard
    router.replace({
      pathname: "/Dashboard/passengerDashboard",
      params: { passengerId },
    })
  }

  if (isVerifying || isEmittingEvent) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View className="flex-1 p-6 justify-center items-center">
          <ActivityIndicator size="large" color="#6941C6" />
          <Text className="mt-4 text-lg text-center">
            {isVerifying ? "Verifying your payment..." : "Confirming your payment..."}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View className="flex-1 p-6 justify-center items-center">
        <View className="w-full max-w-md bg-white rounded-xl p-6 shadow-md">
          {/* Khalti Logo */}
          <View className="items-center mb-4">
            <Image
              source={{ uri: "https://raw.githubusercontent.com/khalti/khalti-sdk-android/master/khalti-logo.png" }}
              style={{ width: 120, height: 40 }}
              resizeMode="contain"
            />
          </View>

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
              {pidx && <Text className="text-gray-600">Transaction ID: {pidx}</Text>}
            </View>
            <TouchableOpacity className="bg-purple-600 py-3 px-6 rounded-lg w-full" onPress={handleGoBack}>
              <Text className="text-white font-bold text-center">Return to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

export default PaymentSuccessScreen

