import crypto from "crypto";
import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendVerificationEmail } from "../services/emailService.js";
import { canActForUser } from "../middleware/authMiddleware.js";
import User from "../model/User.js";
import Progress from "../model/Progress.js";
import Timetable from "../model/Timetable.js";
import { exactInsensitive } from "../utils/escapeRegex.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const MIN_PASSWORD_LENGTH = 8;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SELF_SERVICE_ROLES = ["learner", "parent"];
const ALL_ROLES = ["learner", "parent", "child"];
const GENDERS = ["Male", "Female", ""];

// --- helpers ---------------------------------------------------------------

const signToken = (userId, expiresIn) =>
  jwt.sign({ id: String(userId) }, process.env.JWT_SECRET, { expiresIn });

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

// Exact (lower-case) match first; then a case-insensitive fallback so older
// mixed-case records are still found.
const findByEmail = async (email, select = "") => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return (
    (await User.findOne({ email: normalized }).select(select)) ||
    (await User.findOne({ email: exactInsensitive(normalized) }).select(select))
  );
};

const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

const randomPassword = () => bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

const issueVerificationCode = async (user) => {
  const code = crypto.randomInt(100000, 1000000).toString();
  user.verificationCode = hashCode(code);
  user.verificationExpires = new Date(Date.now() + CODE_TTL_MS);
  user.verificationAttempts = 0;
  user.verificationSentAt = new Date();
  await user.save();
  return code;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

// Only these keys may be written into learningProfile by the user themself.
// isPaid / xp / streak are controlled by the server (payments and quizzes).
const pickLearningProfile = (lp = {}) => {
  const out = {};
  if (typeof lp.level === "string") out.level = lp.level.trim();
  if (lp.age !== undefined && lp.age !== null && lp.age !== "") {
    const age = Number(lp.age);
    if (Number.isFinite(age) && age > 0 && age < 120) out.age = age;
  }
  return out;
};

const pickParentDetails = (pd = {}) => {
  const out = {};
  if (typeof pd.phoneNumber === "string") out.phoneNumber = pd.phoneNumber.trim().slice(0, 30);
  if (typeof pd.relationship === "string") out.relationship = pd.relationship.trim().slice(0, 50);
  return out;
};

const pickDisabilityProfile = (dp = {}) => {
  const out = {};
  if (typeof dp.hasDisability === "boolean") out.hasDisability = dp.hasDisability;
  if (typeof dp.type === "string") out.type = dp.type;
  if (typeof dp.details === "string") out.details = dp.details.slice(0, 1000);
  if (typeof dp.accommodationsNeeded === "string")
    out.accommodationsNeeded = dp.accommodationsNeeded.slice(0, 1000);
  return out;
};

const mergeSub = (doc, key, patch) => {
  const current = doc[key]?.toObject ? doc[key].toObject() : doc[key] || {};
  doc[key] = { ...current, ...patch };
};

// --- Google sign-in -------------------------------------------------------

export const googleLogin = async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ msg: "Missing Google credential." });

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error("Google Auth Error:", error.message);
    return res.status(400).json({ msg: "Google authentication failed" });
  }

  const { name, family_name, email, sub, picture, email_verified } = payload || {};
  if (!email || email_verified === false) {
    return res.status(400).json({ msg: "Your Google email address is not verified." });
  }

  let user = await findByEmail(email);
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    user = await User.create({
      name: name || "Google User",
      surname: family_name || "-",
      email: normalizeEmail(email),
      googleId: sub,
      picture: picture || "",
      isVerified: true,
      role: "learner",
      password: await randomPassword(),
    });
  } else {
    const update = { picture: picture || user.picture, googleId: sub, isVerified: true };

    // If someone registered this email with a password but never verified it, they
    // did not prove they own the inbox. Google just proved the real owner does, so
    // the unverified password is thrown away (prevents account pre-hijacking).
    if (!user.isVerified) update.password = await randomPassword();

    await User.updateOne({ _id: user._id }, { $set: update });
    user = await User.findById(user._id);
  }

  const appToken = signToken(user._id, "7d");
  res.status(200).json({ token: appToken, user, isNewUser });
};

// --- Email + password ------------------------------------------------------

