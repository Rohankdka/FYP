import express from "express";
import mongoose from "mongoose"; // Added missing mongoose import
import Notification from "../models/notificationModel.js";
import authToken from "../middleware/authToken.js";

const router = express.Router();

// Get all notifications for a user
router.get("/user", authToken, async (req, res) => {
  try {
    // Get userId from either req.user._id or query parameter
    const userId = req.user?._id || req.query.userId;

    if (!userId) {
      console.error("No user ID provided for fetching notifications");
      return res.status(400).json({ message: "User ID is required" });
    }

    console.log("Fetching notifications for userId:", userId);

    // Ensure userId is a string
    const userIdStr =
      typeof userId === "object"
        ? userId._id
          ? userId._id.toString()
          : String(userId)
        : String(userId);

    // Validate that userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
      console.error(
        "Invalid ObjectId format for fetching notifications:",
        userIdStr
      );
      return res.status(400).json({
        message: "Invalid user ID format",
        error: "The provided ID is not a valid ObjectId",
      });
    }

    const notifications = await Notification.find({ userId: userIdStr })
      .sort({ createdAt: -1 })
      .limit(50);

    console.log(
      `Found ${notifications.length} notifications for user ${userIdStr}`
    );

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error in /notifications/user:", error);
    res.status(500).json({ message: error.message });
  }
});

// Mark a notification as read
router.put("/:notificationId/read", authToken, async (req, res) => {
  try {
    const { notificationId } = req.params;

    console.log("Marking notification as read:", notificationId);

    // Check if notificationId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      console.error("Invalid notification ID format:", notificationId);
      return res.status(400).json({
        message: "Invalid notification ID format",
        error: "The provided ID is not a valid ObjectId",
      });
    }

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    console.log("Notification marked as read:", notification._id);
    res.status(200).json(notification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: error.message });
  }
});

// Mark all notifications as read for a user
router.put("/read-all", authToken, async (req, res) => {
  try {
    const userId = req.user?._id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    console.log("Marking all notifications as read for user:", userId);

    // Ensure userId is a string
    const userIdStr =
      typeof userId === "object"
        ? userId._id
          ? userId._id.toString()
          : String(userId)
        : String(userId);

    // Validate that userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
      console.error(
        "Invalid ObjectId format for marking all as read:",
        userIdStr
      );
      return res.status(400).json({
        message: "Invalid user ID format",
        error: "The provided ID is not a valid ObjectId",
      });
    }

    const result = await Notification.updateMany(
      { userId: userIdStr, read: false },
      { read: true }
    );

    const count = await Notification.countDocuments({
      userId: userIdStr,
      read: false,
    });

    console.log("All notifications marked as read successfully");
    res.status(200).json({
      message: "All notifications marked as read",
      count: count,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
