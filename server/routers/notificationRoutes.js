import express from "express"
import Notification from "../models/notificationModel.js"
import authMiddleware from "../middleware/authToken.js"

const router = express.Router()

// Protected routes
router.use(authMiddleware)

// Get user notifications
router.get("/user", async (req, res) => {
  try {
    const userId = req.user._id
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50)

    res.status(200).json(notifications)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Mark notification as read
router.put("/:notificationId/read", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId)

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" })
    }

    // Check if the notification belongs to the user
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only mark your own notifications as read" })
    }

    notification.read = true
    await notification.save()

    res.status(200).json(notification)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Mark all notifications as read
router.put("/read-all", async (req, res) => {
  try {
    const userId = req.user._id

    await Notification.updateMany({ userId, read: false }, { $set: { read: true } })

    res.status(200).json({ message: "All notifications marked as read" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

export default router

