"use client"

// components/payment-modal.tsx
import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"

interface PaymentModalProps {
  visible: boolean
  amount: number
  walletBalance: number
  onClose: () => void
  onPayment: (method: string) => void
}

// Enhance the payment modal to include the selected payment method
const PaymentModal: React.FC<PaymentModalProps> = ({ visible, amount, walletBalance, onClose, onPayment }) => {
  // Use the selected payment method from the parent component if available
  const [selectedMethod, setSelectedMethod] = useState<string>("cash")
  const [processing, setProcessing] = useState<boolean>(false)

  // Reset selected method when modal opens
  useEffect(() => {
    if (visible) {
      // Default to cash payment
      setSelectedMethod("cash")
      setProcessing(false)
    }
  }, [visible])

  const handlePayment = () => {
    setProcessing(true)
    // Simulate payment processing
    setTimeout(() => {
      setProcessing(false)
      onPayment(selectedMethod)
    }, 1500)
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
                selectedMethod === "wallet" ? "bg-blue-500" : amount > walletBalance ? "bg-gray-200" : "bg-gray-100"
              }`}
              onPress={() => setSelectedMethod("wallet")}
              disabled={amount > walletBalance || processing}
            >
              <MaterialIcons
                name="account-balance-wallet"
                size={20}
                color={amount > walletBalance ? "gray" : selectedMethod === "wallet" ? "white" : "black"}
              />
              <Text
                className={`ml-2 ${
                  amount > walletBalance ? "text-gray-500" : selectedMethod === "wallet" ? "text-white" : "text-black"
                }`}
              >
                Wallet (NPR {walletBalance}){amount > walletBalance ? " - Insufficient Balance" : ""}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-row items-center p-3 rounded-lg ${
                selectedMethod === "card" ? "bg-blue-500" : "bg-gray-100"
              }`}
              onPress={() => setSelectedMethod("card")}
              disabled={processing}
            >
              <MaterialIcons name="credit-card" size={20} color={selectedMethod === "card" ? "white" : "black"} />
              <Text className={`ml-2 ${selectedMethod === "card" ? "text-white" : "text-black"}`}>
                Credit/Debit Card
              </Text>
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
              className="bg-green-600 py-3 rounded-lg flex-1 items-center ml-2"
              onPress={handlePayment}
              disabled={processing || (selectedMethod === "wallet" && amount > walletBalance)}
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

