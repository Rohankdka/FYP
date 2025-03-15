import mongoose from "mongoose";

const DriverSchema = new mongoose.Schema(
  {
    // Personal Information
    fullName: { type: String, required: true },
    address: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    dob: { type: String, required: true },
    citizenshipNumber: { type: String, required: true, unique: true },
    photo: { type: String, required: true },

    // License Information
    licenseNumber: { type: String, unique: true },
    frontPhoto: { type: String },
    backPhoto: { type: String },

    // Vehicle Information
    vehicleType: {
      type: String,
      enum: ["Car", "Bike", "Electric"],
      required: false,
    },
    numberPlate: { type: String, unique: true },
    productionYear: { type: String },
    vehiclePhoto: { type: String },
    vehicleDetailPhoto: { type: String },
    ownerDetailPhoto: { type: String },
    renewalDetailPhoto: { type: String },

    // Approval Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    

    // Reference to Nepride model
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nepride",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Driver", DriverSchema);
