import express from "express";
import { register, login, updateProfile, getAllUsers, updateUser,
    getUserById,
    googleLogin,
    deleteUser, getChild,
    addChild,
    unlockLesson,
 } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/unlock-lesson", unlockLesson);
router.get("/users", getAllUsers); 
router.get("/user/:id", getUserById);
router.get("/children/:parentId", getChild); 
router.post("/add-child", addChild); 
router.put("/update-profile/:id", updateProfile);
router.post("/google-login", googleLogin);
router.put("/update-user/:id", updateUser);
router.delete("/user/:id", deleteUser);
export default router;