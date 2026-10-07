import mongoose from "mongoose";

const progressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lesson",
  },
  subject: String,
  level: String,
  strand: String,
  subStrand: String,
  lessonNumber: Number, // was being sent by the frontend but silently dropped
  lessonName: String,
  score: Number,
  total: Number,
  xp: Number,
  completedAt: {
    type: Date,
    default: Date.now,
  },
  isCompleted: { type: Boolean, default: true },
});

progressSchema.index({ user: 1, lesson: 1 });

export default mongoose.model("Progress", progressSchema);
