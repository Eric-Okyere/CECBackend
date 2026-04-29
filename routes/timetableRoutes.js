import express from "express";
import { saveSchedule, getMyTimetable } from "../controllers/timetableController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getMyTimetable);
router.post("/", authMiddleware, saveSchedule);

export default router;