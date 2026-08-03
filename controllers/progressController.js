import Progress from "../model/Progress.js";
import User from "../model/User.js";

/**
 * @desc    Save or Update User Progress & Mark Lesson as Completed
 * @route   POST /api/progress/save
 */
export const saveProgress = async (req, res) => {
  try {
    const { 
      userId, 
      user,
      lessonId, 
      lesson,
      subject, 
      level, 
      strand, 
      subStrand, 
      lessonNumber,
      lessonName, 
      score, 
      total, 
      xp 
    } = req.body;

    // Fallback order: req.body.userId -> req.body.user -> req.user._id
    const targetUserId = userId || user || req.user?._id || req.user?.id;
    const targetLessonId = lessonId || lesson;

    if (!targetUserId) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID is required to save progress." 
      });
    }

    const newProgress = new Progress({
      user: targetUserId,
      lesson: targetLessonId,       
      lessonNumber: Number(lessonNumber) || 1,
      lessonName: lessonName || "Lesson", 
      subject,
      level,
      strand,
      subStrand,
      score: Number(score) || 0,
      total: Number(total) || 0,
      xp: Number(xp) || 0,
    });

    await newProgress.save();

    // Optionally update user's cumulative XP directly on the User model
    if (xp) {
      await User.findByIdAndUpdate(targetUserId, {
        $inc: { "learningProfile.xp": Number(xp), xp: Number(xp) }
      });
    }

    res.status(201).json({ success: true, data: newProgress });
  } catch (error) {
    console.error("Error saving progress:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all progress records for a specific user
 * @route   GET /api/progress/user/:userId
 */
export const getUserProgress = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?._id;

    if (!userId) {
      return res.status(400).json({ success: false, message: "No user ID provided" });
    }

    const history = await Progress.find({ user: userId })
      .populate({
        path: "lesson",
        select: "lessonName lessonNumber videos",
        strictPopulate: false
      })
      .sort({ completedAt: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get progress for a specific subject
 * @route   GET /api/progress/user/:userId/:subject
 */
export const getSubjectProgress = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?._id;
    const { subject } = req.params;

    const stats = await Progress.find({ 
      user: userId, 
      subject: new RegExp(subject, 'i') 
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Reset progress (Delete all records for a user)
 * @route   DELETE /api/progress/user/:userId/reset
 */
export const resetProgress = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?._id;
    await Progress.deleteMany({ user: userId });

    await User.findByIdAndUpdate(userId, { $set: { unlockedLessons: [], "learningProfile.xp": 0 } });

    res.status(200).json({
      success: true,
      message: "All learning progress has been cleared."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};