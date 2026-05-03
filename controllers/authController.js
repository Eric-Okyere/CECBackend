import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendVerificationEmail } from "../services/emailService.js";
import User from "../model/User.js";



const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);



// export const googleLogin = async (req, res) => {
//   const { token } = req.body;

//   try {
//     const ticket = await client.verifyIdToken({
//       idToken: token,
//       audience: process.env.GOOGLE_CLIENT_ID,
//     });

//     const { name, family_name, email, sub, picture } = ticket.getPayload();

//     let user = await User.findOne({ email });

//     if (!user) {
//       // Create new user with Google Picture
//       user = await User.create({
//         name: name || "Google User",
//         surname: family_name || "",
//         email,
//         googleId: sub,
//         picture: picture, // 👈 SAVING THE URL HERE
//         isVerified: true, 
//         password: await bcrypt.hash(Math.random().toString(36), 10), 
//       });
//     } else {
//       // 👈 UPDATE PICTURE FOR EXISTING USER
//       // This ensures if they change their Google photo, it updates in your app too
//       user.picture = picture;
//       user.googleId = sub; // Ensure googleId is linked if it wasn't before
//       await user.save();
//     }

//     const appToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

//     // Send the full user object back so the frontend can save the picture to localStorage
//     res.status(200).json({ token: appToken, user });
//   } catch (error) {
//     console.error("Google Auth Error:", error);
//     res.status(400).json({ msg: "Google authentication failed" });
//   }
// };


// authController.js

export const googleLogin = async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { name, family_name, email, sub, picture } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user with Google Picture
      user = await User.create({
        name: name || "Google User",
        surname: family_name || "",
        email,
        googleId: sub,
        picture: picture,
        isVerified: true, 
        role: "learner", // 👈 EXPLICITLY SETTING VALID ENUM ROLE
        password: await bcrypt.hash(Math.random().toString(36), 10), 
      });
    } else {
      // UPDATE PICTURE FOR EXISTING USER
      user.picture = picture;
      user.googleId = sub; 
      await user.save();
    }

    const appToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({ token: appToken, user });
  } catch (error) {
    console.error("Google Auth Error:", error);
    // Checking if the error is specifically a Validation Error to give better feedback
    if (error.name === 'ValidationError') {
      return res.status(400).json({ msg: "Database validation failed. Check role settings." });
    }
    res.status(400).json({ msg: "Google authentication failed" });
  }
};





export const addChild = async (req, res) => {
  try {
    const { parentId, firstName, lastName, age, level } = req.body;

    // 1. Double check the parent exists
    const parent = await User.findById(parentId);
    if (!parent) return res.status(404).json({ msg: "Parent not found" });

    const newChild = await User.create({
      name: firstName,
      surname: lastName,
      email: undefined,      // 👈 Forces Mongoose to treat this as non-existent for the sparse index
      role: "child",
      parentId: parentId,
      isVerified: true,
      password: await bcrypt.hash(Math.random().toString(36), 10), 
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
    if (error.code === 11000) {
      return res.status(400).json({ 
        msg: "Index Conflict. Please ask Admin to drop the 'email_1' index in MongoDB." 
      });
    }
    res.status(500).json({ msg: "Error creating child profile" });
  }
};


// export const register = async (req, res) => {
//   try {
//     const { name, surname, email, password } = req.body;
    
//     // Check if user already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) return res.status(400).json({ msg: "Email already registered." });

//     const vCode = Math.floor(100000 + Math.random() * 900000).toString();
//     const hashed = await bcrypt.hash(password.toString(), 10);

//     const user = await User.create({ 
//       name, 
//       surname, 
//       email, 
//       password: hashed,
//       verificationCode: vCode,
//       verificationExpires: Date.now() + 10 * 60 * 1000
//     });

//     // Try sending email
//     try {
//       await sendVerificationEmail(email, vCode);
//       res.status(201).json({ msg: "Verification code sent to email." });
//     } catch (mailError) {
//       console.error("Mail Auth Error:", mailError.message);
//       res.status(500).json({ msg: "Account created, but failed to send email. Check SMTP credentials." });
//     }

//   } catch (error) {
//     res.status(500).json({ msg: error.message });
//   }
// };

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
      role: "learner", // 👈 ADD THIS EXPLICITLY
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

    // Check if code matches and is not expired
    if (user.verificationCode !== code) {
      return res.status(400).json({ msg: "Invalid verification code" });
    }

    if (user.verificationExpires < Date.now()) {
      return res.status(400).json({ msg: "Code has expired. Please request a new one." });
    }

    // Mark as verified and clear the code fields
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({ msg: "Email verified successfully! you can now log in." });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};



// Get all children for a parent
export const getChild = async (req, res) => {
  try {
    // Populate parentId to get parent's email and parentDetails (phoneNumber)
    const children = await User.find({ parentId: req.params.parentId })
      .populate('parentId', 'email parentDetails'); 
      
    res.json(children);
  } catch (error) {
    res.status(500).json({ msg: "Server Error" });
  }
};






// export const register = async (req, res) => {
//   try {
//     const { name, surname, email, password } = req.body;
//     const hashed = await bcrypt.hash(password.toString(), 10);
//     const user = await User.create({ name, surname, email, password: hashed });
//     res.status(201).json(user);
//   } catch (error) {
//     res.status(500).json({ msg: error.message });
//   }
// };

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


// --- UNLOCK LESSON CONTROLLER ---
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
      { returnDocument: 'after' } // Updated to fix deprecation warning
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



// Add this to your auth routes
export const getAllUsers = async (req, res) => {
  try {
    // Fetches all users, sorting by most recent, and excluding passwords
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ msg: "Server error while fetching users." });
  }
};