export const register = async (req, res) => {
  const { name, surname, password } = req.body || {};
  const email = normalizeEmail(req.body?.email);

  if (!name?.trim() || !surname?.trim() || !email || !password) {
    return res.status(400).json({ msg: "Please fill in all fields." });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ msg: "Please enter a valid email address." });
  }
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ msg: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  const hashed = await bcrypt.hash(String(password), 10);
  let user = await findByEmail(email);

  if (user && user.isVerified) {
    return res.status(400).json({ msg: "Email already registered. Please log in." });
  }

  if (user) {
    // Unverified leftover registration: let the person try again instead of
    // being stuck forever with an account they can't verify.
    user.name = name.trim();
    user.surname = surname.trim();
    user.password = hashed;
  } else {
    user = new User({
      name: name.trim(),
      surname: surname.trim(),
      email,
      password: hashed,
      role: "learner",
    });
  }

  const code = await issueVerificationCode(user);

  try {
    await sendVerificationEmail(email, code);
    return res.status(201).json({ msg: "Verification code sent to email.", emailSent: true });
  } catch (mailError) {
    console.error("Verification email failed:", mailError.message);
    // Account exists; the person can use "Resend" on the verify page.
    return res.status(201).json({
      msg: "Account created, but we couldn't send the email. Use 'Resend' on the next page.",
      emailSent: false,
    });
  }
};

export const verifyEmail = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();

  if (!email || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ msg: "Enter your email and the 6-digit code." });
  }

  const user = await findByEmail(
    email,
    "+verificationCode +verificationExpires +verificationAttempts"
  );

  // Same message whether or not the account exists (no email probing).
  const invalid = () => res.status(400).json({ msg: "Invalid or expired verification code." });

  if (!user) return invalid();
  if (user.isVerified) return res.status(400).json({ msg: "Account already verified. Please log in." });
  if (!user.verificationCode || !user.verificationExpires) return invalid();

  if (user.verificationExpires.getTime() < Date.now()) {
    return res.status(400).json({ msg: "Code has expired. Please request a new one." });
  }
  if ((user.verificationAttempts || 0) >= MAX_CODE_ATTEMPTS) {
    return res.status(429).json({ msg: "Too many wrong attempts. Please request a new code." });
  }

  const expected = Buffer.from(user.verificationCode, "hex");
  const actual = Buffer.from(hashCode(code), "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    user.verificationAttempts = (user.verificationAttempts || 0) + 1;
    await user.save();
    return invalid();
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationExpires = undefined;
  user.verificationAttempts = 0;
  await user.save();

  res.json({ msg: "Email verified successfully! You can now log in." });
};

export const resendVerification = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const generic = { msg: "If that account exists and is unverified, a new code has been sent." };

  if (!email) return res.status(400).json({ msg: "Email is required." });

  const user = await findByEmail(email, "+verificationSentAt");
  if (!user || user.isVerified) return res.json(generic);

  const lastSent = user.verificationSentAt?.getTime() || 0;
  const wait = Math.ceil((lastSent + RESEND_COOLDOWN_MS - Date.now()) / 1000);
  if (wait > 0) {
    return res.status(429).json({ msg: `Please wait ${wait}s before requesting another code.` });
  }

  const code = await issueVerificationCode(user);
  try {
    await sendVerificationEmail(user.email, code);
  } catch (mailError) {
    console.error("Resend verification failed:", mailError.message);
    return res.status(502).json({ msg: "We couldn't send the email right now. Try again shortly." });
  }
  res.json(generic);
};

export const login = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { password } = req.body || {};
  const badCreds = () => res.status(400).json({ msg: "Wrong email or password" });

  if (!email || !password) return badCreds();

  const user = await findByEmail(email, "+password");
  if (!user) return badCreds();

  const isMatch = await bcrypt.compare(String(password), user.password);
  if (!isMatch) return badCreds();

  if (!user.isVerified) {
    return res.status(403).json({
      msg: "Please verify your email before logging in.",
      needsVerification: true,
    });
  }

  const token = signToken(user._id, "1d");
  res.json({ token, user }); // password is stripped by the schema's toJSON
};

// --- Parent / child --------------------------------------------------------

