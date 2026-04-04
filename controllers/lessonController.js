import Lesson from "../model/Lesson.js";
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';


dotenv.config(); 

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// --- HELPER: Cloudinary Upload ---
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "video", folder: "lessons" },
      (error, result) => {
        if (error) return reject(error);
        // Explicitly mapping secure_url to url for the database
        resolve({ 
          url: result.secure_url, 
          public_id: result.public_id 
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// ➕ CREATE: Multiple Videos with Titles
export const createLesson = async (req, res) => {
  try {
    const { titles } = req.body; // Expecting an array or string from form-data
    let videoTitles = [];
    
    // Parse titles (form-data sends arrays as strings or multiple keys)
    if (typeof titles === 'string') videoTitles = JSON.parse(titles);
    else videoTitles = titles || [];

    let videoData = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file, index) => {
        const cloud = await uploadToCloudinary(file.buffer);
        return {
          ...cloud,
          title: videoTitles[index] || `Video ${index + 1}` // Fallback title
        };
      });
      videoData = await Promise.all(uploadPromises);
    }

    const lesson = await Lesson.create({
      ...req.body,
      videos: videoData,
      quiz: JSON.parse(req.body.quiz || "[]")
    });

    res.status(201).json({ success: true, lesson });
  } catch (err) {
    res.status(500).json({ msg: "Creation failed", error: err.message });
  }
};

// 📥 READ: All Lessons
export const getLessons = async (req, res) => {
  try {
    const lessons = await Lesson.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: lessons });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 📥 READ: Get a single lesson by ID with all details (Videos + Quiz)
export const getLessonById = async (req, res) => {
  try {
    const { id } = req.params;

    // findById pulls the specific document and all its nested arrays
    const lesson = await Lesson.findById(id);

    if (!lesson) {
      return res.status(404).json({ 
        success: false, 
        message: "Curriculum asset not found in repository." 
      });
    }

    // This sends back the full object including the videos[] and quiz[] arrays
    res.status(200).json({ 
      success: true, 
      data: lesson 
    });
  } catch (error) {
    // Handle invalid ObjectId formats or server errors
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};



// ✏️ UPDATE: Append New Videos with Titles
export const updateLesson = async (req, res) => {
  try {
    const { titles, quiz, ...otherFields } = req.body; 
    
    // 1. Handle Titles safely
    let videoTitles = [];
    if (titles) {
      videoTitles = typeof titles === 'string' ? JSON.parse(titles) : titles;
    }

    // 2. Upload new videos if they exist
    let newVideos = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file, index) => {
        const cloud = await uploadToCloudinary(file.buffer);
        return {
          url: cloud.url, // FIXED: Changed cloud.secure_url to cloud.url
          public_id: cloud.public_id,
          title: videoTitles[index] || `New Lesson ${index + 1}`
        };
      });
      newVideos = await Promise.all(uploadPromises);
    }

    // 3. Prepare Update Query
    // We strictly define what we are setting to avoid wiping out the 'videos' array
    const updateData = { ...otherFields };

    if (quiz) {
      updateData.quiz = typeof quiz === 'string' ? JSON.parse(quiz) : quiz;
    }

    const updateQuery = { $set: updateData };

    // 4. Add new videos to the existing array without overwriting
    if (newVideos.length > 0) {
      updateQuery.$push = { videos: { $each: newVideos } };
    }

    const updatedLesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      updateQuery,
      { 
        new: true, // Returns the updated document
        runValidators: true 
      }
    );

    if (!updatedLesson) {
      return res.status(404).json({ success: false, message: "Lesson not found" });
    }

    res.status(200).json({ success: true, data: updatedLesson });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


// ❌ DELETE: Single Video from the 'videos' array
export const deleteVideoFromLesson = async (req, res) => {
  try {
    const { id, videoId } = req.params;

    // 1. Find the lesson
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json({ success: false, msg: "Lesson not found" });
    }

    // 2. Find the specific video in the array
    const video = lesson.videos.id(videoId);
    if (!video) {
      return res.status(404).json({ success: false, msg: "Video not found in this lesson" });
    }

    // 3. Remove from Cloudinary first
    // Note: resource_type must be "video" for video files
    await cloudinary.uploader.destroy(video.public_id, { resource_type: "video" });

    // 4. Pull from the Mongoose array and save
    lesson.videos.pull(videoId);
    await lesson.save();

    res.status(200).json({ 
      success: true, 
      msg: "Video deleted successfully", 
      data: lesson 
    });
  } catch (err) {
    console.error("Delete Video Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ❌ DELETE: Full Lesson
export const deleteLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ msg: "Not found" });

    const deletePromises = lesson.videos.map(v => 
      cloudinary.uploader.destroy(v.public_id, { resource_type: "video" })
    );
    await Promise.all(deletePromises);

    await Lesson.findByIdAndDelete(req.params.id);
    res.status(200).json({ msg: "Lesson deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};