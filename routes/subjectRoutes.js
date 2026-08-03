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
// Subject Routes (/api/subjects)
// -----------------------------------------------------------------------------


router.get("/grouped", getLessonsGroupedBySubstrand);
router.get("/by-substrand", getLessonsForSingleSubstrand);



router.route("/")
  .post(createSubject)
  .get(getSubjects);
  

router.route("/:id")
  .get(getSubjectById)
  .put(updateSubject)
  .delete(deleteSubject);

// -----------------------------------------------------------------------------
// Strand Routes (/api/subjects/:id/strands...)
// -----------------------------------------------------------------------------
router.post("/:id/strands", addStrandToSubject);

router.route("/:id/strands/:strandId")
  .patch(updateStrand)
  .delete(deleteStrand);

// -----------------------------------------------------------------------------
// Sub-Strand Routes
// -----------------------------------------------------------------------------
// Create sub-strand nested inside a specific strand
router.post("/:id/strands/:strandId/sub-strands", addSubStrandToStrand);

// Update individual sub-strand directly by its ID
router.put("/sub-strands/:subStrandId", updateSubStrand);

export default router;