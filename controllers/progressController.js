import Progress from "../model/Progress.js";
import User from "../model/User.js";

/**
 * @desc    Save or Update User Progress & Mark Lesson as Completed
 * @route   POST /api/progress/save
 */
export const saveProgress = async (req, res) => {
  try {
    // Read user ID from auth middleware or body fallback
    const userId = req.user?._id || req.user?.id || req.body.user;
    const { subject, level, strand, subStrand, lessonNumber, score, total, xp = 0 } = req.body;

    if (!userId || !subject || !subStrand) {
      return res.status(400).json({ success: false, message: "Missing required fields: user, subject, subStrand" });
    }

    // 1. Save or Update in Progress Collection
    const progress = await Progress.findOneAndUpdate(
      { user: userId, subject, subStrand, level },
      { 
        strand, 
        lessonNumber,
        score, 
        total, 
        xp, 
        isCompleted: true, // 👈 Mark lesson completed
        completedAt: new Date() 
      },
      { upsert: true, new: true }
    );

    // 2. Update User Document: Add to unlockedLessons array & Increment total XP
    const user = await User.findById(userId);

    if (user) {
      // Check if lesson is already in unlockedLessons array
      const alreadyUnlocked = user.unlockedLessons.some(
        (item) =>
          item.subject?.toLowerCase() === subject?.toLowerCase() &&
          item.level?.toLowerCase() === level?.toLowerCase() &&
          item.subStrand?.toLowerCase() === subStrand?.toLowerCase()
      );

      if (!alreadyUnlocked) {
        user.unlockedLessons.push({
          subject,
          level,
          subStrand,
          unlockedAt: new Date(),
        });
      }

      // Increment XP in learning profile
      user.learningProfile = user.learningProfile || {};
      user.learningProfile.xp = (user.learningProfile.xp || 0) + Number(xp);

      await user.save();
    }

    res.status(200).json({
      success: true,
      message: "Progress saved, lesson marked as completed, and XP updated",
      data: progress
    });
  } catch (error) {
    console.error("Save Progress Error:", error);
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
    const history = await Progress.find({ user: userId }).sort({ completedAt: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get progress for a specific subject (e.g., Science performance)
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

    // Clear unlockedLessons on user model as well
    await User.findByIdAndUpdate(userId, { $set: { unlockedLessons: [] } });

    res.status(200).json({
      success: true,
      message: "All learning progress has been cleared."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};