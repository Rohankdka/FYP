// components/socket.tsx
import io from "socket.io-client"

// Create a singleton socket instance to prevent multiple connections
let socketInstance: any = null

const getSocket = () => {
  if (!socketInstance) {
    // Use different IP address format based on platform
    const SERVER_URL = "http://192.168.1.70:3001"

    socketInstance = io(SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      transports: ["websocket"], // Force WebSocket transport for better performance
      forceNew: false, // Prevent creating new connections
      autoConnect: true, // Connect automatically
    })

    // Add connection event listeners for better debugging
    socketInstance.on("connect", () => {
      console.log("Socket connected successfully with ID:", socketInstance.id)

      // Reset hasEmitted flag on reconnection to ensure rooms are rejoined
      socketInstance.hasEmitted = false
    })

    socketInstance.on("connect_error", (error: any) => {
      console.error("Socket connection error:", error)
    })

    socketInstance.on("disconnect", (reason: any) => {
      console.log("Socket disconnected:", reason)

      // Attempt to reconnect if not already reconnecting
      if (reason === "io server disconnect" && socketInstance) {
        socketInstance.connect()
      }
    })

    // Add a global handler for notification creation success
    socketInstance.on("notification-created", (data: any) => {
      console.log("Notification created successfully:", data)
    })

    // Add a global handler for notification creation failure
    socketInstance.on("notification-error", (error: any) => {
      console.error("Error creating notification:", error)
    })

    // Add a global handler for payment events
    socketInstance.on("payment-event", (data: any) => {
      console.log("Payment event received:", data)
    })

    // Add a specific handler for payment confirmation
    socketInstance.on("payment-confirmation", (data: any) => {
      console.log("Payment confirmation received in socket handler:", data)
    })

    // Add a specific handler for payment received
    socketInstance.on("payment-received", (data: any) => {
      console.log("Payment received event in socket handler:", data)
    })

    // Add better handling for notification events in the socket component
    socketInstance.on("notifications-count", (data: { count: number }) => {
      console.log("Received notification count:", data.count)
    })

    socketInstance.on("new-notification", (notification: any) => {
      console.log("New notification received:", notification)
    })

    // Add handlers for ride status updates
    socketInstance.on("ride-status", (data: any) => {
      console.log("Ride status update received in socket handler:", data)
    })

    socketInstance.on("ride-completed", (data: any) => {
      console.log("Ride completed event received in socket handler:", data)
    })

    // Improve error handling for socket events
    socketInstance.on("error", (error: any) => {
      console.error("Socket error:", error)
    })

    // Add a reconnection event to ensure we rejoin rooms
    socketInstance.on("reconnect", (attemptNumber: number) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`)
      // Reset hasEmitted flag on reconnection to ensure rooms are rejoined
      socketInstance.hasEmitted = false
    })

    // Add a reconnect_attempt event for better debugging
    socketInstance.on("reconnect_attempt", (attemptNumber: number) => {
      console.log(`Socket reconnection attempt #${attemptNumber}`)
    })

    // Add a reconnect_error event for better debugging
    socketInstance.on("reconnect_error", (error: any) => {
      console.error("Socket reconnection error:", error)
    })

    // Add a reconnect_failed event for better debugging
    socketInstance.on("reconnect_failed", () => {
      console.error("Socket reconnection failed after all attempts")
    })
  }

  // Check if socket is disconnected and try to reconnect
  if (socketInstance && !socketInstance.connected) {
    console.log("Socket is disconnected, attempting to reconnect...")
    socketInstance.connect()
  }

  return socketInstance
}

// Export the function to get the socket instance
export default getSocket