export const addChild = async (req, res) => {
  const { firstName, lastName, age, level, gender, disabilityProfile } = req.body || {};

  // A parent can only add children to their own account. Admins may specify a parent.
  const parentId =
    req.user.admin && req.body?.parentId && isValidId(req.body.parentId)
      ? req.body.parentId
      : req.userId;

  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ msg: "Child's first and last name are required." });
  }

  const parent = await User.findById(parentId);
  if (!parent) return res.status(404).json({ msg: "Parent account not found." });
  if (parent.role === "child") {
    return res.status(400).json({ msg: "A child profile cannot have children." });
  }

  if (parent.role !== "parent") {
    parent.role = "parent";
    await parent.save();
  }

  const childAge = Number(age);
  const newChild = await User.create({
    name: firstName.trim(),
    surname: lastName.trim(),
    gender: GENDERS.includes(gender) ? gender : "",
    role: "child",
    parentId: parent._id,
    isVerified: true,
    password: await randomPassword(),
    disabilityProfile: {
      hasDisability: false,
      type: "None",
      details: "",
      accommodationsNeeded: "",
      ...pickDisabilityProfile(disabilityProfile),
    },
    learningProfile: {
      age: Number.isFinite(childAge) && childAge > 0 ? childAge : undefined,
      level: typeof level === "string" ? level : "",
      xp: 0,
      isPaid: false,
    },
  });

  res.status(201).json(newChild);
};

export const getChild = async (req, res) => {
  const { parentId } = req.params;
  if (!isValidId(parentId)) return res.status(400).json({ msg: "Invalid parent id." });

  if (!req.user.admin && parentId !== req.userId) {
    return res.status(403).json({ msg: "You can only view your own children." });
  }

  const children = await User.find({ parentId }).populate(
    "parentId",
    "name surname email parentDetails"
  );
  res.json(children);
};

// --- Lessons ---------------------------------------------------------------

export const unlockLesson = async (req, res) => {
  const { userId, lessonData } = req.body || {};
  const targetId = userId || req.userId;

  if (!lessonData) return res.status(400).json({ msg: "Missing lesson data" });
  if (!(await canActForUser(req, targetId))) {
    return res.status(403).json({ msg: "You do not have access to this account." });
  }

  const entry = {
    subject: String(lessonData.subject || "").slice(0, 200),
    level: String(lessonData.level || "").slice(0, 50),
    subStrand: String(lessonData.subStrand || "").slice(0, 300),
  };

  const updatedUser = await User.findById(targetId).select("unlockedLessons");
  if (!updatedUser) return res.status(404).json({ msg: "User not found" });

  // Only add if the same subject/level/subStrand isn't already unlocked
  // ($addToSet never matched before because unlockedAt differs every time).
  const already = updatedUser.unlockedLessons.some(
    (u) => u.subject === entry.subject && u.level === entry.level && u.subStrand === entry.subStrand
  );
  if (!already) {
    updatedUser.unlockedLessons.push({ ...entry, unlockedAt: new Date() });
    await updatedUser.save();
  }

  res.status(200).json({
    msg: "Lesson unlocked successfully",
    unlockedLessons: updatedUser.unlockedLessons,
  });
};

// --- Profiles --------------------------------------------------------------

export const getAllUsers = async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ msg: "Invalid user id." });

  const user = await User.findById(id).populate("parentId", "name surname email parentDetails");
  if (!user) return res.status(404).json({ msg: "User not found" });
  res.json(user);
};

export const updateProfile = async (req, res) => {
  const userId = req.params.id;
  const {
    role, name, surname, acceptedTerms, acceptedTermsAt,
    learningProfile, parentDetails, disabilityProfile, gender,
  } = req.body || {};

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ msg: "User not found." });

  if (typeof name === "string" && name.trim()) user.name = name.trim();
  if (typeof surname === "string" && surname.trim()) user.surname = surname.trim();

  // Self-service role changes are limited to learner <-> parent, and never for child profiles.
  if (role !== undefined && user.role !== "child") {
    if (!SELF_SERVICE_ROLES.includes(role)) {
      return res.status(400).json({ msg: "Invalid role." });
    }
    user.role = role;
  }

  if (acceptedTerms !== undefined) user.acceptedTerms = Boolean(acceptedTerms);
  if (acceptedTermsAt) {
    const d = new Date(acceptedTermsAt);
    if (!Number.isNaN(d.getTime())) user.acceptedTermsAt = d;
  }

  const g = gender ?? learningProfile?.gender;
  if (g !== undefined && GENDERS.includes(g)) user.gender = g;

  if (learningProfile) mergeSub(user, "learningProfile", pickLearningProfile(learningProfile));
  if (parentDetails) mergeSub(user, "parentDetails", pickParentDetails(parentDetails));
  if (disabilityProfile) mergeSub(user, "disabilityProfile", pickDisabilityProfile(disabilityProfile));

  await user.save();

  return res.status(200).json({ msg: "Profile updated successfully", user });
};

