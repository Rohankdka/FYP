// controllers/adminController.js
import DriverModel from "../models/DriverModel.js";
import asyncHandler from "express-async-handler";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const approveDriver = asyncHandler(async (req, res) => {
  const { driverId, status } = req.body;

  if (!driverId || !["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const driver = await DriverModel.findById(driverId);
  if (!driver) {
    return res.status(404).json({ message: "Driver not found" });
  }

  driver.status = status;
  await driver.save();

  // Send email notification
  const mailOptions = {
    from: process.env.EMAIL,
    to: driver.email,
    subject: `Driver Application ${status === "approved" ? "Approved" : "Rejected"}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Driver Application Status</h2>
        <p>Dear ${driver.fullName},</p>
        <p>Your driver application has been <strong>${status}</strong>.</p>
        <p>Here are your details:</p>
        <ul>
          <li><strong>Name:</strong> ${driver.fullName}</li>
          <li><strong>Email:</strong> ${driver.email}</li>
          <li><strong>Citizenship Number:</strong> ${driver.citizenshipNumber}</li>
        </ul>
        <p>Thank you for using our service.</p>
        <p>Best regards,</p>
        <p><strong>Admin Team</strong></p>
      </div>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });

  res.status(200).json({ message: `Driver ${status} successfully` });
});

// Get all pending drivers
export const getPendingDrivers = asyncHandler(async (req, res) => {
  const pendingDrivers = await DriverModel.find({ status: "pending" });
  res.status(200).json(pendingDrivers);
});

export const getDriverStats = asyncHandler(async (req, res) => {
  const totalDrivers = await DriverModel.countDocuments();
  const approvedDrivers = await DriverModel.countDocuments({ status: "approved" });
  const pendingDrivers = await DriverModel.countDocuments({ status: "pending" });

  res.status(200).json({ totalDrivers, approvedDrivers, pendingDrivers });
});