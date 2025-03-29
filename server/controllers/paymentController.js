import Payment from "../models/paymentModel.js"
import Ride from "../models/rideModel.js"
import axios from "axios"
import dotenv from "dotenv"
import { v4 as uuidv4 } from "uuid"

dotenv.config()

const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY
const KHALTI_BASE_URL = "https://a.khalti.com/api/v2"

// Initialize Khalti Payment
export const initializePayment = async (req, res) => {
  try {
    const { rideId } = req.params
    const { amount, passengerId, timestamp } = req.query

    console.log("Initializing payment for ride:", rideId)
    console.log("Payment parameters:", { amount, passengerId, timestamp })

    // Validate ride
    const ride = await Ride.findById(rideId)
    if (!ride) return res.status(404).json({ error: "Ride not found" })
    if (ride.paymentStatus === "completed") {
      return res.status(400).json({ error: "Payment already completed" })
    }

    // Create payment record with a unique transaction ID
    const payment = new Payment({
      rideId: ride._id,
      amount: ride.fare,
      status: "pending",
      transactionId: uuidv4(), // Generate a unique ID for each transaction
    })

    // Prepare Khalti payload with modified return_url to include app scheme
    const payload = {
      return_url: `${process.env.BASE_URL}/api/payments/verify`,
      website_url: process.env.BASE_URL,
      amount: ride.fare * 100, // Convert to paisa
      purchase_order_id: payment._id.toString(),
      purchase_order_name: `Ride-${ride._id}`,
      customer_info: {
        name: "Test User",
        email: "test@example.com",
      },
    }

    // Log the payload for debugging
    console.log("Khalti Payload:", payload)

    // Initiate Khalti payment
    const response = await axios.post(`${KHALTI_BASE_URL}/epayment/initiate/`, payload, {
      headers: {
        Authorization: `Key ${KHALTI_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    })

    console.log("Khalti initialization response:", response.data)

    // Update payment with Khalti reference
    payment.pidx = response.data.pidx
    await payment.save()

    res.json({
      payment_url: response.data.payment_url,
      pidx: response.data.pidx,
      payment_id: payment._id,
    })
  } catch (error) {
    console.error("Payment initialization failed:", error)

    // Provide more detailed error information
    if (error.response) {
      console.error("Khalti API error response:", error.response.data)
      return res.status(error.response.status).json({
        error: error.message,
        details: error.response.data,
      })
    }

    res.status(500).json({ error: error.message })
  }
}

// Verify Payment
export const verifyPayment = async (req, res) => {
  try {
    const { pidx } = req.query

    console.log("Verifying payment with pidx:", pidx)

    if (!pidx) {
      return res.status(400).json({ error: "Missing pidx parameter" })
    }

    // Verify with Khalti
    const response = await axios.post(
      `${KHALTI_BASE_URL}/epayment/lookup/`,
      { pidx },
      {
        headers: {
          Authorization: `Key ${KHALTI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    )

    console.log("Khalti verification response:", response.data)

    const payment = await Payment.findOne({ pidx })
    if (!payment) {
      console.log("Payment not found for pidx:", pidx)
      return res.status(404).json({ error: "Payment not found" })
    }

    // Update payment status
    if (response.data.status === "Completed") {
      payment.status = "completed"
      await payment.save()

      // Update ride status - Fixed typo in paymentStatus field
      const ride = await Ride.findByIdAndUpdate(
        payment.rideId,
        {
          paymentStatus: "completed", // Fixed typo from paymentStatuss
          paymentMethod: "khalti",
        },
        { new: true },
      )

      console.log("Payment verified successfully for pidx:", pidx)

      // Check if this is a browser request (from Khalti redirect)
      const isBrowser =
        req.headers["user-agent"] &&
        (req.headers["user-agent"].includes("Mozilla") || req.headers["user-agent"].includes("WebKit"))

      if (isBrowser) {
        // Redirect to app with success status
        return res.send(`
          <html>
            <head>
              <meta http-equiv="refresh" content="0;url=nepride://payment/verify?pidx=${pidx}&status=success">
              <script>
                window.location.href = "nepride://payment/verify?pidx=${pidx}&status=success";
              </script>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background-color: #f7fafc;
                  text-align: center;
                  padding: 20px;
                }
                .success-icon {
                  color: #48bb78;
                  font-size: 48px;
                  margin-bottom: 20px;
                }
                h1 {
                  color: #2d3748;
                  margin-bottom: 16px;
                }
                p {
                  color: #4a5568;
                  margin-bottom: 24px;
                }
                a {
                  background-color: #6941C6;
                  color: white;
                  padding: 12px 24px;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: bold;
                }
              </style>
            </head>
            <body>
              <div class="success-icon">✓</div>
              <h1>Payment Successful!</h1>
              <p>Your payment has been processed successfully. Redirecting back to app...</p>
              <p>If you are not redirected automatically, <a href="nepride://payment/verify?pidx=${pidx}&status=success">click here</a>.</p>
            </body>
          </html>
        `)
      }

      return res.json({
        success: true,
        message: "Payment verified successfully",
        data: response.data,
        ride: ride,
      })
    }

    payment.status = "failed"
    await payment.save()

    // Check if this is a browser request (from Khalti redirect)
    const isBrowser =
      req.headers["user-agent"] &&
      (req.headers["user-agent"].includes("Mozilla") || req.headers["user-agent"].includes("WebKit"))

    if (isBrowser) {
      // Redirect to app with failure status
      return res.send(`
        <html>
          <head>
            <meta http-equiv="refresh" content="0;url=nepride://payment/verify?pidx=${pidx}&status=failed">
            <script>
              window.location.href = "nepride://payment/verify?pidx=${pidx}&status=failed";
            </script>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: #f7fafc;
                text-align: center;
                padding: 20px;
              }
              .error-icon {
                color: #e53e3e;
                font-size: 48px;
                margin-bottom: 20px;
              }
              h1 {
                color: #2d3748;
                margin-bottom: 16px;
              }
              p {
                color: #4a5568;
                margin-bottom: 24px;
              }
              a {
                background-color: #6941C6;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="error-icon">✗</div>
            <h1>Payment Failed</h1>
            <p>Your payment could not be processed. Redirecting back to app...</p>
            <p>If you are not redirected automatically, <a href="nepride://payment/verify?pidx=${pidx}&status=failed">click here</a>.</p>
          </body>
        </html>
      `)
    }

    res.json({ success: false, message: "Payment verification failed" })
  } catch (error) {
    console.error("Payment verification error:", error)

    // Check if this is a browser request (from Khalti redirect)
    const isBrowser =
      req.headers["user-agent"] &&
      (req.headers["user-agent"].includes("Mozilla") || req.headers["user-agent"].includes("WebKit"))

    if (isBrowser) {
      // Redirect to app with error status
      return res.send(`
        <html>
          <head>
            <meta http-equiv="refresh" content="0;url=nepride://payment/verify?status=error">
            <script>
              window.location.href = "nepride://payment/verify?status=error";
            </script>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: #f7fafc;
                text-align: center;
                padding: 20px;
              }
              .error-icon {
                color: #e53e3e;
                font-size: 48px;
                margin-bottom: 20px;
              }
              h1 {
                color: #2d3748;
                margin-bottom: 16px;
              }
              p {
                color: #4a5568;
                margin-bottom: 24px;
              }
              a {
                background-color: #6941C6;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="error-icon">✗</div>
            <h1>Payment Error</h1>
            <p>There was an error processing your payment. Redirecting back to app...</p>
            <p>If you are not redirected automatically, <a href="nepride://payment/verify?status=error">click here</a>.</p>
          </body>
        </html>
      `)
    }

    res.status(500).json({ error: error.message })
  }
}

