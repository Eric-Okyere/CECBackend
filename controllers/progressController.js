import mongoose from "mongoose";
import Progress from "../model/Progress.js";
import Lesson from "../model/Lesson.js";
import User from "../model/User.js";
import { canActForUser } from "../middleware/authMiddleware.js";
import { escapeRegex } from "../utils/escapeRegex.js";

const XP_PER_CORRECT_ANSWER = 2;

/**
 * @desc    Save a quiz attempt and award XP
 * @route   POST /api/progress/save
 *
 * XP is calculated on the server from the score (it used to be trusted from the
 * browser, so anyone could send xp: 999999). Retaking a lesson only awards the
 * XP *improvement* over your best previous attempt, so lessons can't be farmed.
 */
export const saveProgress = async (req, res) => {
  const {
    userId, user, lessonId, lesson,
    subject, level, strand, subStrand,
    lessonNumber, lessonName, score, total,
  } = req.body || {};

  const targetUserId = String(userId || user || req.userId);
  const targetLessonId = lessonId || lesson;

  if (!(await canActForUser(req, targetUserId))) {
    return res.status(403).json({ success: false, message: "You do not have access to this account." });
  }

  // Work out the real number of questions from the lesson when we can.
  let questionCount = Math.max(0, Math.floor(Number(total) || 0));
  let lessonDoc = null;
  if (targetLessonId && mongoose.Types.ObjectId.isValid(targetLessonId)) {
    lessonDoc = await Lesson.findById(targetLessonId).select("quiz lessonNumber lessonName").lean();
    if (lessonDoc) questionCount = lessonDoc.quiz?.length || 0;
  }

  const safeScore = Math.min(Math.max(0, Math.floor(Number(score) || 0)), questionCount);
  const earnedXP = safeScore * XP_PER_CORRECT_ANSWER;

  // Best previous XP for this lesson -> only award the improvement.
  let awardedXP = earnedXP;
  if (lessonDoc) {
    const best = await Progress.findOne({ user: targetUserId, lesson: lessonDoc._id })
      .sort({ xp: -1 })
      .select("xp")
      .lean();
    awardedXP = Math.max(0, earnedXP - (best?.xp || 0));
  }

  const newProgress = await Progress.create({
    user: targetUserId,
    lesson: lessonDoc?._id,
    lessonNumber: Number(lessonNumber) || lessonDoc?.lessonNumber || 1,
    lessonName: lessonName || lessonDoc?.lessonName || "Lesson",
    subject,
    level,
    strand,
    subStrand,
    score: safeScore,
    total: questionCount,
    xp: earnedXP,
  });

  if (awardedXP > 0) {
    await User.updateOne({ _id: targetUserId }, { $inc: { "learningProfile.xp": awardedXP } });
  }

  res.status(201).json({ success: true, data: newProgress, xpAwarded: awardedXP });
};

/**
 * @route   GET /api/progress/user/:userId
 */
export const getUserProgress = async (req, res) => {
  const history = await Progress.find({ user: req.params.userId })
    .populate({ path: "lesson", select: "lessonName lessonNumber videos", strictPopulate: false })
    .sort({ completedAt: -1 });

  res.status(200).json({ success: true, count: history.length, data: history });
};

/**
 * @route   GET /api/progress/:userId/:subject
 */
export const getSubjectProgress = async (req, res) => {
  const stats = await Progress.find({
    user: req.params.userId,
    subject: new RegExp(escapeRegex(req.params.subject), "i"),
  });
  res.status(200).json({ success: true, data: stats });
};

/**
 * @route   DELETE /api/progress/:userId/reset
 */
export const resetProgress = async (req, res) => {
  const { userId } = req.params;
  await Progress.deleteMany({ user: userId });
  await User.updateOne({ _id: userId }, { $set: { unlockedLessons: [], "learningProfile.xp": 0 } });

  res.status(200).json({ success: true, message: "All learning progress has been cleared." });
};
