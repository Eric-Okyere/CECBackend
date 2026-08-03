import mongoose from "mongoose";

// --- SUB-DOCUMENT SCHEMAS ---
const strandSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, "Strand title is required"] 
  },
  // Reference the separate SubStrand model
  subStrands: [
    { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "SubStrand" 
    }
  ]
});

// --- MAIN SUBJECT SCHEMA ---
const subjectSchema = new mongoose.Schema(
  {
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

    // --- CONTENT STRUCTURAL TREE ---
    strands: [strandSchema]
  }, 
  { timestamps: true }
);

// --- CONSTRAINTS ---
// Prevents duplicate entries like "Mathematics - JHS 1"
subjectSchema.index({ name: 1, level: 1 }, { unique: true });

export default mongoose.model("Subject", subjectSchema);