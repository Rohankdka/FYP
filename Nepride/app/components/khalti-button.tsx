"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { TouchableOpacity, Text, ActivityIndicator, Alert, Linking, Platform } from "react-native"
import * as WebBrowser from "expo-web-browser"
import { useRouter } from "expo-router"
import axios from "axios"
import { MaterialIcons } from "@expo/vector-icons"
import * as Clipboard from "expo-clipboard"

interface KhaltiButtonProps {
  rideId: string
  passengerId: string
  amount: number
  onSuccess?: () => void
  onFailure?: (error: string) => void
}

const API_URL = "http://192.168.1.70:3001/api"

const KhaltiButton: React.FC<KhaltiButtonProps> = ({ rideId, passengerId, amount, onSuccess, onFailure }) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [storedPidx, setStoredPidx] = useState<string>("")
  const router = useRouter()

  // Set up a listener for deep links
  useEffect(() => {
    // Function to handle deep links
    const handleDeepLink = async (event: { url: string }) => {
      console.log("Deep link received in KhaltiButton:", event.url)

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
                const verifyResponse = await axios.get(`${API_URL}/payments/verify`, {
                  params: { pidx },
                })

                if (verifyResponse.data?.success) {
                  if (onSuccess) onSuccess()

                  // Use replace instead of push to avoid navigation stack issues
                  router.replace({
                    pathname: "/payment/success",
                    params: {
                      pidx,
                      rideId: typeof rideId === "object" ? (rideId as any)._id || rideId : rideId,
                      passengerId,
                      amount: amount.toString(),
                    },
                  })
                  return
                }
              }

              // If status is success but no pidx or verification failed
              if (status === "success") {
                if (onSuccess) onSuccess()

                router.replace({
                  pathname: "/payment/success",
                  params: {
                    rideId: typeof rideId === "object" ? (rideId as any)._id || rideId : rideId,
                    passengerId,
                    amount: amount.toString(),
                  },
                })
              } else {
                if (onFailure) onFailure("Payment verification failed")
                router.replace("/payment/failure")
              }
            } catch (error) {
              console.error("Verification error:", error)
              if (onFailure) onFailure("Payment verification failed")
              router.replace("/payment/failure")
            }
          } else {
            // Status is failed or error
            if (onFailure) onFailure("Payment failed or cancelled")
            router.replace("/payment/failure")
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
  }, [rideId, passengerId, amount, onSuccess, onFailure, router])

  const handlePayment = async () => {
    if (!rideId) {
      console.error("Ride ID is required for payment", {
        rideId,
        passengerId,
        amount,
      })
      Alert.alert("Cannot process payment", "Missing ride information")
      if (onFailure) onFailure("Missing ride ID")
      return
    }

    setLoading(true)
    try {
      console.log("Initializing payment for ride:", rideId)

      const formattedRideId = typeof rideId === "object" ? (rideId as any)._id || rideId : rideId

      // Initialize payment using GET with parameters
      const response = await axios.get(`${API_URL}/payments/initialize/${formattedRideId}`, {
        params: {
          amount: amount,
          passengerId: passengerId,
          timestamp: new Date().getTime(),
        },
      })

      console.log("Payment initialized:", response.data)

      if (response.data.payment_url) {
        // Store the pidx for later verification
        const pidx = response.data.pidx
        setStoredPidx(pidx)
        await Clipboard.setStringAsync(pidx)
        console.log("PIDX stored:", pidx)

        // Create a properly formatted return URL
        // Format: nepride://payment/verify?pidx=XXXX&status=success
        const returnUrl = `nepride://payment/verify?pidx=${pidx}&status=success`

        console.log("Opening payment URL with return URL:", returnUrl)

        // Use different approaches based on platform
        if (Platform.OS === "ios") {
          // For iOS, use openAuthSessionAsync which handles the redirect better
          const result = await WebBrowser.openAuthSessionAsync(response.data.payment_url, returnUrl, {
            showInRecents: true,
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          })

          console.log("WebBrowser result:", result)

          // If the WebBrowser doesn't redirect properly, handle it manually
          if (result.type !== "success") {
            await manualVerification(pidx, formattedRideId)
          }
        } else {
          // For Android, use Linking.openURL which works better with external browsers
          // First register for URL handling when app comes back to foreground
          const handleAppStateChange = async () => {
            // Try to verify the payment when app comes back to foreground
            await manualVerification(pidx, formattedRideId)
          }

          // Set up a listener for when the app comes back to foreground
          const subscription = Linking.addEventListener("url", ({ url }) => {
            console.log("App returned from browser with URL:", url)
            // The deep link handler will take care of this
          })

          // Open the payment URL
          await Linking.openURL(response.data.payment_url)

          // Clean up after a delay
          setTimeout(() => {
            subscription.remove()
          }, 60000) // Remove after 1 minute
        }
      } else {
        throw new Error("Invalid response from payment initialization")
      }
    } catch (error) {
      console.error("Error processing payment:", error)
      let errorMessage = "Failed to process payment. Please try again or use a different payment method."

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          errorMessage = "The payment service is currently unavailable. Please try cash payment instead."
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message
        }
      }

      Alert.alert("Payment Error", errorMessage)
      if (onFailure) {
        onFailure("Failed to process payment")
      }

      router.replace("/payment/failure")
    } finally {
      setLoading(false)
    }
  }

  // Helper function for manual verification
  const manualVerification = async (pidx: string, rideId: string) => {
    console.log("Attempting manual verification with pidx:", pidx)

    try {
      // Wait a moment to ensure the payment has been processed
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Try to verify the payment
      const verifyResponse = await axios.get(`${API_URL}/payments/verify`, {
        params: { pidx },
      })

      if (verifyResponse.data?.success) {
        console.log("Manual verification successful")
        if (onSuccess) onSuccess()

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
        console.log("Manual verification failed")
        if (onFailure) onFailure("Payment verification failed")
        router.replace("/payment/failure")
      }
    } catch (error) {
      console.error("Manual verification error:", error)
      if (onFailure) onFailure("Payment verification failed")
      router.replace("/payment/failure")
    }
  }

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
          <MaterialIcons name="account-balance-wallet" size={20} color="white" />
          <Text className="ml-2 text-white font-bold">Pay with Khalti</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

export default KhaltiButton

