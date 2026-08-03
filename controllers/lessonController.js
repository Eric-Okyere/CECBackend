import Lesson from "../model/Lesson.js";
import SubStrand from "../model/SubStrand.js";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// --- HELPER: Cloudinary Upload Stream ---
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "video", folder: "lessons" },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// --- HELPER: Cloudinary Bulk Cleanup on Failure ---
const rollbackCloudinaryUploads = async (publicIds = []) => {
  if (!publicIds.length) return;
  const deletePromises = publicIds.map((id) =>
    cloudinary.uploader.destroy(id, { resource_type: "video" }).catch(() => null)
  );
  await Promise.all(deletePromises);
};

// --- HELPER: Sanitize Quiz Objects ---
const sanitizeQuiz = (quizArray) => {
  if (!Array.isArray(quizArray)) return [];
  return quizArray.map((q) => ({
    ...q,
    question: typeof q.question === "string" ? q.question.trim() : q.question,
    answer: typeof q.answer === "string" ? q.answer.trim() : q.answer,
    explanation: typeof q.explanation === "string" ? q.explanation.trim() : q.explanation,
    options: Array.isArray(q.options)
      ? q.options.map((opt) => (typeof opt === "string" ? opt.trim() : opt))
      : [],
  }));
};

/**
 * @desc    Create a new Lesson (Supports multipart/form-data & JSON)
 * @route   POST /api/lessons
 */
export const createLesson = async (req, res) => {
  const uploadedPublicIds = [];

  try {
    const { titles, quiz, ...otherFields } = req.body;

    // 1. Safely Parse Video Titles
    let videoTitles = [];
    if (typeof titles === "string") {
      try { videoTitles = JSON.parse(titles); } catch { videoTitles = []; }
    } else if (Array.isArray(titles)) {
      videoTitles = titles;
    }

    // 2. Upload Video Files to Cloudinary
    let videoData = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const cloud = await uploadToCloudinary(req.files[i].buffer);
        uploadedPublicIds.push(cloud.public_id);
        videoData.push({
          ...cloud,
          title: videoTitles[i] || `Video ${i + 1}`,
        });
      }
    }

    // 3. Safely Parse & Sanitize Quiz Data
    let rawQuiz = [];
    if (typeof quiz === "string") {
      try { rawQuiz = JSON.parse(quiz); } catch { rawQuiz = []; }
    } else if (Array.isArray(quiz)) {
      rawQuiz = quiz;
    }
    const sanitizedQuiz = sanitizeQuiz(rawQuiz);

    // 4. Create Lesson Document
    const lesson = await Lesson.create({
      ...otherFields,
      videos: videoData,
      quiz: sanitizedQuiz,
    });

    // 5. Append Lesson ID to parent SubStrand array if subStrand is an ObjectId
    if (otherFields.subStrand && mongoose.Types.ObjectId.isValid(otherFields.subStrand)) {
      await SubStrand.findByIdAndUpdate(otherFields.subStrand, {
        $addToSet: { lessons: lesson._id },
      }).catch(() => null); // Silent skip if subStrand is stored as a raw String name
    }

    return res.status(201).json({ success: true, data: lesson });
  } catch (err) {
    // Rollback uploaded Cloudinary files if DB write fails
    await rollbackCloudinaryUploads(uploadedPublicIds);
    return res.status(500).json({ success: false, msg: "Creation failed", error: err.message });
  }
};

/**
 * @desc    Get All Lessons
 * @route   GET /api/lessons
 */
export const getLessons = async (req, res) => {
  try {
    const lessons = await Lesson.find()
      .populate("subject", "name level")
      .populate("subStrand", "title code")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: lessons.length, data: lessons });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * @desc    Get Lesson by ID
 * @route   GET /api/lessons/:id
 */
