// backend/controllers/driverController.js
import DriverModel from "../models/DriverModel.js";
import upload from "../config/multerConfig.js";
import NeprideModel from "../models/NeprideModel.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const savePersonalInformation = async (req, res) => {
  upload.single("photo")(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ message: err.message });
    }

    console.log("Request body:", req.body);
    console.log("Uploaded file:", req.file);

    const { fullName, address, email, gender, dob, citizenshipNumber, userId } = req.body;

    if (!fullName || !address || !email || !gender || !dob || !citizenshipNumber || !req.file || !userId) {
      console.error("Validation failed: Missing fields");
      return res.status(400).json({ message: "All fields are required, including the photo and user ID." });
    }

    const photo = `/uploads/${req.file.filename}`;

    try {
      const existingDriver = await DriverModel.findOne({
        $or: [{ email }, { citizenshipNumber }],
      });

      if (existingDriver) {
        console.error("Duplicate entry:", existingDriver);
        return res.status(400).json({ message: "Email or Citizenship Number already exists." });
      }

      const driver = await DriverModel.create({
        fullName,
        address,
        email,
        gender,
        dob,
        citizenshipNumber,
        photo,
        user: userId,
        status: "pending",
      });

      console.log("Driver created successfully:", driver);
      return res.status(201).json({
        message: "Personal information saved successfully.",
        driver,
      });
    } catch (error) {
      console.error("Error saving driver:", error);
      return res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
  });
};

export const saveLicenseInformation = async (req, res) => {
  upload.fields([{ name: "frontPhoto", maxCount: 1 }, { name: "backPhoto", maxCount: 1 }])(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    const { licenseNumber, driverId } = req.body;
    const frontPhoto = req.files?.frontPhoto?.[0]?.path;
    const backPhoto = req.files?.backPhoto?.[0]?.path;

    if (!licenseNumber || !frontPhoto || !backPhoto || !driverId) {
      return res.status(400).json({ message: "All fields are required." });
    }

    try {
      const driver = await DriverModel.findById(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found." });
      }

      driver.licenseNumber = licenseNumber;
      driver.frontPhoto = `/uploads/${req.files.frontPhoto[0].filename}`;
      driver.backPhoto = `/uploads/${req.files.backPhoto[0].filename}`;
      await driver.save();

      return res.status(200).json({
        message: "License information saved successfully.",
        driver,
      });
    } catch (error) {
      return res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
  });
};

export const saveVehicleInformation = async (req, res) => {
  upload.fields([
    { name: "vehiclePhoto", maxCount: 1 },
    { name: "vehicleDetailPhoto", maxCount: 1 },
    { name: "ownerDetailPhoto", maxCount: 1 },
    { name: "renewalDetailPhoto", maxCount: 1 },
  ])(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    const { vehicleType, numberPlate, productionYear, driverId } = req.body;
    const vehiclePhoto = req.files?.vehiclePhoto?.[0]?.path;
    const vehicleDetailPhoto = req.files?.vehicleDetailPhoto?.[0]?.path;
    const ownerDetailPhoto = req.files?.ownerDetailPhoto?.[0]?.path;
    const renewalDetailPhoto = req.files?.renewalDetailPhoto?.[0]?.path;

    if (
      !vehicleType ||
      !numberPlate ||
      !productionYear ||
      !vehiclePhoto ||
      !vehicleDetailPhoto ||
      !ownerDetailPhoto ||
      !renewalDetailPhoto ||
      !driverId
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    try {
      const driver = await DriverModel.findById(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found." });
      }

      driver.vehicleType = vehicleType;
      driver.numberPlate = numberPlate;
      driver.productionYear = productionYear;
      driver.vehiclePhoto = `/uploads/${req.files.vehiclePhoto[0].filename}`;
      driver.vehicleDetailPhoto = `/uploads/${req.files.vehicleDetailPhoto[0].filename}`;
      driver.ownerDetailPhoto = `/uploads/${req.files.ownerDetailPhoto[0].filename}`;
      driver.renewalDetailPhoto = `/uploads/${req.files.renewalDetailPhoto[0].filename}`;
      await driver.save();

      return res.status(200).json({
        message: "Vehicle information saved successfully.",
        driver,
      });
    } catch (error) {
      return res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
  });
};

export const getAllDrivers = async (req, res) => {
  try {
    const drivers = await DriverModel.find().populate("user");
    return res.status(200).json(drivers);
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong.", error: error.message });
  }
};

export const updateDriverVerification = async (req, res) => {
  const { driverId } = req.params;
  const { isVerified } = req.body;

  try {
    const driver = await DriverModel.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found." });
    }

    driver.status = isVerified ? "approved" : "rejected";
    await driver.save();

    const mailOptions = {
      from: process.env.EMAIL,
      to: driver.email,
      subject: "Driver Verification Status",
      text: `Dear ${driver.fullName},\n\nYour driver application has been ${isVerified ? "approved" : "rejected"}.\n\nThank you for your application.\n\nBest regards,\nThe Team`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    });

    return res.status(200).json({
      message: `Driver ${isVerified ? "approved" : "rejected"} successfully.`,
      driver,
    });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong.", error: error.message });
  }
};

// backend/controllers/driverController.js
export const getDriverById = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the driver by the `user` field (which references NeprideModel)
    const driver = await DriverModel.findOne({ user: id }).populate("user", "username phone");
    if (!driver) {
      return res.status(404).json({ message: "Driver not found." });
    }
    return res.status(200).json(driver);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching driver", error: error.message });
  }
};

