import express from "express";
import { register, login, updateProfile, getAllUsers, updateUser } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/users", getAllUsers); // New route to fetch all users
router.put("/update-profile/:id", updateProfile);
router.put("/update-user/:id", updateUser);
export default router;