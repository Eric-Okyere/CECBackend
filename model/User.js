import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Identity
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, default: undefined },
    googleId: { type: String, unique: true, sparse: true, default: undefined },
    password: { type: String, required: true },
    picture: { type: String, default: "" },

   gender: {
      type: String,
      enum: ["Male", "Female", ""],
      required: false, 
    },

    admin: { type: Boolean, default: false },
    
    role: { 
      type: String, 
      enum: ["learner", "parent", "child"], 
      default: "learner" 
    },

    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Special Educational Needs / Disability Profile
    disabilityProfile: {
      hasDisability: { type: Boolean, default: false },
      type: { 
        type: String, 
        enum: ["None", "Visual", "Hearing", "Learning/Cognitive", "Physical/Mobility", "Speech/Language", "Other"], 
        default: "None" 
      },
      details: { type: String, default: "" }, // e.g. Dyslexia, ADHD, Partial Hearing
      accommodationsNeeded: { type: String, default: "" } // e.g. Text-to-speech, extra time
    },

    // Learning Data
    learningProfile: {
      level: { type: String, default: "" },
      age: { type: Number },
      xp: { type: Number, default: 0 },
      streak: { type: Number, default: 0 },
      isPaid: { type: Boolean, default: false },
    },

    acceptedTerms: { type: Boolean, default: false },
    acceptedTermsAt: { type: Date },

    unlockedLessons: [{
      subject: String,
      level: String,
      subStrand: String,
      unlockedAt: { type: Date, default: Date.now }
    }],

    parentDetails: {
      phoneNumber: { type: String, default: "" },
      relationship: { type: String, default: "" }, 
    },
    
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);