import express from "express";
import { initializePayment, verifyPayment, getPlans } from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

// NOTE: the webhook route is mounted directly in server.js, BEFORE express.json(),
// because Paystack's signature must be checked against the raw request body.
const router = express.Router();

router.get("/plans", getPlans);
router.post("/initialize", protect, initializePayment);
router.get("/verify/:reference", protect, verifyPayment);

export default router;
