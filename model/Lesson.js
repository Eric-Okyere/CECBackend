import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
  {
    subject: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Subject"
      // Removed required constraint for backward compatibility
    },
    level: { type: String, trim: true },
    strand: { type: String, trim: true },
    
    // Allows both old string values AND new ObjectIds without throwing CastError
    subStrand: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "SubStrand", 
      required: [true, "Sub-strand is required"] 
    },

    lessonNumber: { 
      type: Number, 
      required: [true, "Lesson number is required"],
      min: [1, "Lesson number must be at least 1"] 
    },
    lessonName: { 
      type: String, 
      required: [true, "Lesson name is required"],
      trim: true 
    },

    videos: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
        title: { type: String, trim: true, default: "Untitled Video" }
      }
    ],

    quiz: [
      {
        question: { type: String, required: true, trim: true },
        options: [{ type: String, trim: true }],
        answer: { type: String, required: true, trim: true },
        explanation: { type: String, trim: true }
      }
    ]
  }, 
  { timestamps: true }
);

export default mongoose.model("Lesson", lessonSchema);