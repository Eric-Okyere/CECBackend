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
  getLessonsForSingleSubstrand
} from "../controllers/subjectController.js";

const router = express.Router();

// -----------------------------------------------------------------------------
// Specialized Lesson Query Routes
// Base Path: /api/subjects
// -----------------------------------------------------------------------------

// GET /api/subjects/grouped
router.get("/grouped", getLessonsGroupedBySubstrand);

// GET /api/subjects/by-substrand
router.get("/by-substrand", getLessonsForSingleSubstrand);


// -----------------------------------------------------------------------------
// Core Subject Routes
// Base Path: /api/subjects
// -----------------------------------------------------------------------------

// POST /api/subjects        -> Create Subject
// GET  /api/subjects        -> Get All Subjects
router.route("/")
  .post(createSubject)
  .get(getSubjects);

// GET    /api/subjects/:id  -> Get Subject by ID
// PUT    /api/subjects/:id  -> Update Subject (Name, Level, Strands, SubStrands)
// DELETE /api/subjects/:id  -> Delete Subject
router.route("/:id")
  .get(getSubjectById)
  .put(updateSubject)
  .delete(deleteSubject);


// -----------------------------------------------------------------------------
// Standalone Strand Routes
// Base Path: /api/subjects
// -----------------------------------------------------------------------------

// POST /api/subjects/:id/strands -> Add a new Strand to Subject
router.route("/:id/strands")
  .post(addStrandToSubject);

// PATCH  /api/subjects/:id/strands/:strandId -> Update Strand Title
// DELETE /api/subjects/:id/strands/:strandId -> Delete Strand & SubStrands
router.route("/:id/strands/:strandId")
  .patch(updateStrand)
  .delete(deleteStrand);


// -----------------------------------------------------------------------------
// Standalone SubStrand Routes
// Base Path: /api/subjects
// -----------------------------------------------------------------------------

// PATCH /api/subjects/:id/strands/:strandId/sub-strands -> Add SubStrand
router.route("/:id/strands/:strandId/sub-strands")
  .patch(addSubStrandToStrand);

// PUT /api/subjects/sub-strands/:subStrandId -> Update SubStrand directly
router.route("/sub-strands/:subStrandId")
  .put(updateSubStrand);

export default router;