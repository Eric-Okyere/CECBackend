import mongoose from "mongoose";
import Subject from "../model/Subject.js";
import SubStrand from "../model/SubStrand.js";
// controllers/lessonController.js
import Lesson from "../model/Lesson.js";
import { exactInsensitive } from "../utils/escapeRegex.js";

// Lesson.subject is an ObjectId, so a subject *name* from the URL is resolved to ids
// first (a raw regex against an ObjectId field throws a CastError).
const subjectIdsByName = async (name) =>
  mongoose.Types.ObjectId.isValid(name)
    ? [name]
    : (await Subject.find({ name: exactInsensitive(name) }).select("_id").lean()).map((s) => s._id);

// Helper for standard Subject population across endpoints
const populateSubjectStrands = (query) => {
  return query.populate({
    path: "strands.subStrands",
    select: "title code lessons",
  });
};

/**
 * @desc    Create a Subject (Handles nested inline sub-strands creation)
 * @route   POST /api/subjects
 */
export const createSubject = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, level, strands } = req.body;

    if (!name?.trim() || !level?.trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, msg: "Name and Level are required." });
    }

    const trimmedName = name.trim();
    const trimmedLevel = level.trim();

    const existingSubject = await Subject.findOne({ name: trimmedName, level: trimmedLevel }).session(session);
    if (existingSubject) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        msg: "This subject already exists for this level.",
      });
    }

    // Process nested strands & create SubStrand documents if objects were passed
    const processedStrands = [];

    if (Array.isArray(strands)) {
      for (const strand of strands) {
        const subStrandIds = [];

        if (Array.isArray(strand.subStrands) && strand.subStrands.length > 0) {
          for (const subItem of strand.subStrands) {
            // If it's already an ID, keep it. If it's an object, create the SubStrand doc.
            if (typeof subItem === "object" && subItem !== null && subItem.title) {
              const [createdSubStrand] = await SubStrand.create(
                [
                  {
                    title: subItem.title.trim(),
                    code: subItem.code ? subItem.code.trim() : "",
                    lessons: subItem.lessons || [],
                  },
                ],
                { session }
              );
              subStrandIds.push(createdSubStrand._id);
            } else {
              subStrandIds.push(subItem);
            }
          }
        }

        processedStrands.push({
          title: strand.title ? strand.title.trim() : "",
          subStrands: subStrandIds,
        });
      }
    }

    const [subject] = await Subject.create(
      [
        {
          name: trimmedName,
          level: trimmedLevel,
          strands: processedStrands,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Populate for response consistency
    const populatedSubject = await populateSubjectStrands(Subject.findById(subject._id));

    return res.status(201).json({ success: true, data: populatedSubject });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, msg: error.message });
  }
};







export const getLessonsGroupedBySubstrand = async (req, res) => {
  try {
    const { subject, level } = req.query;

    const query = {};
    if (subject) {
      query.subject = { $in: await subjectIdsByName(subject) };
    }
    if (level) {
      query.level = exactInsensitive(level);
    }

    // 1. Fetch lessons and populate SubStrand
    const lessons = await Lesson.find(query)
      .populate({
        path: "subStrand",
        select: "title code"
      })
      .sort({ lessonNumber: 1 });

    // 2. Fetch Subjects to build lookup maps for both Strands and SubStrands
    const subjectQuery = {};
    if (subject) {
      subjectQuery.name = exactInsensitive(subject);
    }
    const subjects = await Subject.find(subjectQuery);

    const strandMap = {};    // Strand _id -> Strand Title
    const subStrandMap = {}; // SubStrand _id -> Strand Title (fallback)

    subjects.forEach((subj) => {
      if (Array.isArray(subj.strands)) {
        subj.strands.forEach((strand) => {
          const strandId = strand._id ? strand._id.toString() : String(strand);
          strandMap[strandId] = strand.title;

          if (Array.isArray(strand.subStrands)) {
            strand.subStrands.forEach((subId) => {
              subStrandMap[subId.toString()] = strand.title;
            });
          }
        });
      }
    });

    // 3. Group lessons and resolve human-readable Strand names
    const grouped = lessons.reduce((acc, lesson) => {
      let subStrandName = "Uncategorized";
      let strandName = "Uncategorized";

      // Resolve SubStrand Title
      if (lesson.subStrand && typeof lesson.subStrand === "object") {
        subStrandName = lesson.subStrand.title || "Uncategorized";
      }

      // Resolve Strand Title: check lesson.strand first, then fallback to subStrand map
      if (lesson.strand) {
        const rawStrandId = lesson.strand.toString();
        strandName = strandMap[rawStrandId] || rawStrandId;
      } else if (lesson.subStrand?._id) {
        strandName = subStrandMap[lesson.subStrand._id.toString()] || "Uncategorized";
      }

      if (!acc[subStrandName]) {
        acc[subStrandName] = [];
      }

      acc[subStrandName].push({
        _id: lesson._id,
        lessonNumber: lesson.lessonNumber,
        lessonName: lesson.lessonName,
        strandName: strandName,       // Displays: "Diversity of Matter" instead of "6a6f99e3..."
        subStrandName: subStrandName, // Displays: "Materials"
        videosCount: lesson.videos?.length || 0,
        quizCount: lesson.quiz?.length || 0
      });

      return acc;
    }, {});

    res.status(200).json({
      success: true,
      totalSubStrands: Object.keys(grouped).length,
      data: grouped
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch lessons by sub-strand",
      error: error.message
    });
  }
};







