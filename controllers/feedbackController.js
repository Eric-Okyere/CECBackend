// controllers/feedbackController.js
import Feedback from '../model/Feedback.js';

export const createFeedback = async (req, res) => {
  try {
    const { name, type, message, email, pageUrl, userAgent, screenResolution } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const newFeedback = await Feedback.create({
      name,
      type,
      message,
      email,
      pageUrl,
      userAgent,
      screenResolution,
    });

    res.status(201).json({ success: true, data: newFeedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeedbacks = async (req, res) => {
  try {
    const feedbackList = await Feedback.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: feedbackList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};