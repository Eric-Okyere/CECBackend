// models/SubStrand.js
import mongoose from "mongoose";

const subStrandSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    code: { type: String }, // e.g., "B7.2.1"
    strand: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Subject" 
    },
    // Array of references to Lesson documents
    lessons: [
      { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Lesson" 
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("SubStrand", subStrandSchema);