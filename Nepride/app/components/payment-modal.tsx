"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert, Linking, Platform } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import * as WebBrowser from "expo-web-browser"
import { useRouter } from "expo-router"
import axios from "axios"
import * as Clipboard from "expo-clipboard"
import getSocket from "./socket"

const API_BASE_URL = "http://192.168.1.70:3001/api" // Base URL with /api prefix
const API_URL = "http://192.168.1.70:3001" // Base URL without /api prefix

interface PaymentModalProps {
  visible: boolean
  amount: number
  rideId?: string
  passengerId?: string
  onClose: () => void
  onPayment: (method: string) => void
}

const PaymentModal: React.FC<PaymentModalProps> = ({ visible, amount, rideId, passengerId, onClose, onPayment }) => {
  const [selectedMethod, setSelectedMethod] = useState<string>("cash")
  const [processing, setProcessing] = useState<boolean>(false)
  const [storedPidx, setStoredPidx] = useState<string>("")
  const router = useRouter()
  const socket = getSocket()

  useEffect(() => {
    if (visible) {
      setSelectedMethod("cash")
      setProcessing(false)
      setStoredPidx("")
    }
  }, [visible])

  // Set up a listener for deep links
  useEffect(() => {
    // Function to handle deep links
    const handleDeepLink = async (event: { url: string }) => {
      console.log("Deep link received in PaymentModal:", event.url)

      try {
        // Parse the URL
        const url = new URL(event.url)

        // Check if this is a payment verification link
        if (
          url.pathname.includes("/payment/verify") ||
          (url.hostname === "payment" && url.pathname.includes("/verify"))
        ) {
          const pidx = url.searchParams.get("pidx")
          const status = url.searchParams.get("status")

          console.log("Payment verification deep link detected:", { pidx, status })

          if (status === "success" || (pidx && !status)) {
            try {
              // If we have a pidx, verify it
              if (pidx) {
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

                // Update ride payment status directly via API
                try {
                  await axios.put(`${API_URL}/ride/update-payment`, {
                    rideId,
                    paymentStatus: "completed",
                    paymentMethod: "khalti",
                  })
                  console.log("Ride payment status updated via API")
                } catch (updateError) {
                  console.error("Failed to update ride payment status via API:", updateError)
                }

                if (verifyResponse.data?.success || verifyResponse.data?.status === "Completed") {
                  // First call onPayment to update parent component state
                  onPayment("khalti")

                  // Close the payment modal
                  onClose()

                  // Then navigate with a slight delay to ensure state updates complete
                  setTimeout(() => {
                    router.replace({
                      pathname: "/payment/success",
                      params: {
                        pidx,
                        rideId,
                        passengerId,
                        amount: amount.toString(),
                      },
                    })
                  }, 300)
                  return
                }
              }

              // If status is success but no pidx or verification failed
              if (status === "success") {
                // First call onPayment to update parent component state
                onPayment("khalti")

                // Close the payment modal
                onClose()

                // Then navigate with a slight delay to ensure state updates complete
                setTimeout(() => {
                  router.replace({
                    pathname: "/payment/success",
                    params: {
                      rideId,
                      passengerId,
                      amount: amount.toString(),
                    },
                  })
                }, 300)
              } else {
                router.replace({
                  pathname: "/payment/failure",
                  params: { passengerId },
                })
              }
            } catch (error) {
              console.error("Verification error:", error)
              router.replace({
                pathname: "/payment/failure",
                params: { passengerId },
              })
            }
          } else {
            // Status is failed or error
            router.replace({
              pathname: "/payment/failure",
              params: { passengerId },
            })
          }
        }
      } catch (error) {
        console.error("Error parsing deep link URL:", error)
      }
    }

    // Add event listener for URL changes
    const subscription = Linking.addEventListener("url", handleDeepLink)

    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url })
      }
    })

    // Clean up
    return () => {
      subscription.remove()
    }
  }, [rideId, passengerId, amount, onPayment, router, onClose])

  const handlePayment = async () => {
    setProcessing(true)

    if (selectedMethod === "khalti") {
      try {
        if (!rideId) {
          Alert.alert("Error", "Ride information is missing")
          setProcessing(false)
          return
        }

        console.log("Initializing payment for ride:", rideId)

        // Try both possible endpoints for Khalti initialization
        let initResponse
        try {
          // First try the primary endpoint
          initResponse = await axios.get(`${API_BASE_URL}/payments/initialize/${rideId}`, {
            params: {
              amount: amount,
              passengerId: passengerId,
              timestamp: new Date().getTime(),
            },
          })
          console.log("Initialization response from primary endpoint:", initResponse.data)
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            // If 404, try the alternative endpoint
            console.log("Primary endpoint not found, trying alternative endpoint...")
            initResponse = await axios.post(`${API_BASE_URL}/khalti/initialize`, {
              rideId,
              amount,
              passengerId,
            })
            console.log("Initialization response from alternative endpoint:", initResponse.data)
          } else {
            throw error
          }
        }

        if (!initResponse?.data?.payment_url) {
          throw new Error("Payment initialization failed - no URL received")
        }

        // Store the pidx for later verification
        const pidx = initResponse.data.pidx
        setStoredPidx(pidx)
        await Clipboard.setStringAsync(pidx)
        console.log("PIDX stored:", pidx)

        // Create a properly formatted return URL
        // Format: nepride://payment/verify?pidx=XXXX&status=success
        const returnUrl = `nepride://payment/verify?pidx=${pidx}&status=success`

        console.log("Opening payment URL with return URL:", returnUrl)

        // Close the modal before opening the browser
        onClose()

        // Use different approaches based on platform
        if (Platform.OS === "ios") {
          // For iOS, use openAuthSessionAsync which handles the redirect better
          const result = await WebBrowser.openAuthSessionAsync(initResponse.data.payment_url, returnUrl, {
            showInRecents: true,
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          })

          console.log("WebBrowser result:", result)

          // If the WebBrowser doesn't redirect properly, handle it manually
          if (result.type !== "success") {
            await manualVerification(pidx, rideId)
          }
        } else {
          // For Android, use Linking.openURL which works better with external browsers
          // First register for URL handling when app comes back to foreground
          const handleAppStateChange = async () => {
            // Try to verify the payment when app comes back to foreground
            await manualVerification(pidx, rideId)
          }

          // Set up a listener for when the app comes back to foreground
          const subscription = Linking.addEventListener("url", ({ url }) => {
            console.log("App returned from browser with URL:", url)
            // The deep link handler will take care of this
          })

          // Open the payment URL
          await Linking.openURL(initResponse.data.payment_url)

          // Clean up after a delay
          setTimeout(() => {
            subscription.remove()
          }, 60000) // Remove after 1 minute
        }
      } catch (error) {
        console.error("Payment error:", error)

        // Provide more helpful error messages based on error type
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            Alert.alert(
              "Payment Service Unavailable",
              "The Khalti payment service is currently unavailable. Please use cash payment instead.",
              [
                {
                  text: "Use Cash Instead",
                  onPress: () => {
                    setSelectedMethod("cash")
                    handlePayment()
                  },
                },
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => setProcessing(false),
                },
              ],
            )
          } else {
            Alert.alert(
              "Payment Error",
              error.response?.data?.message || "Failed to process payment. Please try again or use cash payment.",
            )
          }
        } else {
          Alert.alert("Payment Error", error instanceof Error ? error.message : "Payment failed")
        }

        setProcessing(false)
      } finally {
        setProcessing(false)
      }
    } else {
      // Handle cash payment
      try {
        // Update ride payment status directly via API
        await axios.put(`${API_URL}/ride/payment`, {
          rideId,
          paymentStatus: "completed",
          paymentMethod: "cash",
        })
        console.log("Ride payment status updated via API for cash payment")

        // Emit socket events for cash payment
        socket.emit("payment-completed", {
          rideId,
          paymentMethod: "cash",
          passengerId,
          amount: amount,
        })

        // Also emit a direct notification event
        socket.emit("create-ride-notification", {
          rideId,
          message: `Payment of NPR ${amount} received via Cash`,
          notificationType: "payment_received",
        })

        // Call onPayment to update parent component state
        onPayment("cash")
        setProcessing(false)

        // Close the modal after payment is processed
        onClose()
      } catch (error) {
        console.error("Error updating payment status:", error)
        Alert.alert("Payment Error", "Failed to update payment status. Please try again.")
        setProcessing(false)
      }
    }
  }

  // Helper function for manual verification
  const manualVerification = async (pidx: string, rideId: string) => {
    console.log("Attempting manual verification with pidx:", pidx)

    try {
      // Wait a moment to ensure the payment has been processed
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Try both possible verification endpoints
      let verifyResponse
      try {
        verifyResponse = await axios.get(`${API_BASE_URL}/payments/verify?pidx=${pidx}`)
        console.log("Manual verification response from primary endpoint:", verifyResponse.data)
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          // If 404, try the alternative endpoint
          console.log("Primary verify endpoint not found, trying alternative endpoint...")
          verifyResponse = await axios.post(`${API_BASE_URL}/khalti/verify`, {
            pidx,
            rideId,
          })
          console.log("Manual verification response from alternative endpoint:", verifyResponse.data)
        } else {
          throw error
        }
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

      if (verifyResponse.data?.success || verifyResponse.data?.status === "Completed") {
        // Call onPayment to update parent component state
        onPayment("khalti")

        // Navigate to success page
        router.replace({
          pathname: "/payment/success",
          params: {
            pidx,
            rideId,
            passengerId,
            amount: amount.toString(),
          },
        })
      } else {
        router.replace({
          pathname: "/payment/failure",
          params: { passengerId },
        })
      }
    } catch (error) {
      console.error("Manual verification error:", error)
      router.replace({
        pathname: "/payment/failure",
        params: { passengerId },
      })
    }
  }

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
        <View className="w-4/5 bg-white rounded-xl p-5 items-center">
          <Text className="text-lg font-bold mb-2">Payment</Text>
          <Text className="text-base mb-2 text-center">Your ride has been completed.</Text>
          <Text className="text-xl font-bold mb-4">Amount to Pay: NPR {amount}</Text>

          <View className="w-full mb-4">
            <Text className="text-base font-medium mb-2">Select Payment Method:</Text>
            <TouchableOpacity
              className={`flex-row items-center p-3 rounded-lg mb-2 ${
                selectedMethod === "cash" ? "bg-blue-500" : "bg-gray-100"
              }`}
              onPress={() => setSelectedMethod("cash")}
              disabled={processing}
            >
              <MaterialIcons name="attach-money" size={20} color={selectedMethod === "cash" ? "white" : "black"} />
              <Text className={`ml-2 ${selectedMethod === "cash" ? "text-white" : "text-black"}`}>Cash</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-row items-center p-3 rounded-lg ${
                selectedMethod === "khalti" ? "bg-purple-600" : "bg-gray-100"
              }`}
              onPress={() => setSelectedMethod("khalti")}
              disabled={processing}
            >
              <MaterialIcons
                name="account-balance-wallet"
                size={20}
                color={selectedMethod === "khalti" ? "white" : "black"}
              />
              <Text className={`ml-2 ${selectedMethod === "khalti" ? "text-white" : "text-black"}`}>Khalti</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row w-full">
            <TouchableOpacity
              className="bg-gray-300 py-3 rounded-lg flex-1 items-center mr-2"
              onPress={onClose}
              disabled={processing}
            >
              <Text className="font-bold text-gray-700">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`py-3 rounded-lg flex-1 items-center ml-2 ${
                selectedMethod === "khalti" ? "bg-purple-600" : "bg-green-600"
              }`}
              onPress={handlePayment}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-bold">Pay Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default PaymentModal

