"use client";

import type React from "react";

import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import getSocket from "./socket";

interface NotificationBadgeProps {
  userId: string;
  onPress: () => void;
  count?: number;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  userId,
  onPress,
  count: externalCount,
}) => {
  const [count, setCount] = useState<number>(0);
  const socket = getSocket();

  useEffect(() => {
    // If an external count is provided, use it
    if (typeof externalCount === "number") {
      setCount(externalCount);
      return;
    }

    // Otherwise, fetch the count from the server
    socket.emit("get-notifications-count", userId);

    const handleNotificationCount = (data: { count: number }) => {
      setCount(data.count);
    };

    socket.on("notifications-count", handleNotificationCount);

    // Listen for new notifications to update the count
    socket.on("new-notification", () => {
      socket.emit("get-notifications-count", userId);
    });

    return () => {
      socket.off("notifications-count", handleNotificationCount);
      socket.off("new-notification");
    };
  }, [userId, externalCount]);

  return (
    <TouchableOpacity
      className="p-2 mr-2 bg-gray-50 rounded-full relative"
      onPress={onPress}
    >
      <Ionicons name="notifications" size={24} color="black" />
      {count > 0 && (
        <View className="absolute top-0 right-0 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center">
          <Text className="text-white text-xs font-bold">
            {count > 9 ? "9+" : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default NotificationBadge;
