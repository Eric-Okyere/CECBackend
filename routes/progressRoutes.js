import express from "express";
import {
  saveProgress,
  getUserProgress,
  getProgressBySubject,
  deleteProgress,
} from "../controllers/progressController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// 🔐 Protect all routes
router.post("/", authMiddleware, saveProgress);
router.get("/", authMiddleware, getUserProgress);
router.get("/:subject", authMiddleware, getProgressBySubject);
router.delete("/:id", authMiddleware, deleteProgress);

export default router;