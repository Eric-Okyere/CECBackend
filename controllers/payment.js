const express = require("express");
const router = express.Router();
const axios = require("axios");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Endpoint to initialize payment
router.post("/initialize-payment", async (req, res) => {
  const { email, amount, userId } = req.body;

  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: email,
        amount: amount * 100, // Amount in pesewas/kobo (e.g., GH₵ 10.00 = 1000)
        currency: "GHS",      // Set to GHS for Ghana Cedis
        metadata: {
          userId: userId,     // Pass user ID to identify who paid
        },
        callback_url: "http://localhost:5173/payment-success", // Frontend redirect page
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Returns authorization_url, access_code, reference
    res.status(200).json(response.data.data);
  } catch (error) {
    console.error("Payment initialization error:", error.response?.data || error.message);
    res.status(500).json({ msg: "Failed to initialize payment" });
  }
});

module.exports = router;