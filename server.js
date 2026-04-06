import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";


import authRoutes from "./routes/authRoutes.js";
import lessonRoutes from "./routes/lessonRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";



dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
  res.send("Server OK");
});

app.post("/test", (req, res) => {
  console.log("TEST HIT");
  res.json({ msg: "Working" });
});

// ✅ ADVANCED GLOBAL LOGGER
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    console.log(
      `📡 ${req.method} ${req.originalUrl} | ${res.statusCode} | ${duration}ms | ${new Date().toLocaleTimeString()}`
    );
  });

  next();
});

// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/subjects", subjectRoutes);

// DB
if (!process.env.MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined.");
    process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to DB"))
  .catch(err => console.error("DB Connection Error:", err));
// SERVER
app.listen(5001, () =>
  console.log("🚀 Server running on http://localhost:5001")
);