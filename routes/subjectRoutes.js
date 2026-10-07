import express from "express";
import {
  createSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  addStrandToSubject,
  updateStrand,
  deleteStrand,
  addSubStrandToStrand,
  updateSubStrand,
  getLessonsGroupedBySubstrand,
  getLessonsForSingleSubstrand,
} from "../controllers/subjectController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();
const admin = [protect, adminOnly];

// Public reads (must come before "/:id")
router.get("/grouped", getLessonsGroupedBySubstrand);
router.get("/by-substrand", getLessonsForSingleSubstrand);

router.route("/").get(getSubjects).post(...admin, createSubject);

// Admin writes for sub-strands (must come before "/:id")
router.put("/sub-strands/:subStrandId", ...admin, updateSubStrand);

router
  .route("/:id")
  .get(getSubjectById)
  .put(...admin, updateSubject)
  .delete(...admin, deleteSubject);

// The admin page sends PATCH; POST kept for compatibility.
router.route("/:id/strands").post(...admin, addStrandToSubject).patch(...admin, addStrandToSubject);
router
  .route("/:id/strands/:strandId")
  .patch(...admin, updateStrand)
  .delete(...admin, deleteStrand);
router.patch("/:id/strands/:strandId/sub-strands", ...admin, addSubStrandToStrand);

export default router;
