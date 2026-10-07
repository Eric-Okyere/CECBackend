import Timetable from "../model/Timetable.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const clean = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// @desc    Add or Update a Day's Schedule
// @route   POST /api/timetable
export const saveSchedule = async (req, res) => {
  const { day, timeSlots } = req.body || {};
  if (!DAYS.includes(day)) {
    return res.status(400).json({ success: false, message: `Day must be one of: ${DAYS.join(", ")}` });
  }

  const slots = Array.isArray(timeSlots)
    ? timeSlots.slice(0, 30).map((s) => ({
        startTime: clean(s?.startTime, 20),
        endTime: clean(s?.endTime, 20),
        subject: clean(s?.subject),
        task: clean(s?.task, 500),
      }))
    : [];

  const schedule = await Timetable.findOneAndUpdate(
    { user: req.userId, day },
    { $set: { timeSlots: slots } },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({ success: true, data: schedule });
};

// @desc    Get User's Full Timetable
// @route   GET /api/timetable
export const getMyTimetable = async (req, res) => {
  const schedule = await Timetable.find({ user: req.userId });
  res.status(200).json({ success: true, data: schedule });
};