export const getLessonById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query; // optional: pass ?userId=... from frontend

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid Lesson ID format" });
    }

    const lesson = await Lesson.findById(id)
      .populate("subject", "name level")
      .populate("subStrand", "title code");

    if (!lesson) {
      return res.status(404).json({ success: false, msg: "Lesson not found" });
    }

    // Optional: Check user's server-side progress record
    let isCompleted = false;
    if (userId) {
      const progress = await Progress.findOne({ user: userId, lessonNumber: lesson.lessonNumber });
      if (progress && progress.score > 0) {
        isCompleted = true;
      }
    }

    return res.status(200).json({ 
      success: true, 
      data: {
        ...lesson.toObject(),
        isCompleted
      } 
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * @desc    Update Lesson details or append new videos
 * @route   PUT /api/lessons/:id
 */
export const updateLesson = async (req, res) => {
  const uploadedPublicIds = [];

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid Lesson ID format" });
    }

    const { titles, quiz, ...otherFields } = req.body;

    // 1. Process New Video Uploads
    let newVideos = [];
    if (req.files && req.files.length > 0) {
      let videoTitles = [];
      if (typeof titles === "string") {
        try { videoTitles = JSON.parse(titles); } catch { videoTitles = []; }
      } else if (Array.isArray(titles)) {
        videoTitles = titles;
      }

      for (let i = 0; i < req.files.length; i++) {
        const cloud = await uploadToCloudinary(req.files[i].buffer);
        uploadedPublicIds.push(cloud.public_id);
        newVideos.push({
          url: cloud.url,
          public_id: cloud.public_id,
          title: videoTitles[i] || `New Lesson Video ${i + 1}`,
        });
      }
    }

    const updateData = { ...otherFields };

    // 2. Process Quiz updates if present
    if (quiz !== undefined) {
      let parsedQuiz = [];
      if (typeof quiz === "string") {
        try { parsedQuiz = JSON.parse(quiz); } catch { parsedQuiz = []; }
      } else if (Array.isArray(quiz)) {
        parsedQuiz = quiz;
      }
      updateData.quiz = sanitizeQuiz(parsedQuiz);
    }

    const updateQuery = { $set: updateData };
    if (newVideos.length > 0) {
      updateQuery.$push = { videos: { $each: newVideos } };
    }

    const updatedLesson = await Lesson.findByIdAndUpdate(id, updateQuery, {
      new: true,
      runValidators: true,
    })
      .populate("subject", "name level")
      .populate("subStrand", "title code");

    if (!updatedLesson) {
      await rollbackCloudinaryUploads(uploadedPublicIds);
      return res.status(404).json({ success: false, msg: "Lesson not found" });
    }

    return res.status(200).json({ success: true, data: updatedLesson });
  } catch (err) {
    await rollbackCloudinaryUploads(uploadedPublicIds);
    return res.status(500).json({ success: false, error: err.message });
  }
};




/**
 * @desc    Delete single Video from a Lesson
 * @route   DELETE /api/lessons/:id/videos/:videoId
 */
export const deleteVideoFromLesson = async (req, res) => {
  try {
    const { id, videoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid Lesson ID format" });
    }

    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json({ success: false, msg: "Lesson not found" });
    }

    const video = lesson.videos.id(videoId);
    if (!video) {
      return res.status(404).json({ success: false, msg: "Video not found in this lesson" });
    }

    // Remove video asset from Cloudinary
    if (video.public_id) {
      await cloudinary.uploader.destroy(video.public_id, { resource_type: "video" });
    }

    lesson.videos.pull(videoId);
    await lesson.save();

    return res.status(200).json({ success: true, msg: "Video deleted successfully", data: lesson });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * @desc    Delete Full Lesson & cleanup associated videos & SubStrand refs
 * @route   DELETE /api/lessons/:id
 */
export const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid Lesson ID format" });
    }

    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json({ success: false, msg: "Lesson not found" });
    }

    // 1. Delete all videos from Cloudinary
    if (lesson.videos && lesson.videos.length > 0) {
      const publicIds = lesson.videos.map((v) => v.public_id).filter(Boolean);
      await rollbackCloudinaryUploads(publicIds);
    }

    // 2. Remove Lesson ID reference from SubStrand collection
    if (lesson.subStrand && mongoose.Types.ObjectId.isValid(lesson.subStrand)) {
      await SubStrand.findByIdAndUpdate(lesson.subStrand, {
        $pull: { lessons: lesson._id },
      }).catch(() => null);
    }

    await lesson.deleteOne();

    return res.status(200).json({ success: true, msg: "Lesson deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};