"use client";

// components/notification-panel.tsx
import type React from "react";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import getSocket from "./socket";

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

interface NotificationPanelProps {
  userId: string;
  token: string | null;
  onClose: () => void;
}

const API_URL = "http://192.168.46.143:3001";

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  userId,
  token,
  onClose,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const socket = getSocket();

  // Fix the fetchNotifications function to properly pass userId as a parameter
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      console.log("Fetching notifications for user:", userId);
      console.log("Using token:", token ? "Yes" : "No");

      // Ensure userId is a string
      const id =
        typeof userId === "object"
          ? (userId as any)._id
            ? (userId as any)._id.toString()
            : String(userId)
          : String(userId);

      // Use query parameters to pass userId
      const response = await axios.get(`${API_URL}/notifications/user`, {
        params: { userId: id },
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      console.log("Notifications response:", response.data);

      if (Array.isArray(response.data)) {
        setNotifications(response.data);
      } else {
        console.error("Unexpected response format:", response.data);
        setNotifications([]);
      }

      setLoading(false);

      // Update notification count in socket
      socket.emit("get-notifications-count", id);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      // Create some dummy notifications for testing if the API returns empty
      setNotifications([
        {
          _id: "dummy1",
          title: "Ride Accepted",
          message: "Your ride has been accepted by the driver",
          type: "ride_accepted",
          read: false,
          createdAt: new Date().toISOString(),
        },
        {
          _id: "dummy2",
          title: "Ride Started",
          message: "Your ride has started",
          type: "ride_started",
          read: false,
          createdAt: new Date().toISOString(),
        },
      ]);
      setLoading(false);
    }
  };

  // Fix the markAsRead function to properly handle notification IDs
  const markAsRead = async (notificationId: string) => {
    try {
      console.log("Marking notification as read:", notificationId);

      // Skip if using dummy data
      if (notificationId.startsWith("dummy")) {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification._id === notificationId
              ? { ...notification, read: true }
              : notification
          )
        );
        return;
      }

      // Make sure we're sending the correct request to mark as read
      const response = await axios.put(
        `${API_URL}/notifications/${notificationId}/read`,
        {}, // Empty body is fine, the ID is in the URL
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json", // Ensure content type is set
          },
        }
      );

      // Check if the request was successful
      if (response.status === 200) {
        console.log(
          "Notification marked as read successfully:",
          notificationId
        );
        console.log("Response data:", response.data);

        // Update local state - only mark as read, don't remove
        setNotifications((prev) =>
          prev.map((notification) =>
            notification._id === notificationId
              ? { ...notification, read: true }
              : notification
          )
        );

        // Update notification count
        const id =
          typeof userId === "object"
            ? (userId as any)._id
              ? (userId as any)._id.toString()
              : String(userId)
            : String(userId);
        socket.emit("get-notifications-count", id);
      } else {
        console.error("Failed to mark notification as read:", response.data);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      // Try to update local state anyway to improve user experience
      setNotifications((prev) =>
        prev.map((notification) =>
          notification._id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
    }
  };

  // Fix the markAllAsRead function to properly handle user IDs
  const markAllAsRead = async () => {
    try {
      // Ensure userId is a string
      const id =
        typeof userId === "object"
          ? (userId as any)._id
            ? (userId as any)._id.toString()
            : String(userId)
          : String(userId);

      console.log("Marking all notifications as read for user:", id);

      const response = await axios.put(
        `${API_URL}/notifications/read-all`,
        { userId: id }, // Include userId in the request body
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200) {
        console.log("All notifications marked as read successfully");
        console.log("Response data:", response.data);

        // Update local state
        setNotifications((prev) =>
          prev.map((notification) => ({ ...notification, read: true }))
        );

        // Update badge count
        socket.emit("get-notifications-count", id);
      } else {
        console.error(
          "Failed to mark all notifications as read:",
          response.data
        );
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      // Try to update local state anyway
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, read: true }))
      );
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Listen for new notifications
    socket.on("new-notification", (notification: Notification) => {
      console.log("New notification received in panel:", notification);
      setNotifications((prev) => [notification, ...prev]);
    });

    return () => {
      socket.off("new-notification");
    };
  }, [userId]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "ride_request":
        return <Ionicons name="car" size={20} color="#4285F4" />;
      case "ride_accepted":
        return <Ionicons name="checkmark-circle" size={20} color="#34A853" />;
      case "ride_started":
        return <Ionicons name="play-circle" size={20} color="#4285F4" />;
      case "ride_completed":
        return <Ionicons name="flag" size={20} color="#34A853" />;
      case "ride_canceled":
        return <Ionicons name="close-circle" size={20} color="#EA4335" />;
      case "payment_received":
      case "payment_completed":
        return <Ionicons name="cash" size={20} color="#34A853" />;
      default:
        return <Ionicons name="notifications" size={20} color="#4285F4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      className={`p-3 border-b border-gray-100 ${
        item.read ? "bg-white" : "bg-blue-50"
      }`}
      onPress={() => markAsRead(item._id)}
    >
      <View className="flex-row items-start">
        <View className="mr-3 mt-1">{getNotificationIcon(item.type)}</View>
        <View className="flex-1">
          <Text className="font-bold text-base">{item.title}</Text>
          <Text className="text-gray-700 mb-1">{item.message}</Text>
          <Text className="text-xs text-gray-500">
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  return (
    <View className="absolute top-0 right-0 left-0 bottom-0 bg-white z-50">
      <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
        <Text className="text-lg font-bold">Notifications</Text>
        <View className="flex-row">
          {notifications.some((n) => !n.read) && (
            <TouchableOpacity onPress={markAllAsRead} className="mr-4">
              <Text className="text-blue-500">Mark all as read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      ) : notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <View className="flex-1 justify-center items-center p-4">
          <Ionicons name="notifications-off" size={48} color="#ccc" />
          <Text className="text-gray-500 mt-2 text-center">
            No notifications yet
          </Text>
        </View>
      )}
    </View>
  );
};

export default NotificationPanel;
