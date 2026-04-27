import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Identity
    name: { type: String, required: true }, // For Parent or Independent Learner
    surname: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, default: undefined },
    googleId: { type: String, unique: true, sparse: true, default: undefined },
    password: { type: String, required: true },
    picture: { type: String, default: "" },
    admin: { type: Boolean, default: false },
    
    // Roles: 'learner' (solo), 'parent' (manager), 'child' (managed)
    role: { 
      type: String, 
      enum: ["learner", "parent", "child"], 
      default: "learner" 
    },

    // Relationship Logic
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Learning Data (Used by Learners and Children)
    learningProfile: {
      level: { type: String, default: "" },
      age: { type: Number },
      xp: { type: Number, default: 0 },
      streak: { type: Number, default: 0 },
      isPaid: { type: Boolean, default: false }, // Pay later logic
    },
    acceptedTerms: {
  type: Boolean,
  default: false
},acceptedTermsAt: {
  type: Date,
},

    // Metadata for Parents
    parentDetails: {
      phoneNumber: { type: String, default: "" },
      relationship: { type: String, default: "" }, 
    },
    
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
  
);

export default mongoose.model("User", userSchema);