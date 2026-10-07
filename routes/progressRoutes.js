import express from "express";
import {
  saveProgress,
  getUserProgress,
  getSubjectProgress,
  resetProgress,
} from "../controllers/progressController.js";
import { protect, requireSelfParentOrAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Every route needs a login, and you may only touch your own (or your child's) progress.
router.post("/save", protect, saveProgress);
router.get("/user/:userId", protect, requireSelfParentOrAdmin("userId"), getUserProgress);
router.delete("/:userId/reset", protect, requireSelfParentOrAdmin("userId"), resetProgress);
router.get("/:userId/:subject", protect, requireSelfParentOrAdmin("userId"), getSubjectProgress);

export default router;
