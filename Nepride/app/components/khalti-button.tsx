"use client"

import { TouchableOpacity, Text, ActivityIndicator } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import { useState } from "react"
import axios from "axios"
import { useRouter } from "expo-router"

interface KhaltiButtonProps {
  rideId: string
  passengerId: string
  amount: number
  onSuccess?: () => void
  onFailure?: (error: string) => void
}

const API_URL = "http://192.168.1.70:3001"

const KhaltiButton = ({ rideId, passengerId, amount, onSuccess, onFailure }: KhaltiButtonProps) => {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handlePayment = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/payments/initialize/${rideId}`)
      console.log("Khalti payment initialized:", response.data)

      // Navigate to payment verification page
      router.push({
        pathname: "/payment/verify",
        params: {
          pidx: response.data.pidx,
          payment_id: response.data.payment_id,
          rideId: rideId,
          passengerId: passengerId,
          amount: amount.toString(),
        },
      })

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error initializing Khalti payment:", error)
      if (onFailure) {
        onFailure("Failed to initialize payment")
      }
    } finally {
      setLoading(false)
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

