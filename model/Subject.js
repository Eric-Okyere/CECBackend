import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema({
  // --- IDENTITY ---
  name: { 
    type: String, 
    required: [true, "Subject name is required (e.g., Mathematics)"],
    trim: true 
  },
  level: { 
    type: String, 
    required: [true, "Level is required"], 
    enum: ["JHS 1", "JHS 2", "JHS 3"] 
  },

  // --- CONTENT (Nested Array) ---
  strands: [
    {
      title: { type: String, required: true },
      // Sub-strands are stored as an array of strings
      subStrands: [{ type: String, required: true }]
    }
  ]
}, { timestamps: true });

// --- CONSTRAINTS ---
// Prevents creating "Mathematics - JHS 1" twice.
subjectSchema.index({ name: 1, level: 1 }, { unique: true });

export default mongoose.model("Subject", subjectSchema);