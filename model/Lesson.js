import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  level: String,
  strand: String,
  subStrand: String,
  lessonNumber: { 
    type: Number, 
    required: true 
  },
  lessonName: { 
    type: String, 
    required: true,
    trim: true // Automatically removes leading/trailing whitespaces
  },
  videos: [
    {
      url: String,
      public_id: String,
      title: String,
    }
  ],
  quiz: [
    {
      question: { type: String, required: true },
      options: [String],
      answer: String,
      explanation: String,
    }
  ]
}, { timestamps: true });

export default mongoose.model("Lesson", lessonSchema);