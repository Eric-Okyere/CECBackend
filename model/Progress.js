import mongoose from "mongoose";

const progressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  subject: String,
  level: String,
  strand: String,
  subStrand: String,
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