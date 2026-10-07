import express from "express";
import { createFeedback, getFeedbacks, updateFeedbackStatus } from "../controllers/feedbackController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { feedbackLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.route("/").get(protect, adminOnly, getFeedbacks).post(feedbackLimiter, createFeedback);
router.patch("/:id", protect, adminOnly, updateFeedbackStatus);

export default router;
