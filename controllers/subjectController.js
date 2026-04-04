import Subject from "../model/Subject.js";

/**
 * @desc    Step 1: Create a Subject (Mathematics, Science, etc.)
 * @route   POST /api/subjects
 */
export const createSubject = async (req, res) => {
  try {
    const { name, level } = req.body;

    // Check if this Subject + Level combo already exists
    const existingSubject = await Subject.findOne({ name, level });
    if (existingSubject) {
      return res.status(400).json({ 
        success: false, 
        msg: "This subject already exists for this level." 
      });
    }

    const subject = await Subject.create({
      name,
      level,
      strands: [] // Start with an empty array of strands
    });

    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * @desc    Get all subjects (useful for a dropdown in your Topic Controller)
 * @route   GET /api/subjects
 */
export const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ level: 1, name: 1 });
    res.status(200).json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


/**
 * @desc    Get a single Subject by its MongoDB ID
 * @route   GET /api/subjects/:id
 */
export const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findById(id);

    if (!subject) {
      return res.status(404).json({ 
        success: false, 
        msg: "Subject not found" 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: subject 
    });
  } catch (error) {
    // Check if the error is due to an invalid MongoDB ObjectId format
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, msg: "Invalid Subject ID format" });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};


/**
 * @desc    Update Subject Identity (Name or Level)
 * @route   PUT /api/subjects/:id
 */
export const updateSubject = async (req, res) => {
  try {
    const { name, level } = req.body;
    
    // Check if the update would create a duplicate name+level combo
    if (name || level) {
      const existing = await Subject.findOne({ 
        name: name || undefined, 
        level: level || undefined,
        _id: { $ne: req.params.id } // Exclude the current document
      });
      
      if (existing) {
        return res.status(400).json({ success: false, msg: "Another subject already exists with this name and level." });
      }
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedSubject) return res.status(404).json({ success: false, msg: "Subject not found" });

    res.status(200).json({ success: true, data: updatedSubject });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


/**
 * @desc    Step 2: Add Strands and Sub-strands to a specific Subject ID
 * @route   PATCH /api/subjects/:id/strands
 */
export const addStrandToSubject = async (req, res) => {
  try {
    const { id } = req.params; // The Subject ID
    const { title, subStrands } = req.body; // e.g., "Number", ["Integers", "Fractions"]

    // Use $push to add a new object to the strands array
    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      { 
        $push: { 
          strands: { title, subStrands } 
        } 
      },
      { new: true, runValidators: true }
    );

    if (!updatedSubject) {
      return res.status(404).json({ success: false, msg: "Subject not found" });
    }

    res.status(200).json({ 
      success: true, 
      msg: "Strand added successfully", 
      data: updatedSubject 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};