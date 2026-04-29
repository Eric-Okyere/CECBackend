import express from "express";
import {
  saveProgress,
  getUserProgress,
  getSubjectProgress,
  resetProgress,
} from "../controllers/progressController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * All routes below are protected by authMiddleware.
 * This ensures only authenticated users can access/modify progress data.
 */

// Save or Update Progress (POST /api/progress/save)
router.post("/save", authMiddleware, saveProgress);

// Get All Progress for a specific User (GET /api/progress/user/:userId)
router.get("/user/:userId", authMiddleware, getUserProgress);

// Get Progress for a specific Subject (GET /api/progress/user/:userId/:subject)
router.get("/:userId/:subject", authMiddleware, getSubjectProgress);

// Reset/Delete All Progress for a User (DELETE /api/progress/user/:userId/reset)
router.delete("/:userId/reset", authMiddleware, resetProgress);

export default router;