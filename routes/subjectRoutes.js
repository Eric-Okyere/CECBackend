import express from "express";
import { 
  createSubject, 
  getSubjects, 
  addStrandToSubject, 
  updateSubject,
  getSubjectById
} from "../controllers/subjectController.js";

const router = express.Router();

// Step 1: Initialize the Subject
router.post("/", createSubject);
router.get("/", getSubjects); 
router.get("/:id", getSubjectById); 

// Step 2: Add CCP Content (Strands/Sub-strands)
router.patch("/:id/strands", addStrandToSubject);
router.patch("/:id/update", updateSubject);

export default router;