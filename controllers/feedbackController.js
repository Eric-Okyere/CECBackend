import mongoose from "mongoose";
import Feedback from "../model/Feedback.js";

const TYPES = ["bug", "feature", "general"];
const STATUSES = ["pending", "in-review", "resolved"];
const clip = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const createFeedback = async (req, res) => {
  const { name, type, message, email, pageUrl, userAgent, screenResolution } = req.body || {};

  const text = clip(message, 5000);
  if (!text) {
    return res.status(400).json({ success: false, message: "Message is required" });
  }

  const newFeedback = await Feedback.create({
    name: clip(name, 100),
    type: TYPES.includes(type) ? type : "general",
    message: text,
    email: clip(email, 200),
    pageUrl: clip(pageUrl, 500),
    userAgent: clip(userAgent, 500),
    screenResolution: clip(screenResolution, 50),
  });

  res.status(201).json({ success: true, data: { _id: newFeedback._id } });
};

export const getFeedbacks = async (req, res) => {
  const feedbackList = await Feedback.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: feedbackList });
};

export const updateFeedbackStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid feedback id." });
  }
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: `Status must be one of: ${STATUSES.join(", ")}` });
  }
  const updated = await Feedback.findByIdAndUpdate(id, { status }, { returnDocument: "after" });
  if (!updated) return res.status(404).json({ success: false, message: "Feedback not found." });
  res.status(200).json({ success: true, data: updated });
};
