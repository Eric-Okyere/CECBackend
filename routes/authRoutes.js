import express from "express";
import { register, login, updateProfile, getAllUsers, updateUser,
    getUserById,
    googleLogin,
    deleteUser
 } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/users", getAllUsers); 
router.get("/user/:id", getUserById);
router.put("/update-profile/:id", updateProfile);
router.post("/google-login", googleLogin);
router.put("/update-user/:id", updateUser);
router.delete("/user/:id", deleteUser);
export default router;