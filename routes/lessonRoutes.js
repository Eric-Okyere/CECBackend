import express from "express";
import upload from "../middleware/upload.js"; // Ensure this matches your file name
import { 
  createLesson, 
  getLessons, 
  getLessonById, 
  updateLesson, 
  deleteLesson,
  deleteVideoFromLesson // Adding this for granular control
} from "../controllers/lessonController.js";

const router = express.Router();

/**
 * @route   GET /api/lessons
 * @desc    Get all lessons with optional filters (?subject=Math)
 */
router.get("/", getLessons);

/**
 * @route   GET /api/lessons/:id
 * @desc    Get a single lesson's full details
 */
router.get("/:id", getLessonById);

/**
 * @route   POST /api/lessons
 * @desc    Create a new lesson with multiple videos (max5)
 */
router.post("/", upload.array("videos", 5), createLesson);

/**
 * @route   PUT /api/lessons/:id
 * @desc    Update text/quiz and APPEND new videos to the array
 */
router.put("/:id", upload.array("videos", 5), updateLesson);

/**
 * @route   DELETE /api/lessons/:id
 * @desc    Delete entire lesson and all associated Cloudinary files
 */
router.delete("/:id", deleteLesson);

/**
 * @route   DELETE /api/lessons/:id/videos/:videoId
 * @desc    Delete a SPECIFIC video from the array and Cloudinary
 */
router.delete("/:id/videos/:videoId", deleteVideoFromLesson);

export default router;