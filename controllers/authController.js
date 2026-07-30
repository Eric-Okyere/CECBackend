import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendVerificationEmail } from "../services/emailService.js";
import User from "../model/User.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { name, family_name, email, sub, picture } = ticket.getPayload();

    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      isNewUser = true; // 👈 Mark as a newly registered user
      user = await User.create({
        name: name || "Google User",
        surname: family_name || "",
        email,
        googleId: sub,
        picture: picture,
        isVerified: true,
        role: "learner",
        password: await bcrypt.hash(Math.random().toString(36), 10),
      });
    } else {
      // Existing user: update picture & googleId without triggering full doc validation
      user = await User.findByIdAndUpdate(
        user._id,
        { $set: { picture, googleId: sub } },
        { new: true, runValidators: false }
      );
    }

    const appToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    // Send back isNewUser
    res.status(200).json({ token: appToken, user, isNewUser });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(400).json({ msg: "Google authentication failed" });
  }
};

// In authController.js -> addChild
// In authController.js -> addChild
export const addChild = async (req, res) => {
  try {
    // 1. Extract values from request body (including gender & disabilityProfile)
    const { 
      parentId: bodyParentId, 
      firstName, 
      lastName, 
      age, 
      level, 
      gender, 
      disabilityProfile 
    } = req.body;

    // 2. Prioritize logged-in user from auth middleware, fallback to body
    const parentId = req.user?._id || bodyParentId;

    if (!parentId) {
      return res.status(400).json({ msg: "Parent ID is required to link child." });
    }

    // 3. Verify parent exists
    const parent = await User.findById(parentId);
    if (!parent) {
      return res.status(404).json({ msg: "Parent account not found." });
    }

    // 4. Ensure parent role is set to "parent"
    if (parent.role !== "parent") {
      parent.role = "parent";
      await parent.save();
    }

    // 5. Create Child with gender and disabilityProfile attached
    const newChild = await User.create({
      name: firstName,
      surname: lastName,
      gender: gender || "", // 👈 Store gender ("Male", "Female", or "")
      role: "child",
      parentId: parent._id, // 👈 Explicitly attach parent's MongoDB ID
      isVerified: true,
      password: await bcrypt.hash(Math.random().toString(36), 10),
      disabilityProfile: disabilityProfile || { // 👈 Pass disability profile
        hasDisability: false,
        type: "None",
        details: "",
        accommodationsNeeded: ""
      },
      learningProfile: {
        age: Number(age),
        level,
        xp: 0,
        isPaid: false
      }
    });

    res.status(201).json(newChild);
  } catch (error) {
    console.error("Add Child Error:", error);
    res.status(500).json({ msg: "Failed to create child profile", error: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const { name, surname, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "Email already registered." });

    const vCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = await bcrypt.hash(password.toString(), 10);

    const user = await User.create({ 
      name, 
      surname, 
      email, 
      password: hashed,
      role: "learner",
      verificationCode: vCode,
      verificationExpires: Date.now() + 10 * 60 * 1000
    });

    try {
      await sendVerificationEmail(email, vCode);
      res.status(201).json({ msg: "Verification code sent to email." });
    } catch (mailError) {
      res.status(500).json({ msg: "Account created, but email failed." });
    }
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.isVerified) return res.status(400).json({ msg: "Account already verified" });

    if (user.verificationCode !== code) {
      return res.status(400).json({ msg: "Invalid verification code" });
    }

    if (user.verificationExpires < Date.now()) {
      return res.status(400).json({ msg: "Code has expired. Please request a new one." });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({ msg: "Email verified successfully! you can now log in." });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getChild = async (req, res) => {
  try {
    const children = await User.find({ parentId: req.params.parentId })
      .populate('parentId', 'email parentDetails'); 
      
    res.json(children);
  } catch (error) {
    res.status(500).json({ msg: "Server Error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Wrong email or password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const unlockLesson = async (req, res) => {
  try {
    const { userId, lessonData } = req.body;

    if (!userId || !lessonData) {
      return res.status(400).json({ msg: "Missing User ID or Lesson Data" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $addToSet: { 
          unlockedLessons: {
            subject: lessonData.subject,
            level: lessonData.level,
            subStrand: lessonData.subStrand,
            unlockedAt: new Date()
          } 
        }
      },
      { returnDocument: 'after' }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.status(200).json({ 
      msg: "Lesson unlocked successfully", 
      unlockedLessons: updatedUser.unlockedLessons 
    });
  } catch (error) {
    console.error("Unlock Lesson Error:", error);
    res.status(500).json({ msg: "Server Error" });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ msg: "Server error while fetching users." });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("parentId", "name surname email parentDetails")
      .select("-password");
      
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).send("Server Error");
  }
};

// In authController.js -> updateProfile:



export const updateProfile = async (req, res) => {
  try {
    const userId = req.params.id || req.params.userId;

    const {
      role,
      name,
      surname,
      acceptedTerms,
      acceptedTermsAt,
      learningProfile,
      parentDetails,
      disabilityProfile,
      gender,
    } = req.body;

    // 1. Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    // 2. Update basic/root fields if provided
    if (name) user.name = name;
    if (surname) user.surname = surname;
    if (role) user.role = role;
    if (acceptedTerms !== undefined) user.acceptedTerms = acceptedTerms;
    if (acceptedTermsAt) user.acceptedTermsAt = acceptedTermsAt;

    // Handle gender (support both root-level and inside learningProfile)
    if (gender) {
      user.gender = gender;
    } else if (learningProfile?.gender) {
      user.gender = learningProfile.gender;
    }

    // 3. Merge nested profiles safely (preserves existing fields inside sub-documents)
    if (learningProfile) {
      user.learningProfile = {
        ...user.learningProfile?.toObject?.() || user.learningProfile,
        ...learningProfile,
      };
    }

    if (parentDetails) {
      user.parentDetails = {
        ...user.parentDetails?.toObject?.() || user.parentDetails,
        ...parentDetails,
      };
    }

    if (disabilityProfile) {
      user.disabilityProfile = {
        ...user.disabilityProfile?.toObject?.() || user.disabilityProfile,
        ...disabilityProfile,
      };
    }

    // 4. Save and respond
    await user.save();

    // Convert to plain object and remove password before returning
    const updatedUserObj = user.toObject();
    delete updatedUserObj.password;

    return res.status(200).json({
      msg: "Profile updated successfully",
      user: updatedUserObj,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json({
      msg: "Server error updating profile",
      error: error.message,
    });
  }
};



export const getChildrenByParent = async (req, res) => {
  try {
    const { parentId } = req.params;

    // Build flexible query matching string or ObjectId
    const queryConditions = [{ parentId: parentId }];
    if (mongoose.Types.ObjectId.isValid(parentId)) {
      queryConditions.push({ parentId: new mongoose.Types.ObjectId(parentId) });
    }

    const children = await User.find({
      $or: queryConditions,
      role: "child"
    });

    res.status(200).json(children);
  } catch (error) {
    console.error("Get Children Error:", error);
    res.status(500).json({ msg: "Error fetching children" });
  }
};

// --- UPDATED USER CONTROLLER FOR ADMIN / USER MANAGEMENT ---
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      surname, 
      firstName, 
      lastName, 
      email,
      role,
      level, 
      age, 
      phoneNumber, 
      relationship,
      password,
      isVerified,
      hasDisability,
      disabilityDetails
    } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Update Basic Information
    if (name !== undefined) user.name = name || firstName;
    if (surname !== undefined) user.surname = surname || lastName;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (isVerified !== undefined) user.isVerified = isVerified;

    // Update Password if specified
    if (password && password.trim() !== "") {
      user.password = await bcrypt.hash(password.toString(), 10);
    }

    // Update Disability Profile
    if (hasDisability !== undefined) user.hasDisability = hasDisability;
    if (disabilityDetails !== undefined) user.disabilityDetails = disabilityDetails;

    // Update Learning Profile (level & age)
    if (!user.learningProfile) user.learningProfile = {};
    if (level !== undefined) user.learningProfile.level = level;
    if (age !== undefined) user.learningProfile.age = Number(age);

    // Update Parent Details
    if (!user.parentDetails) user.parentDetails = {};
    if (phoneNumber !== undefined) user.parentDetails.phoneNumber = phoneNumber;
    if (relationship !== undefined) user.parentDetails.relationship = relationship;

    await user.save();

    // Exclude password from the returned object
    const updatedUserObj = user.toObject();
    delete updatedUserObj.password;

    res.status(200).json(updatedUserObj);
  } catch (error) {
    console.error("Backend Update Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Email address already exists." });
    }
    res.status(500).json({ msg: "Failed to update user info.", error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({ msg: "User account deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ msg: "Invalid User ID format" });
    }
    res.status(500).json({ msg: "Server error while deleting user." });
  }
};