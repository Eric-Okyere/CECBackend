import rateLimit from "express-rate-limit";

const limiter = (windowMs, limit, msg) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { msg },
  });

// Whole API: generous, just stops runaway scripts / floods.
export const apiLimiter = limiter(60 * 1000, 300, "Too many requests. Please slow down.");

// Login, register, verification: blocks password and code guessing.
export const authLimiter = limiter(
  15 * 60 * 1000,
  30,
  "Too many attempts. Please wait 15 minutes and try again."
);

// Public feedback form: stops spam.
export const feedbackLimiter = limiter(
  60 * 60 * 1000,
  10,
  "You have sent a lot of feedback recently. Please try again later."
);
