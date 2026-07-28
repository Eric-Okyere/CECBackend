// models/Feedback.js
import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    type: { type: String, enum: ['bug', 'feature', 'general'], default: 'bug', required: true },
    message: { type: String, required: [true, 'Feedback message is required'], trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    pageUrl: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    screenResolution: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'in-review', 'resolved'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model('Feedback', feedbackSchema);