// --- Admin user management ---------------------------------------------------

// Builds a $set from only the fields that were actually sent.
const buildAdminUpdate = (body = {}) => {
  const set = {};
  const name = body.name ?? body.firstName;
  const surname = body.surname ?? body.lastName;

  if (typeof name === "string" && name.trim()) set.name = name.trim();
  if (typeof surname === "string" && surname.trim()) set.surname = surname.trim();
  if (typeof body.email === "string" && body.email.trim()) set.email = normalizeEmail(body.email);
  if (body.role !== undefined) set.role = body.role;
  if (body.isVerified !== undefined) set.isVerified = Boolean(body.isVerified);
  if (body.admin !== undefined) set.admin = Boolean(body.admin);
  if (body.level !== undefined) set["learningProfile.level"] = String(body.level);
  if (body.age !== undefined && body.age !== "") set["learningProfile.age"] = Number(body.age);
  if (body.isPaid !== undefined) set["learningProfile.isPaid"] = Boolean(body.isPaid);
  if (body.phoneNumber !== undefined) set["parentDetails.phoneNumber"] = String(body.phoneNumber);
  if (body.relationship !== undefined) set["parentDetails.relationship"] = String(body.relationship);
  if (body.hasDisability !== undefined)
    set["disabilityProfile.hasDisability"] = Boolean(body.hasDisability);
  if (typeof body.disabilityDetails === "string")
    set["disabilityProfile.details"] = body.disabilityDetails;
  return set;
};

const adminUpdate = async (req, res, extra = {}) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ msg: "Invalid user id." });

  const set = { ...buildAdminUpdate(req.body), ...extra };

  if (set.role !== undefined && !ALL_ROLES.includes(set.role)) {
    return res.status(400).json({ msg: "Invalid role." });
  }
  if (set.email && !EMAIL_RE.test(set.email)) {
    return res.status(400).json({ msg: "Invalid email address." });
  }
  // Stop an admin from accidentally locking themself (and maybe everyone) out.
  if (id === req.userId && set.admin === false) {
    return res.status(400).json({ msg: "You cannot remove your own admin access." });
  }

  try {
    const result = await User.updateOne({ _id: id }, { $set: set }, { runValidators: true });
    if (!result.matchedCount) return res.status(404).json({ msg: "User not found." });
    return res.status(200).json(await User.findById(id));
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ msg: "Email address already exists." });
    throw error;
  }
};

export const updateUser = async (req, res) => {
  const extra = {};
  const { password } = req.body || {};
  if (typeof password === "string" && password.trim()) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ msg: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    extra.password = await bcrypt.hash(password, 10);
  }
  return adminUpdate(req, res, extra);
};

export const AdminupdateUser = (req, res) => adminUpdate(req, res);

export const toggleAdminStatus = async (req, res) => {
  const { id } = req.params;
  if (typeof req.body?.admin !== "boolean") {
    return res.status(400).json({ msg: "'admin' must be true or false." });
  }
  if (id === req.userId && req.body.admin === false) {
    return res.status(400).json({ msg: "You cannot remove your own admin access." });
  }
  if (!isValidId(id)) return res.status(400).json({ msg: "Invalid user id." });

  const result = await User.updateOne({ _id: id }, { $set: { admin: req.body.admin } });
  if (!result.matchedCount) return res.status(404).json({ msg: "User not found." });
  res.status(200).json(await User.findById(id));
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ msg: "Invalid User ID format" });
  if (id === req.userId) {
    return res.status(400).json({ msg: "You cannot delete your own admin account." });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ msg: "User not found" });

  // Remove the account plus anything that would be orphaned by it.
  const children = await User.find({ parentId: id }).select("_id").lean();
  const allIds = [user._id, ...children.map((c) => c._id)];

  await Promise.all([
    Progress.deleteMany({ user: { $in: allIds } }),
    Timetable.deleteMany({ user: { $in: allIds } }),
    User.deleteMany({ _id: { $in: allIds } }),
  ]);

  res.status(200).json({
    msg:
      children.length > 0
        ? `User account and ${children.length} linked child profile(s) deleted successfully`
        : "User account deleted successfully",
  });
};
