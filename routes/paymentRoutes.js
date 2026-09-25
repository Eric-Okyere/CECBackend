import express from "express";
const router = express.Router();
import { initializePayment, verifyPayment, handleWebhook } from "../controllers/paymentController.js";

router.post("/initialize", initializePayment);
router.get("/verify/:reference", verifyPayment);
router.post("/webhook", handleWebhook);

export default router;