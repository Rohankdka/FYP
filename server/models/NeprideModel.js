import mongoose from "mongoose";

const NeprideSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "driver", "passenger"], default: "passenger" },
  isEmailVerified: { type: Boolean, default: false },
  emailOTP: { type: String },
  emailOTPExpires: { type: Date },
  isPhoneVerified: { type: Boolean, default: false },
  resetPasswordOTP: { type: String },
  resetPasswordOTPExpires: { type: Date },
  driverDetails: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" }, // Reference to Driver model
});

const NeprideModel = mongoose.model("Nepride", NeprideSchema);

export default NeprideModel;