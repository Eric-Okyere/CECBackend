import { OAuth2Client } from "google-auth-library";
import User from "../model/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendVerificationEmail } from "../services/emailService.js";



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

    if (!user) {
      // Create new user with Google Picture
      user = await User.create({
        name: name || "Google User",
        surname: family_name || "",
        email,
        googleId: sub,
        picture: picture, // 👈 SAVING THE URL HERE
        isVerified: true, 
        password: await bcrypt.hash(Math.random().toString(36), 10), 
      });
    } else {
      // 👈 UPDATE PICTURE FOR EXISTING USER
      // This ensures if they change their Google photo, it updates in your app too
      user.picture = picture;
      user.googleId = sub; // Ensure googleId is linked if it wasn't before
      await user.save();
    }

    const appToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    // Send the full user object back so the frontend can save the picture to localStorage
    res.status(200).json({ token: appToken, user });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(400).json({ msg: "Google authentication failed" });
  }
};



export const register = async (req, res) => {
  try {
    const { name, surname, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "Email already registered." });

    const vCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = await bcrypt.hash(password.toString(), 10);

    const user = await User.create({ 
      name, 
      surname, 
      email, 
      password: hashed,
      verificationCode: vCode,
      verificationExpires: Date.now() + 10 * 60 * 1000
    });

    // Try sending email
    try {
      await sendVerificationEmail(email, vCode);
      res.status(201).json({ msg: "Verification code sent to email." });
    } catch (mailError) {
      console.error("Mail Auth Error:", mailError.message);
      res.status(500).json({ msg: "Account created, but failed to send email. Check SMTP credentials." });
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
    const { id } = req.params; // Expects ID in the URL: /api/auth/user/:id

    // Find user, but remove the password from the response for security
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    // If the ID format is invalid (e.g., too short), Mongoose throws a CastError
    if (error.kind === "ObjectId") {
      return res.status(400).json({ msg: "Invalid User ID format" });
    }
    res.status(500).json({ msg: "Server error while fetching user profile." });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { level, role, childFirstName, childLastName, childAge, relationship, parentPhone, name, surname } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          role,
          "studentProfile.level": level,
          "studentProfile.firstName": childFirstName,
          "studentProfile.lastName": childLastName,
          "studentProfile.age": childAge,
          "parentDetails.relationship": relationship,
          "parentDetails.phoneNumber": parentPhone,
          "parentDetails.name": name,
          "parentDetails.surname": surname
        },
      },
      { new: true }
    ).select("-password");

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ msg: error.message });
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