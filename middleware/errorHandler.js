import multer from "multer";

export const notFound = (req, res) => {
  res.status(404).json({ msg: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? `Video is too large (max ${Number(process.env.MAX_VIDEO_MB) || 200} MB).`
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
        ? "You can upload at most 5 videos at a time."
        : err.message;
    return res.status(400).json({ success: false, msg });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, msg: "Request is too large." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, msg: "Malformed JSON in request body." });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, msg: `Invalid value for ${err.path}.` });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, msg: err.message });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error("Unhandled error:", err);

  res.status(status).json({
    success: false,
    msg: status >= 500 && !err.expose ? "Something went wrong on the server." : err.message,
  });
};
