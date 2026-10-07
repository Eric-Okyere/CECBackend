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

    // Email verification. These fields were previously missing from the schema, so
    // Mongoose silently discarded the codes and verification could never succeed.
    // The code is stored as a SHA-256 hash, never in plain text.
    verificationCode: { type: String, select: false },
    verificationExpires: { type: Date, select: false },
    verificationAttempts: { type: Number, default: 0, select: false },
    verificationSentAt: { type: Date, select: false },

    // Password reset (code stored as a SHA-256 hash).
    resetCode: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    resetAttempts: { type: Number, default: 0, select: false },
    resetSentAt: { type: Date, select: false },

    // Tokens issued before this moment are rejected (set when the password changes).
    passwordChangedAt: { type: Date, select: false },
  },
  { timestamps: true }
);

// Never send secrets to the browser, no matter which controller returns the user.
const SECRET_FIELDS = [
  "password",
  "verificationCode",
  "verificationExpires",
  "verificationAttempts",
  "verificationSentAt",
  "resetCode",
  "resetExpires",
  "resetAttempts",
  "resetSentAt",
  "passwordChangedAt",
];
const stripSecrets = (doc, ret) => {
  SECRET_FIELDS.forEach((f) => delete ret[f]);
  return ret;
};
userSchema.set("toJSON", { transform: stripSecrets });
userSchema.set("toObject", { transform: stripSecrets });

export default mongoose.model("User", userSchema);