import Progress from "../model/Progress.js";
import User from "../model/User.js";

/**
 * @desc    Save or Update User Progress after a Quiz
 * @route   POST /api/progress/save
 */
export const saveProgress = async (req, res) => {
  try {
    const { user, subject, level, strand, subStrand, score, total, xp } = req.body;

    if (!user || !subject || !subStrand) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Use findOneAndUpdate with upsert:true to prevent duplicate rows for the same lesson
    const progress = await Progress.findOneAndUpdate(
      { user, subject, subStrand }, // Unique identifier for this lesson
      { 
        level, 
        strand, 
        score, 
        total, 
        xp, 
        completedAt: Date.now() 
      },
      { upsert: true, new: true }
    );

    // Increment user's total XP in the User collection simultaneously
    await User.findByIdAndUpdate(user, {
      $inc: { "learningProfile.xp": xp }
    });

    res.status(200).json({
      success: true,
      message: "Progress saved and XP updated",
      data: progress
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all progress records for a specific user
 * @route   GET /api/progress/user/:userId
 */
export const getUserProgress = async (req, res) => {
  try {
    const { userId } = req.params;
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
    const { userId, subject } = req.params;
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
    const { userId } = req.params;
    await Progress.deleteMany({ user: userId });

    res.status(200).json({
      success: true,
      message: "All learning progress has been cleared."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};