import User from "../model/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
  try {
    const { name, surname, email, password } = req.body;
    const hashed = await bcrypt.hash(password.toString(), 10);
    const user = await User.create({ name, surname, email, password: hashed });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ msg: error.message });
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