import "dotenv/config"; // must be first so every module sees the env vars
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/authRoutes.js";
import lessonRoutes from "./routes/lessonRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import timetableRoutes from "./routes/timetableRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { handleWebhook } from "./controllers/paymentController.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import User from "./model/User.js";

// --- Required configuration -------------------------------------------------
for (const key of ["MONGO_URI", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`FATAL ERROR: ${key} is not defined.`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn("⚠️  JWT_SECRET is short. Use at least 32 random characters in production.");
}

const app = express();
app.set("trust proxy", 1); // Render / Netlify sit behind a proxy (needed for rate limiting)
app.disable("x-powered-by");

// --- CORS: only our own frontends may call the API from a browser -----------
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "https://cecextraclasses.netlify.app,http://localhost:5173"
)
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // No Origin header = server-to-server (Paystack webhook, curl, health checks).
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  })
);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// --- Paystack webhook needs the RAW body to check its signature ---------------
app.post("/api/payments/webhook", express.raw({ type: "*/*", limit: "1mb" }), handleWebhook);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// --- Request logger -----------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`📡 ${req.method} ${req.originalUrl} | ${res.statusCode} | ${Date.now() - start}ms`);
  });
  next();
});

app.get("/", (req, res) => res.send("Server OK"));
app.get("/api/health", (req, res) =>
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" })
);

// --- Routes -------------------------------------------------------------------
app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/payments", paymentRoutes);

app.use(notFound);
app.use(errorHandler);

// --- Database, then start listening --------------------------------------------
const PORT = process.env.PORT || 5001;

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");
  } catch (err) {
    console.error("DB Connection Error:", err);
    process.exit(1);
  }

  // Previously the email index was DROPPED on every boot, leaving emails non-unique.
  // syncIndexes makes the database match the schema once: a *sparse* unique index,
  // which allows many child profiles with no email while keeping real emails unique.
  try {
    await User.syncIndexes();
  } catch (err) {
    console.warn("ℹ️ Could not sync user indexes (check for duplicate emails):", err.message);
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));
};

if (process.env.NODE_ENV !== "test") start();

export default app;
