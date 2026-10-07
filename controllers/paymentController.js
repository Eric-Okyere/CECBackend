import axios from "axios";
import crypto from "crypto";
import Transaction from "../model/Transaction.js";
import User from "../model/User.js";
import { canActForUser } from "../middleware/authMiddleware.js";

const PAYSTACK_API = "https://api.paystack.co";
const CURRENCY = "GHS";

/**
 * Prices live on the server. Previously the browser sent the amount, so anyone
 * could buy premium for GH₵0.01.
 *
 * Configure with an env var, e.g.  PAYMENT_PLANS={"premium":50}
 * (plan name -> price in Ghana cedis). Payments are disabled until it is set.
 */
const getPlanTable = () => {
  try {
    const parsed = JSON.parse(process.env.PAYMENT_PLANS || "{}");
    return Object.fromEntries(
      Object.entries(parsed).filter(([, price]) => Number.isFinite(Number(price)) && Number(price) > 0)
    );
  } catch {
    console.error("PAYMENT_PLANS is not valid JSON; payments are disabled.");
    return {};
  }
};

const paystack = () => {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    const err = new Error("Payments are not configured yet.");
    err.status = 503;
    err.expose = true;
    throw err;
  }
  return axios.create({
    baseURL: PAYSTACK_API,
    timeout: 15000,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
};

/**
 * Marks a transaction successful and grants premium to the learner — exactly once,
 * and only if Paystack confirms the right amount in the right currency was paid.
 */
const fulfillTransaction = async (reference, paystackData) => {
  const transaction = await Transaction.findOne({ reference });
  if (!transaction) return { ok: false, reason: "Unknown payment reference." };
  if (transaction.status === "success") return { ok: true, transaction };

  const expectedPesewas = Math.round(transaction.amount * 100);
  const paidEnough =
    paystackData?.status === "success" &&
    Number(paystackData.amount) >= expectedPesewas &&
    String(paystackData.currency || "").toUpperCase() === CURRENCY;

  if (!paidEnough) {
    await Transaction.updateOne({ reference, status: "pending" }, { status: "failed" });
    return { ok: false, reason: "Payment failed or incomplete." };
  }

  // Atomic pending -> success, so the webhook and the verify call can't double-grant.
  const updated = await Transaction.findOneAndUpdate(
    { reference, status: { $ne: "success" } },
    { status: "success", channel: paystackData.channel },
    { returnDocument: "after" }
  );
  if (!updated) return { ok: true, transaction: await Transaction.findOne({ reference }) };

  const beneficiary = updated.metadata?.beneficiaryId || updated.userId;
  await User.updateOne({ _id: beneficiary }, { $set: { "learningProfile.isPaid": true } });

  return { ok: true, transaction: updated };
};

// GET /api/payments/plans — lets the frontend show prices from one source of truth.
export const getPlans = (req, res) => {
  const plans = getPlanTable();
  res.json({
    success: true,
    currency: CURRENCY,
    plans: Object.entries(plans).map(([name, price]) => ({ name, price: Number(price) })),
  });
};

// POST /api/payments/initialize   body: { planType, learnerId? }
export const initializePayment = async (req, res) => {
  const { planType } = req.body || {};
  const learnerId = req.body?.learnerId || req.body?.userId || req.userId;

  const plans = getPlanTable();
  const price = Number(plans[planType]);
  if (!price) {
    return res.status(400).json({
      msg: Object.keys(plans).length
        ? `Unknown plan. Choose one of: ${Object.keys(plans).join(", ")}`
        : "Payments are not configured yet.",
    });
  }

  // A parent can pay for their own child; nobody can pay "for" a stranger's account.
  if (!(await canActForUser(req, learnerId))) {
    return res.status(403).json({ msg: "You can only pay for your own account or your child's." });
  }

  // Children have no email, so the paying account's email is used.
  const email = req.user.email;
  if (!email) return res.status(400).json({ msg: "Your account needs an email address to pay." });

  const reference = `CEC_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const client = paystack();

  await Transaction.create({
    userId: req.userId,
    email,
    amount: price,
    reference,
    status: "pending",
    metadata: { planType, beneficiaryId: String(learnerId) },
  });

  try {
    const response = await client.post("/transaction/initialize", {
      email,
      amount: Math.round(price * 100), // pesewas
      currency: CURRENCY,
      reference,
      metadata: { userId: req.userId, beneficiaryId: String(learnerId), planType },
      callback_url: `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "")}/payment-success`,
    });
    return res.status(200).json(response.data.data);
  } catch (error) {
    console.error("Paystack Initialization Error:", error.response?.data || error.message);
    await Transaction.updateOne({ reference }, { status: "failed" });
    return res.status(502).json({ msg: "Failed to initialize payment gateway." });
  }
};

// GET /api/payments/verify/:reference
export const verifyPayment = async (req, res) => {
  const { reference } = req.params;

  const transaction = await Transaction.findOne({ reference });
  if (!transaction) return res.status(404).json({ success: false, message: "Payment not found." });

  if (String(transaction.userId) !== req.userId && !req.user.admin) {
    return res.status(403).json({ success: false, message: "This payment belongs to another account." });
  }

  if (transaction.status === "success") {
    return res.json({ success: true, message: "Payment verified successfully.", transaction });
  }

  let data;
  try {
    const response = await paystack().get(`/transaction/verify/${encodeURIComponent(reference)}`);
    data = response.data?.data;
  } catch (error) {
    if (error.status === 503) throw error;
    console.error("Paystack Verification Error:", error.response?.data || error.message);
    return res.status(502).json({ success: false, message: "Error verifying payment reference." });
  }

  const result = await fulfillTransaction(reference, data);
  if (!result.ok) return res.status(400).json({ success: false, message: result.reason });

  return res.status(200).json({
    success: true,
    message: "Payment verified successfully.",
    transaction: result.transaction,
  });
};

// POST /api/payments/webhook  (raw body — mounted in server.js before express.json)
export const handleWebhook = async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.sendStatus(503);

  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  const received = String(req.headers["x-paystack-signature"] || "");

  const valid =
    received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!valid) return res.status(400).send("Invalid webhook signature.");

  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid JSON.");
  }

  if (event?.event === "charge.success" && event.data?.reference) {
    try {
      const result = await fulfillTransaction(event.data.reference, event.data);
      if (!result.ok) console.warn(`[Webhook] ${event.data.reference}: ${result.reason}`);
    } catch (err) {
      console.error("[Webhook Error]:", err);
      return res.sendStatus(500); // Paystack will retry
    }
  }

  return res.sendStatus(200);
};
