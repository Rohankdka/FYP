import axios from "axios"
import { Platform, Linking } from "react-native"
import * as WebBrowser from "expo-web-browser"

const API_URL = "http://192.168.1.70:3001" // Replace with your actual API URL

interface KhaltiPaymentParams {
  rideId: string
  amount: number
  token: string | null
}

interface KhaltiResponse {
  payment_url: string
  pidx: string
  payment_id: string
}

export const initiateKhaltiPayment = async (params: KhaltiPaymentParams): Promise<KhaltiResponse> => {
  try {
    const response = await axios.get(`${API_URL}/payments/initialize/${params.rideId}`, {
      headers: {
        Authorization: params.token ? `Bearer ${params.token}` : "",
      },
    })

    return response.data
  } catch (error) {
    console.error("Error initiating Khalti payment:", error)
    throw error
  }
}

export const openKhaltiPayment = async (paymentUrl: string): Promise<boolean> => {
  try {
    if (Platform.OS === "web") {
      window.open(paymentUrl, "_blank")
      return true
    }

    // For mobile, try to use WebBrowser first for a better UX
    const result = await WebBrowser.openBrowserAsync(paymentUrl)

    // Check if the browser was dismissed without completing payment
    if (result.type === "dismiss") {
      console.log("Browser was dismissed")
      return false
    }

    return true
  } catch (error) {
    console.error("Error opening Khalti payment:", error)

    // Fallback to Linking if WebBrowser fails
    try {
      const supported = await Linking.canOpenURL(paymentUrl)
      if (supported) {
        await Linking.openURL(paymentUrl)
        return true
      } else {
        console.error("Cannot open URL:", paymentUrl)
        return false
      }
    } catch (linkingError) {
      console.error("Error with Linking:", linkingError)
      return false
    }
  }
}

export const verifyKhaltiPayment = async (pidx: string, token: string | null): Promise<any> => {
  try {
    const response = await axios.get(`${API_URL}/payments/verify?pidx=${pidx}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    })

    return response.data
  } catch (error) {
    console.error("Error verifying Khalti payment:", error)
    throw error
  }
}

// Update the setupDeepLinking function to handle potential array of URLs
export const setupDeepLinking = (callback: (url: string) => void) => {
  // Handle deep linking when app is already open
  const subscription = Linking.addEventListener("url", ({ url }) => {
    // Handle the case where url might be an array
    const urlString = Array.isArray(url) ? url[0] : url
    callback(urlString)
  })

  // Handle deep linking when app is opened from a link
  Linking.getInitialURL().then((url) => {
    if (url) {
      // Handle the case where url might be an array
      const urlString = Array.isArray(url) ? url[0] : url
      callback(urlString)
    }
  })

  return () => {
    subscription.remove()
  }
}

// Update the parseDeepLinkParams function to handle potential array of URLs
export const parseDeepLinkParams = (url: string | string[]): Record<string, string> => {
  try {
    // Ensure we're working with a string
    const urlString = Array.isArray(url) ? url[0] : url
    const regex = /[?&]([^=#]+)=([^&#]*)/g
    const params: Record<string, string> = {}
    let match

    while ((match = regex.exec(urlString)) !== null) {
      params[match[1]] = decodeURIComponent(match[2])
    }

    return params
  } catch (error) {
    console.error("Error parsing deep link params:", error)
    return {}
  }
}