export const getLessonsForSingleSubstrand = async (req, res) => {
  try {
    const { subStrandName, subject, level } = req.query;

    if (!subStrandName) {
      return res.status(400).json({
        success: false,
        message: "subStrandName query parameter is required."
      });
    }

    const query = {};

    if (subject) {
      query.subject = { $in: await subjectIdsByName(subject) };
    }
    if (level) {
      query.level = exactInsensitive(level);
    }

    // Lesson.subStrand is an ObjectId: accept an id, or resolve a title to ids.
    const subStrandIds = mongoose.Types.ObjectId.isValid(subStrandName)
      ? [subStrandName]
      : (await SubStrand.find({ title: exactInsensitive(subStrandName) }).select("_id").lean()).map((d) => d._id);
    query.subStrand = { $in: subStrandIds };

    const lessons = await Lesson.find(query)
      .select("lessonNumber lessonName videos quiz level subject subStrand")
      .sort({ lessonNumber: 1 });

    res.status(200).json({
      success: true,
      subStrand: subStrandName,
      count: lessons.length,
      lessons: lessons.map((l) => ({
        _id: l._id,
        lessonNumber: l.lessonNumber,
        lessonName: l.lessonName
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch sub-strand lessons",
      error: error.message
    });
  }
};






/**
 * @desc    Get all subjects (with populated subStrands)
 * @route   GET /api/subjects
 */
export const getSubjects = async (req, res) => {
  try {
    const subjects = await populateSubjectStrands(
      Subject.find().sort({ level: 1, name: 1 })
    );

    return res.status(200).json({ success: true, data: subjects });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};

/**
 * @desc    Get a single Subject by ID
 * @route   GET /api/subjects/:id
 */
export const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await populateSubjectStrands(Subject.findById(id));

    if (!subject) {
      return res.status(404).json({ success: false, msg: "Subject not found" });
    }

    return res.status(200).json({ success: true, data: subject });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ success: false, msg: "Invalid Subject ID format" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// controllers/lessonController.js
export const getLessonsBySubStrand = async (req, res) => {
  try {
    const { subject, level, subStrand } = req.query;

    const query = {};
    if (subject) query.subject = { $in: await subjectIdsByName(subject) };
    if (level) query.level = exactInsensitive(level);
    if (subStrand) {
      query.subStrand = mongoose.Types.ObjectId.isValid(subStrand)
        ? subStrand
        : { $in: (await SubStrand.find({ title: exactInsensitive(subStrand) }).select("_id").lean()).map((d) => d._id) };
    }

    const lessons = await Lesson.find(query).sort({ lessonNumber: 1 });

    res.status(200).json({ success: true, count: lessons.length, data: lessons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update Subject Identity (Name, Level, Strands, and Sub-strands)
 * @route   PUT /api/subjects/:id
 */
export const updateSubject = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { name, level, strands } = req.body;

    const currentSubject = await Subject.findById(id).session(session);
    if (!currentSubject) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, msg: "Subject not found" });
    }

    const newName = name?.trim() ?? currentSubject.name;
    const newLevel = level?.trim() ?? currentSubject.level;

    const existing = await Subject.findOne({
      name: newName,
      level: newLevel,
      _id: { $ne: id },
    }).session(session);

    if (existing) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        msg: "Another subject already exists with this name and level.",
      });
    }

    currentSubject.name = newName;
    currentSubject.level = newLevel;

    // Process nested strands and sub-strands
    if (Array.isArray(strands)) {
      const processedStrands = [];

      for (const strand of strands) {
        const subStrandIds = [];

        if (Array.isArray(strand.subStrands)) {
          for (const ss of strand.subStrands) {
            // Case A: Existing SubStrand Document (24-character ObjectId)
            if (typeof ss === 'object' && ss !== null && ss._id && ss._id.length === 24) {
              await SubStrand.findByIdAndUpdate(
                ss._id,
                { 
                  ...(ss.title && { title: ss.title.trim() }),
                  ...(ss.code !== undefined && { code: ss.code.trim() })
                },
                { session }
              );
              subStrandIds.push(ss._id);
            } 
            // Case B: New SubStrand Object (Create new MongoDB doc)
            else if (typeof ss === 'object' && ss !== null && ss.title) {
              const [createdSubStrand] = await SubStrand.create(
                [
                  {
                    title: ss.title.trim(),
                    code: ss.code ? ss.code.trim() : "",
                  },
                ],
                { session }
              );
              subStrandIds.push(createdSubStrand._id);
            } 
            // Case C: SubStrand already passed as String ID
            else if (typeof ss === 'string') {
              subStrandIds.push(ss);
            }
          }
        }

        processedStrands.push({
          ...(strand._id && strand._id.length === 24 ? { _id: strand._id } : {}),
          title: strand.title ? strand.title.trim() : "",
          subStrands: subStrandIds,
        });
      }

      currentSubject.strands = processedStrands;
    }

    await currentSubject.save({ session });

    await session.commitTransaction();
    session.endSession();

    const populatedSubject = await populateSubjectStrands(Subject.findById(id));

    return res.status(200).json({ success: true, data: populatedSubject });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.kind === "ObjectId") {
      return res.status(400).json({ success: false, msg: "Invalid Subject ID format" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};

/**
 * @desc    Add a new Strand to a Subject
 * @route   PATCH /api/subjects/:id/strands
 */
export const addStrandToSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, msg: "Strand title is required" });
    }

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ success: false, msg: "Subject not found" });
    }

    const strandExists = subject.strands.some(
      (s) => s.title.toLowerCase() === title.trim().toLowerCase()
    );

    if (strandExists) {
      return res.status(400).json({ success: false, msg: "Strand with this title already exists" });
    }

    subject.strands.push({
      title: title.trim(),
      subStrands: [],
    });

    await subject.save();
    const updatedSubject = await populateSubjectStrands(Subject.findById(id));

    return res.status(200).json({
      success: true,
      msg: "Strand added successfully",
      data: updatedSubject,
    });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};

