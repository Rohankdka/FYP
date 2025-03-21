import Payment from "../models/paymentModel.js";
import Ride from "../models/rideModel.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY;
const KHALTI_BASE_URL = "https://a.khalti.com/api/v2";

// Initialize Khalti Payment
export const initializePayment = async (req, res) => {
  try {
    const { rideId } = req.params;

    // Validate ride
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.paymentStatus === "completed") {
      return res.status(400).json({ error: "Payment already completed" });
    }

    // Create payment record
    const payment = new Payment({
      rideId: ride._id,
      amount: ride.fare,
      status: "pending"
    });

    // Prepare Khalti payload
    const payload = {
      return_url: `${process.env.BASE_URL}/api/payments/verify`, // Ensure this is a string
      website_url: process.env.BASE_URL, // Ensure this is a string
      amount: ride.fare * 100, // Convert to paisa
      purchase_order_id: payment._id,
      purchase_order_name: `Ride-${ride._id}`,
      customer_info: {
        name: "Test User",
        email: "test@example.com"
      }
    };

    // Log the payload for debugging
    console.log("Khalti Payload:", payload);

    // Initiate Khalti payment
    const response = await axios.post(
      `${KHALTI_BASE_URL}/epayment/initiate/`,
      payload,
      {
        headers: {
          Authorization: `Key ${KHALTI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Update payment with Khalti reference
    payment.pidx = response.data.pidx;
    await payment.save();

    res.json({
      payment_url: response.data.payment_url,
      pidx: response.data.pidx,
      payment_id: payment._id
    });

  } catch (error) {
    console.error("Payment initialization failed:", error);
    res.status(500).json({ error: error.message });
  }
};

// Verify Payment
export const verifyPayment = async (req, res) => {
  try {
    const { pidx } = req.query;

    // Verify with Khalti
    const response = await axios.post(
      `${KHALTI_BASE_URL}/epayment/lookup/`,
      { pidx },
      {
        headers: {
          Authorization: `Key ${KHALTI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const payment = await Payment.findOne({ pidx });
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    // Update payment status
    if (response.data.status === "Completed") {
      payment.status = "completed";
      await payment.save();

      // Update ride status
      await Ride.findByIdAndUpdate(payment.rideId, {
        paymentStatus: "completed",
      });

      return res.json({
        success: true,
        message: "Payment verified successfully",
        data: response.data,
      });
    }

    payment.status = "failed";
    await payment.save();
    res.json({ success: false, message: "Payment verification failed" });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ error: error.message });
  }
};
