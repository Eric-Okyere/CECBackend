import multer from "multer";
import os from "os";
import path from "path";
import crypto from "crypto";

// Videos are written to a temp folder instead of RAM. Holding five large videos in
// memory at once can crash a small server (e.g. Render's 512 MB instances).
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB) || 200;

const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 10);
    cb(null, `cec-upload-${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("video/")) return cb(null, true);
  const err = new Error("Only video files can be uploaded.");
  err.status = 400;
  cb(err);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024, files: 5 },
});

export default upload;
