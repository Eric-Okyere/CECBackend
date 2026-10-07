import express from "express";
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  googleLogin,
  updateProfile,
  getAllUsers,
  updateUser,
  AdminupdateUser,
  toggleAdminStatus,
  getUserById,
  deleteUser,
  getChild,
  addChild,
  unlockLesson,
} from "../controllers/authController.js";
import { protect, adminOnly, requireSelfParentOrAdmin } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// --- Public (rate limited) ---
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/google-login", authLimiter, googleLogin);
router.post("/verify-email", authLimiter, verifyEmail);
router.post("/resend-verification", authLimiter, resendVerification);

// --- Logged-in users (self, or a parent acting for their child) ---
router.get("/user/:id", protect, requireSelfParentOrAdmin("id"), getUserById);
router.put("/update-profile/:id", protect, requireSelfParentOrAdmin("id"), updateProfile);
router.get("/children/:parentId", protect, getChild);
router.post("/add-child", protect, addChild);
router.post("/unlock-lesson", protect, unlockLesson);

// --- Admin only ---
router.get("/users", protect, adminOnly, getAllUsers);
router.put("/update-user/:id", protect, adminOnly, updateUser);
router.put("/adminupdate-user/:id", protect, adminOnly, AdminupdateUser);
router.patch("/toggle-admin/:id", protect, adminOnly, toggleAdminStatus);
router.delete("/user/:id", protect, adminOnly, deleteUser);

export default router;
