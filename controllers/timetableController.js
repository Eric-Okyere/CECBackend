import Timetable from "../model/Timetable.js";

// @desc    Add or Update a Day's Schedule
// @route   POST /api/timetable
export const saveSchedule = async (req, res) => {
  try {
    const { day, timeSlots } = req.body;
    const userId = req.user; // From authMiddleware

    const schedule = await Timetable.findOneAndUpdate(
      { user: userId, day },
      { timeSlots },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get User's Full Timetable
// @route   GET /api/timetable
export const getMyTimetable = async (req, res) => {
  try {
    const userId = req.user;
    const schedule = await Timetable.find({ user: userId });
    res.status(200).json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};