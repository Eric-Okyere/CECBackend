import express from "express";
import upload from "../middleware/upload.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import {
  createLesson,
  getLessons,
  getLessonById,
  updateLesson,
  deleteLesson,
  deleteVideoFromLesson,
} from "../controllers/lessonController.js";

const router = express.Router();

// Public: learners browse lessons.
router.get("/", getLessons); // optional ?subject=<name|id>&level=
router.get("/:id", getLessonById);

// Admin only: content management.
router.post("/", protect, adminOnly, upload.array("videos", 5), createLesson);
router.put("/:id", protect, adminOnly, upload.array("videos", 5), updateLesson);
router.delete("/:id", protect, adminOnly, deleteLesson);
router.delete("/:id/videos/:videoId", protect, adminOnly, deleteVideoFromLesson);

export default router;
