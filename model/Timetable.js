import mongoose from "mongoose";

const timetableSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  day: {
    type: String,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    required: true
  },
  timeSlots: [{
    startTime: String, // e.g., "08:00 AM"
    endTime: String,   // e.g., "09:30 AM"
    subject: String,   // e.g., "Mathematics"
    task: String       // e.g., "Watch Part 1 Video & Take Quiz"
  }]
});

export default mongoose.model("Timetable", timetableSchema);