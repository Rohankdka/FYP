// frontend/socket.js
import io from "socket.io-client";

const socket = io("http://192.168.1.70:3001", {
  reconnection: true,
  reconnectionAttempts: 5,
});

export default socket;
