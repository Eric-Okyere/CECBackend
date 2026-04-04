import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Parent / Account Owner (From Signup)
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    admin: { type: Boolean, default: false },
    role: { 
      type: String, 
      enum: ["student", "parent_managed"], 
      default: "student" 
    },

    // Student / Child Details
    studentProfile: {
      firstName: { type: String, default: "" }, // 👈 Added
      lastName: { type: String, default: "" },  // 👈 Added
      age: { type: Number },
      level: { type: String, default: "" }, 
    },

    // Parental Context
    parentDetails: {
      phoneNumber: { type: String, default: "" },
      relationship: { type: String, default: "" }, 
    },

    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);