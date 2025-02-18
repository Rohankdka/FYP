import jwt from "jsonwebtoken";
import NeprideModel from "../models/NeprideModel.js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import asyncHandler from "express-async-handler";
import twilio from "twilio";
import dotenv from "dotenv";
import DriverModel from "../models/DriverModel.js";
dotenv.config();

// Twilio Configuration
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Generate OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Format Phone Number (Ensure it has country code)
const formatPhoneNumber = (phone) => {
  if (!phone.startsWith("+977")) {
    return `+977${phone}`; // Nepal country code
  }
  return phone;
};

// Send Email OTP
const sendEmailOTP = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: "Email Verification OTP",
      text: `Your OTP for email verification is: ${otp}. This OTP will expire in 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email OTP:", error);
    throw new Error("Failed to send email OTP");
  }
};

// Send Phone OTP for Verification
export const sendPhoneOTPForVerification = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const serviceSid = process.env.TWILIO_SERVICE_SID;

    // Check if phone number is already verified
    const existingUser = await NeprideModel.findOne({ phone: formattedPhone });

    if (existingUser && existingUser.isPhoneVerified) {
      return res
        .status(400)
        .json({ message: "This phone number is already verified." });
    }

    // Send OTP
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        to: formattedPhone,
        channel: "sms",
      });

    console.log("Twilio verification SID:", verification.sid);
    res.status(200).json({ message: "OTP sent to your phone" });
  } catch (error) {
    console.error("Twilio error:", error.message);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

export const verifyPhoneOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res
      .status(400)
      .json({ message: "Phone number and OTP are required" });
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const serviceSid = process.env.TWILIO_SERVICE_SID;

    const verificationCheck = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: formattedPhone,
        code: otp, // OTP entered by the user
      });

    if (verificationCheck.status === "approved") {
      // Generate a short-lived JWT token for registration
      const token = jwt.sign(
        { phone: formattedPhone },
        process.env.JWT_SECRET,
        { expiresIn: "10m" } // Token expires in 10 minutes
      );

      res.status(200).json({
        message: "Phone verified successfully",
        token,
      });
    } else {
      res.status(400).json({ message: "Invalid or expired OTP" });
    }
  } catch (error) {
    console.error("Twilio verification error:", error.message);
    res.status(500).json({ message: "OTP verification failed" });
  }
});

export const registerUser = asyncHandler(async (req, res) => {
  const {
    username,
    email,
    password,
    confirmPassword,
    role = "passenger",
  } = req.body;

  // Validate required fields
  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Validate password match
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  // Check if email already exists
  const existingUser = await NeprideModel.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "Email already exists" });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Generate Email OTP
  const emailOTP = generateOTP();

  // Extract phone number from the verified token
  const { phone } = req.user;

  // Create new user
  const newUser = new NeprideModel({
    username,
    phone, // Phone number from the verified token
    email,
    password: hashedPassword,
    role,
    emailOTP,
    isEmailVerified: false,
    isPhoneVerified: true, // Phone is already verified
    emailOTPExpires: Date.now() + 10 * 60 * 1000, // OTP expires in 10 minutes
  });

  // Save user to database
  await newUser.save();

  // Send OTP to email
  await sendEmailOTP(email, emailOTP);

  res.status(201).json({
    message: "User registered. OTP sent to email. Please verify your email.",
  });
});

// Verify Email
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  // Find user by email and OTP
  const user = await NeprideModel.findOne({
    email,
    emailOTP: otp,
    emailOTPExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  // Mark email as verified
  user.isEmailVerified = true;
  user.emailOTP = undefined;
  user.emailOTPExpires = undefined;
  await user.save();

  // For drivers, we'll just mark them as pending verification
  // instead of creating an incomplete driver record
  if (user.role === "driver") {
    user.driverVerificationStatus = "pending";
    await user.save();
  }

  // Return the user role so frontend can redirect appropriately
  res.status(200).json({ 
    message: "Email verified successfully",
    role: user.role,
    _id: user._id 
  });
});

// Login User
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await NeprideModel.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: "Email and password do not match" });
  }

  // Check if email is verified
  if (!user.isEmailVerified) {
    return res.status(401).json({
      message: "Please verify your email before logging in",
    });
  }

  // Validate password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Incorrect password" });
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Set token in cookie
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });

  res.status(200).json({ message: "Login successful", token, role: user.role });
});

// Forgot Password (Send OTP)
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Find user by email
  const user = await NeprideModel.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "No user found with this email" });
  }

  // Generate and save OTP
  const resetOTP = generateOTP();
  user.resetPasswordOTP = resetOTP;
  user.resetPasswordOTPExpires = Date.now() + 10 * 60 * 1000; // OTP expires in 10 minutes
  await user.save();

  // Send OTP to email
  await sendEmailOTP(email, resetOTP);

  res.status(200).json({ message: "Password reset OTP sent to your email" });
});

// Reset Password with OTP
export const resetPassword = asyncHandler(async (req, res) => {
  const { otp, newPassword, confirmPassword } = req.body;

  // Validate required fields
  if (!otp || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Validate password match
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  // Find user by OTP
  const user = await NeprideModel.findOne({
    resetPasswordOTP: otp,
    resetPasswordOTPExpires: { $gt: Date.now() },
  });
  if (!user) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  // Hash new password and save
  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordOTP = undefined;
  user.resetPasswordOTPExpires = undefined;
  await user.save();

  res.status(200).json({ message: "Password reset successful" });
});

// Get authenticated user's details
export const getMe = asyncHandler(async (req, res) => {
  // The user is already attached to the request object by the authToken middleware
  const user = req.user;

  // Fetch user details from the database
  const userDetails = await NeprideModel.findById(user.id).select(
    "-password -emailOTP -resetPasswordOTP"
  );

  if (!userDetails) {
    return res.status(404).json({ message: "User not found" });
  }

  res.status(200).json(userDetails);
});