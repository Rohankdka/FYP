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
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ["websocket"], // Force WebSocket transport for better performance
      forceNew: false, // Prevent creating new connections
    })

    // Add connection event listeners for better debugging
    socketInstance.on("connect", () => {
      console.log("Socket connected successfully with ID:", socketInstance.id)
    })

    socketInstance.on("connect_error", (error: any) => {
      console.error("Socket connection error:", error)
    })

    socketInstance.on("disconnect", (reason: any) => {
      console.log("Socket disconnected:", reason)
    })
  }

  return socketInstance
}

// Export the function to get the socket instance
export default getSocket

