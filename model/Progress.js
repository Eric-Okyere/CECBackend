import mongoose from "mongoose";

const progressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lesson" // 👈 Add reference to Lesson schema
  },
  subject: String,
  level: String,
  strand: String,
  subStrand: String,
  lessonName: String, // Optional direct string backup
  score: Number,
  total: Number,
  xp: Number,
  completedAt: {
    type: Date,
    default: Date.now,
  },
  isCompleted: { type: Boolean, default: true }
});

export default mongoose.model("Progress", progressSchema);