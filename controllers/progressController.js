import Progress from "../model/Progress.js";
import User from "../model/User.js";


// ==============================
// ➕ SAVE PROGRESS (from Lesson)
// ==============================
export const saveProgress = async (req, res) => {
  try {
    const userId = req.user.id; // 🔐 from JWT middleware

    const {
      subject,
      level,
      strand,
      subStrand,
      score,
      total,
      xp,
    } = req.body;

    // ✅ Create progress record
    const progress = await Progress.create({
      user: userId,
      subject,
      level,
      strand,
      subStrand,
      score,
      total,
      xp,
    });

    // ✅ Update user XP + streak
    const user = await User.findById(userId);

    user.xp += xp;
    user.streak += 1;

    await user.save();

    res.status(201).json({
      msg: "Progress saved successfully",
      progress,
      xp: user.xp,
      streak: user.streak,
    });
  } catch (error) {
    res.status(500).json({
      msg: "Error saving progress",
      error: error.message,
    });
  }
};


// ==============================
// 📥 GET ALL USER PROGRESS
// ==============================
export const getUserProgress = async (req, res) => {
  try {
    const userId = req.user.id;

    const progress = await Progress.find({ user: userId }).sort({
      createdAt: -1,
    });

    if (progress.length === 0) {
      return res.status(404).json({ msg: "No progress found" });
    }

    res.json(progress);
  } catch (error) {
    res.status(500).json({
      msg: "Error fetching progress",
      error: error.message,
    });
  }
};


// ==============================
// 📊 GET PROGRESS BY SUBJECT
// ==============================
export const getProgressBySubject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject } = req.params;

    const progress = await Progress.find({
      user: userId,
      subject,
    });

    if (progress.length === 0) {
      return res.status(404).json({
        msg: `No progress found for ${subject}`,
      });
    }

    res.json(progress);
  } catch (error) {
    res.status(500).json({
      msg: "Error fetching subject progress",
      error: error.message,
    });
  }
};


// ==============================
// ❌ DELETE PROGRESS (optional)
// ==============================
export const deleteProgress = async (req, res) => {
  try {
    const progress = await Progress.findByIdAndDelete(req.params.id);

    if (!progress) {
      return res.status(404).json({ msg: "Progress not found" });
    }

    res.json({ msg: "Progress deleted successfully" });
  } catch (error) {
    res.status(500).json({
      msg: "Error deleting progress",
      error: error.message,
    });
  }
};