// --- GET SINGLE USER BY ID ---
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

// export const updateProfile = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { level, role, childFirstName, childLastName, childAge, relationship, parentPhone, name, surname } = req.body;

//     const updatedUser = await User.findByIdAndUpdate(
//       id,
//       {
//         $set: {
//           role,
//           "studentProfile.level": level,
//           "studentProfile.firstName": childFirstName,
//           "studentProfile.lastName": childLastName,
//           "studentProfile.age": childAge,
//           "parentDetails.relationship": relationship,
//           "parentDetails.phoneNumber": parentPhone,
//           "parentDetails.name": name,
//           "parentDetails.surname": surname
//         },
//       },
//       { new: true }
//     ).select("-password");

//     res.json(updatedUser);
//   } catch (error) {
//     res.status(500).json({ msg: error.message });
//   }
// };



export const updateProfile = async (req, res) => {
  const { id } = req.params;

  const {
    role,
    level,
    childAge,
    parentPhone,
    relationship,
    childFirstName,
    childLastName,
    acceptedTerms,
    acceptedTermsAt
  } = req.body;

  try {
    let user = await User.findById(id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (!acceptedTerms) {
      return res.status(400).json({
        msg: "You must accept the Terms and Privacy Policy."
      });
    }

    if (role === "learner") {
      user.role = "learner";
      user.acceptedTerms = acceptedTerms;
      user.acceptedTermsAt = acceptedTermsAt || new Date();

      user.learningProfile = {
        level,
        age: childAge,
        xp: 0,
        isPaid: false
      };

      user.parentDetails.phoneNumber = parentPhone;

      await user.save();
      return res.status(200).json(user);
    }

    if (role === "parent") {
      user.role = "parent";
      user.acceptedTerms = acceptedTerms;
      user.acceptedTermsAt = acceptedTermsAt || new Date();

      user.parentDetails = {
        phoneNumber: parentPhone,
        relationship: relationship
      };

      await user.save();

      const newChild = await User.create({
        name: childFirstName,
        surname: childLastName,
        email: undefined,
        role: "child",
        parentId: user._id,
        password: Math.random().toString(36).slice(-10),
        learningProfile: {
          level,
          age: childAge,
          xp: 0,
          isPaid: false
        }
      });

      return res.status(200).json({ user, child: newChild });
    }

  } catch (error) {
    console.error("Update Profile Error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        msg: "Index conflict: Please drop the email_1 index in your database."
      });
    }

    res.status(500).json({
      msg: "Update failed",
      error: error.message
    });
  }
};


export const getChildrenByParent = async (req, res) => {
  try {
    const children = await User.find({ parentId: req.params.parentId, role: "child" });
    res.status(200).json(children);
  } catch (error) {
    res.status(500).json({ msg: "Error fetching children" });
  }
};



export const updateUser = async (req, res) => {
  try {
    const { 
      name, 
      surname, 
      firstName, // Received from frontend mapping
      lastName,  // Received from frontend mapping
      level, 
      age, 
      phoneNumber, 
      role 
    } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          name,
          surname,
          role,
          "studentProfile.firstName": firstName,
          "studentProfile.lastName": lastName,
          "studentProfile.level": level,
          "studentProfile.age": age,
          "parentDetails.phoneNumber": phoneNumber
        }
      },
      { new: true } // Return updated object
    ).select("-password");

    if (!updatedUser) return res.status(404).json({ msg: "User not found" });

    res.json(updatedUser);
  } catch (error) {
    console.error("Backend Update Error:", error);
    res.status(500).json({ msg: "Failed to update user info." });
  }
};


// --- DELETE USER BY ID ---
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Delete the user
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