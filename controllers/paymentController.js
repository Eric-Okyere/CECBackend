const axios = require("axios");
const crypto = require("crypto");
const Transaction = require("../models/Transaction");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// 1. Initialize Payment
exports.initializePayment = async (req, res) => {
  const { email, amount, userId, planType } = req.body;

  if (!email || !amount || !userId) {
    return res.status(400).json({ msg: "Missing required fields: email, amount, userId" });
  }

  try {
    const reference = `TX_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    await Transaction.create({
      userId,
      email,
      amount,
      reference,
      status: "pending",
      metadata: { planType },
    });

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Math.round(amount * 100), // Convert GHS to Pesewas
        currency: "GHS",
        reference,
        metadata: {
          userId,
          planType,
        },
        callback_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/payment-success`,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json(response.data.data);
  } catch (error) {
    console.error("Paystack Initialization Error:", error.response?.data || error.message);
    return res.status(500).json({ msg: "Failed to initialize payment gateway." });
  }
};

// 2. Direct Payment Verification
exports.verifyPayment = async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const { status, data } = response.data;

    if (status && data.status === "success") {
      const transaction = await Transaction.findOneAndUpdate(
        { reference },
        {
          status: "success",
          channel: data.channel,
        },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        message: "Payment verified successfully.",
        transaction,
      });
    }

    await Transaction.findOneAndUpdate({ reference }, { status: "failed" });
    return res.status(400).json({ success: false, message: "Payment failed or incomplete." });
  } catch (error) {
    console.error("Paystack Verification Error:", error.response?.data || error.message);
    return res.status(500).json({ msg: "Error verifying payment reference." });
  }
};

// 3. Paystack Webhook Event Handler
exports.handleWebhook = async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(400).send("Invalid webhook signature.");
    }

    const { event, data } = req.body;

    if (event === "charge.success") {
      const { reference, channel, metadata } = data;

      const transaction = await Transaction.findOneAndUpdate(
        { reference },
        {
          status: "success",
          channel,
        },
        { new: true }
      );

      if (transaction && metadata?.userId) {
        console.log(`[Webhook Confirmed] User ${metadata.userId} completed payment Ref: ${reference}`);
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("[Webhook Error]:", error);
    return res.sendStatus(500);
  }
};