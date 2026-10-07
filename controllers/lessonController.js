import fs from "fs/promises";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import Lesson from "../model/Lesson.js";
import SubStrand from "../model/SubStrand.js";
import Subject from "../model/Subject.js";
import Progress from "../model/Progress.js"; // was missing -> crashed when ?userId= was passed
import { exactInsensitive } from "../utils/escapeRegex.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

// --- HELPERS ---------------------------------------------------------------

// Uploads from the temp file on disk; upload_large sends it in chunks (needed > 100 MB).
const uploadToCloudinary = (filePath) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      filePath,
      { resource_type: "video", folder: "lessons", chunk_size: 20 * 1024 * 1024 },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
  });

const removeTempFiles = async (files = []) => {
  await Promise.all(files.map((f) => (f?.path ? fs.unlink(f.path).catch(() => null) : null)));
};

const rollbackCloudinaryUploads = async (publicIds = []) => {
  if (!publicIds.length) return;
  await Promise.all(
    publicIds.map((id) => cloudinary.uploader.destroy(id, { resource_type: "video" }).catch(() => null))
  );
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const sanitizeQuiz = (quizArray) =>
  parseJsonArray(quizArray)
    .filter((q) => q && typeof q.question === "string" && q.question.trim())
    .map((q) => ({
      question: q.question.trim(),
      answer: typeof q.answer === "string" ? q.answer.trim() : String(q.answer ?? "").trim(),
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
      options: Array.isArray(q.options)
        ? q.options.map((opt) => (typeof opt === "string" ? opt.trim() : String(opt))).filter(Boolean)
        : [],
    }));

/**
 * The create form sends the subject *name*, but Lesson.subject is an ObjectId, so
 * lesson creation threw a CastError. Accept either an id or a name (+ level).
 */
const resolveSubjectId = async (subject, level) => {
  if (!subject) return undefined;
  if (isValidId(subject)) return subject;
  const query = { name: exactInsensitive(subject) };
  if (level) query.level = exactInsensitive(level);
  const found = (await Subject.findOne(query).select("_id")) || (await Subject.findOne({ name: query.name }).select("_id"));
  return found?._id;
};

// Only these fields can be written to a lesson from a request.
const pickLessonFields = async (body = {}) => {
  const out = {};
  if (body.level !== undefined) out.level = String(body.level).trim();
  if (body.strand !== undefined) out.strand = String(body.strand).trim();
  if (body.lessonName !== undefined) out.lessonName = String(body.lessonName).trim();
  if (body.lessonNumber !== undefined && body.lessonNumber !== "") out.lessonNumber = Number(body.lessonNumber);
  if (body.subStrand !== undefined) out.subStrand = body.subStrand;
  if (body.subject !== undefined && body.subject !== "") {
    const subjectId = await resolveSubjectId(body.subject, body.level);
    if (subjectId) out.subject = subjectId;
  }
  return out;
};

const uploadAll = async (files, titles, defaultTitle, uploadedPublicIds) => {
  const videoTitles = parseJsonArray(titles);
  const out = [];
  for (let i = 0; i < files.length; i++) {
    const cloud = await uploadToCloudinary(files[i].path);
    uploadedPublicIds.push(cloud.public_id);
    out.push({ ...cloud, title: String(videoTitles[i] || `${defaultTitle} ${i + 1}`).trim() });
  }
  return out;
};

// --- CONTROLLERS ------------------------------------------------------------

/**
 * @route   POST /api/lessons   (admin, multipart/form-data)
 */
export const createLesson = async (req, res) => {
  const uploadedPublicIds = [];
  const files = req.files || [];

  try {
    const fields = await pickLessonFields(req.body);

    if (!fields.subStrand || !isValidId(fields.subStrand)) {
      return res.status(400).json({ success: false, msg: "Please choose a valid sub-strand." });
    }
    if (!fields.lessonName) {
      return res.status(400).json({ success: false, msg: "Lesson name is required." });
    }

    const videos = await uploadAll(files, req.body.titles, "Video", uploadedPublicIds);

    const lesson = await Lesson.create({
      ...fields,
      videos,
      quiz: sanitizeQuiz(req.body.quiz),
    });

    await SubStrand.findByIdAndUpdate(fields.subStrand, { $addToSet: { lessons: lesson._id } }).catch(
      () => null
    );

    return res.status(201).json({ success: true, data: lesson });
  } catch (err) {
    await rollbackCloudinaryUploads(uploadedPublicIds);
    const status = err.name === "ValidationError" || err.name === "CastError" ? 400 : 500;
    if (status === 500) console.error("Create lesson failed:", err);
    return res.status(status).json({ success: false, msg: "Creation failed", error: err.message });
  } finally {
    await removeTempFiles(files);
  }
};

/**
 * @route   GET /api/lessons   (public)  optional ?subject=<name|id>&level=<level>
 */
export const getLessons = async (req, res) => {
  const filter = {};
  const { subject } = req.query;

  if (subject) {
    // Subject is stored as an id; look up ids by name. Lessons with no subject
    // (older records) are kept so nothing disappears from the learner's view.
    const ids = isValidId(subject)
      ? [subject]
      : (await Subject.find({ name: exactInsensitive(subject) }).select("_id").lean()).map((s) => s._id);
    filter.$or = [{ subject: { $in: ids } }, { subject: { $exists: false } }, { subject: null }];
  }

  const lessons = await Lesson.find(filter)
    .populate("subject", "name level")
    .populate("subStrand", "title code")
    .sort({ createdAt: -1 });

  return res.status(200).json({ success: true, count: lessons.length, data: lessons });
};

/**
 * @route   GET /api/lessons/:id   (public)
 */
export const getLessonById = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, msg: "Invalid Lesson ID format" });
  }

  const lesson = await Lesson.findById(id)
    .populate("subject", "name level")
    .populate("subStrand", "title code");

  if (!lesson) return res.status(404).json({ success: false, msg: "Lesson not found" });

  let isCompleted = false;
  if (userId && isValidId(userId)) {
    const progress = await Progress.findOne({ user: userId, lesson: lesson._id, score: { $gt: 0 } })
      .select("_id")
      .lean();
    isCompleted = Boolean(progress);
  }

  return res.status(200).json({ success: true, data: { ...lesson.toObject(), isCompleted } });
};

