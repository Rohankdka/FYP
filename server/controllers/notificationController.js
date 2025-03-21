import Notification from "../models/notificationModel.js"

// Create a new notification
export const createNotification = async (userId, title, message, type, relatedId = null) => {
  try {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      relatedId,
      read: false,
    })

    return notification
  } catch (error) {
    console.error("Error creating notification:", error)
    throw error
  }
}

// Get user notifications
export const getUserNotifications = async (userId) => {
  try {
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50)

    return notifications
  } catch (error) {
    console.error("Error fetching notifications:", error)
    throw error
  }
}

// Mark notification as read
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findById(notificationId)

    if (!notification) {
      throw new Error("Notification not found")
    }

    // Check if the notification belongs to the user
    if (notification.userId.toString() !== userId.toString()) {
      throw new Error("You can only mark your own notifications as read")
    }

    notification.read = true
    await notification.save()

    return notification
  } catch (error) {
    console.error("Error marking notification as read:", error)
    throw error
  }
}

// Mark all notifications as read
export const markAllNotificationsAsRead = async (userId) => {
  try {
    await Notification.updateMany({ userId, read: false }, { $set: { read: true } })

    return { success: true }
  } catch (error) {
    console.error("Error marking all notifications as read:", error)
    throw error
  }
}