/**
 * @desc    Update a Strand's Title
 * @route   PATCH /api/subjects/:id/strands/:strandId
 */
export const updateStrand = async (req, res) => {
  try {
    const { id, strandId } = req.params;
    const { title } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, msg: "Strand title is required" });
    }

    const updatedSubject = await populateSubjectStrands(
      Subject.findOneAndUpdate(
        { _id: id, "strands._id": strandId },
        { $set: { "strands.$.title": title.trim() } },
        { new: true }
      )
    );

    if (!updatedSubject) {
      return res.status(404).json({ success: false, msg: "Subject or Strand not found" });
    }

    return res.status(200).json({ success: true, data: updatedSubject });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};

/**
 * @desc    Create a new SubStrand and append to Strand
 * @route   PATCH /api/subjects/:id/strands/:strandId/sub-strands
 */
export const addSubStrandToStrand = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, strandId } = req.params;
    const { title, code } = req.body;

    if (!title?.trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, msg: "Sub-strand title is required" });
    }

    const subjectExists = await Subject.exists({ _id: id, "strands._id": strandId }).session(session);
    if (!subjectExists) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, msg: "Subject or Strand not found" });
    }

    const [newSubStrand] = await SubStrand.create(
      [
        {
          title: title.trim(),
          code: code ? code.trim() : "",
          strand: strandId,
        },
      ],
      { session }
    );

    const updatedSubject = await populateSubjectStrands(
      Subject.findOneAndUpdate(
        { _id: id, "strands._id": strandId },
        { $addToSet: { "strands.$.subStrands": newSubStrand._id } },
        { new: true, session }
      )
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, data: updatedSubject });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, msg: error.message });
  }
};

/**
 * @desc    Update a SubStrand Document
 * @route   PUT /api/sub-strands/:subStrandId
 */
export const updateSubStrand = async (req, res) => {
  try {
    const { subStrandId } = req.params;
    const { title, code, lessons } = req.body;

    const updatedSubStrand = await SubStrand.findByIdAndUpdate(
      subStrandId,
      {
        ...(title && { title: title.trim() }),
        ...(code !== undefined && { code: code.trim() }),
        ...(lessons && { lessons }),
      },
      { new: true, runValidators: true }
    );

    if (!updatedSubStrand) {
      return res.status(404).json({ success: false, msg: "Sub-strand not found" });
    }

    return res.status(200).json({ success: true, data: updatedSubStrand });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};

/**
 * @desc    Delete a Strand (and clean up associated SubStrands via Transaction)
 * @route   DELETE /api/subjects/:id/strands/:strandId
 */
export const deleteStrand = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, strandId } = req.params;

    const subject = await Subject.findById(id).session(session);
    if (!subject) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, msg: "Subject not found" });
    }

    const targetStrand = subject.strands.id(strandId);
    if (targetStrand && targetStrand.subStrands.length > 0) {
      await SubStrand.deleteMany({ _id: { $in: targetStrand.subStrands } }).session(session);
    }

    const updatedSubject = await populateSubjectStrands(
      Subject.findByIdAndUpdate(
        id,
        { $pull: { strands: { _id: strandId } } },
        { new: true, session }
      )
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, msg: "Strand deleted", data: updatedSubject });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, msg: error.message });
  }
};

/**
 * @desc    Delete Subject and all child SubStrands via Transaction
 * @route   DELETE /api/subjects/:id
 */
export const deleteSubject = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const subject = await Subject.findById(req.params.id).session(session);
    if (!subject) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, msg: "Subject not found" });
    }

    const allSubStrandIds = subject.strands.reduce((acc, strand) => {
      return acc.concat(strand.subStrands);
    }, []);

    if (allSubStrandIds.length > 0) {
      await SubStrand.deleteMany({ _id: { $in: allSubStrandIds } }).session(session);
    }

    await subject.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      msg: "Subject and associated sub-strands deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, msg: error.message });
  }
};