/**
 * @route   PUT /api/lessons/:id   (admin, multipart/form-data)
 * Updates text/quiz, renames existing videos, and appends any new videos.
 */
export const updateLesson = async (req, res) => {
  const uploadedPublicIds = [];
  const files = req.files || [];

  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, msg: "Invalid Lesson ID format" });
    }

    const lesson = await Lesson.findById(id);
    if (!lesson) return res.status(404).json({ success: false, msg: "Lesson not found" });

    const fields = await pickLessonFields(req.body);
    if (fields.subStrand !== undefined && !isValidId(fields.subStrand)) delete fields.subStrand;
    const oldSubStrand = lesson.subStrand ? String(lesson.subStrand) : null;

    Object.assign(lesson, fields);
    if (req.body.quiz !== undefined) lesson.quiz = sanitizeQuiz(req.body.quiz);

    // Titles of existing videos edited in the form (previously ignored).
    for (const v of parseJsonArray(req.body.existingVideos)) {
      const existing = v?._id && lesson.videos.id(v._id);
      if (existing && typeof v.title === "string" && v.title.trim()) existing.title = v.title.trim();
    }

    const newVideos = await uploadAll(files, req.body.titles, "New Lesson Video", uploadedPublicIds);
    newVideos.forEach((v) => lesson.videos.push(v));

    await lesson.save();

    // Keep SubStrand.lessons in sync if the lesson moved.
    const newSubStrand = lesson.subStrand ? String(lesson.subStrand) : null;
    if (oldSubStrand !== newSubStrand) {
      if (oldSubStrand) await SubStrand.findByIdAndUpdate(oldSubStrand, { $pull: { lessons: lesson._id } }).catch(() => null);
      if (newSubStrand) await SubStrand.findByIdAndUpdate(newSubStrand, { $addToSet: { lessons: lesson._id } }).catch(() => null);
    }

    const updatedLesson = await Lesson.findById(id)
      .populate("subject", "name level")
      .populate("subStrand", "title code");

    return res.status(200).json({ success: true, data: updatedLesson });
  } catch (err) {
    await rollbackCloudinaryUploads(uploadedPublicIds);
    const status = err.name === "ValidationError" || err.name === "CastError" ? 400 : 500;
    if (status === 500) console.error("Update lesson failed:", err);
    return res.status(status).json({ success: false, msg: "Update failed", error: err.message });
  } finally {
    await removeTempFiles(files);
  }
};

/**
 * @route   DELETE /api/lessons/:id/videos/:videoId   (admin)
 */
export const deleteVideoFromLesson = async (req, res) => {
  const { id, videoId } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, msg: "Invalid Lesson ID format" });
  }

  const lesson = await Lesson.findById(id);
  if (!lesson) return res.status(404).json({ success: false, msg: "Lesson not found" });

  const video = lesson.videos.id(videoId);
  if (!video) return res.status(404).json({ success: false, msg: "Video not found in this lesson" });

  if (video.public_id) {
    await cloudinary.uploader.destroy(video.public_id, { resource_type: "video" }).catch((e) =>
      console.warn("Cloudinary delete failed:", e.message)
    );
  }

  lesson.videos.pull(videoId);
  await lesson.save();

  return res.status(200).json({ success: true, msg: "Video deleted successfully", data: lesson });
};

/**
 * @route   DELETE /api/lessons/:id   (admin)
 */
export const deleteLesson = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, msg: "Invalid Lesson ID format" });
  }

  const lesson = await Lesson.findById(id);
  if (!lesson) return res.status(404).json({ success: false, msg: "Lesson not found" });

  const publicIds = (lesson.videos || []).map((v) => v.public_id).filter(Boolean);
  await rollbackCloudinaryUploads(publicIds);

  if (lesson.subStrand) {
    await SubStrand.findByIdAndUpdate(lesson.subStrand, { $pull: { lessons: lesson._id } }).catch(() => null);
  }

  await Progress.updateMany({ lesson: lesson._id }, { $unset: { lesson: "" } }).catch(() => null);
  await lesson.deleteOne();

  return res.status(200).json({ success: true, msg: "Lesson deleted successfully" });
};
