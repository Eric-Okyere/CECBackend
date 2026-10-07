import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../model/User.js";

/**
 * protect — requires a valid "Authorization: Bearer <token>" header.
 *
 * The user is re-loaded from the database on every request so that:
 *   - deleted accounts are rejected immediately (not after the token expires)
 *   - admin rights that were revoked take effect immediately
 *
 * Sets:
 *   req.userId  -> string id of the logged-in account
 *   req.user    -> the logged-in user document (lean, no password)
 */
export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Please log in to continue." });
  }

  const token = authHeader.slice(7).trim();

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ msg: "Your session has expired. Please log in again." });
  }

  if (!decoded?.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
    return res.status(401).json({ msg: "Invalid session. Please log in again." });
  }

  const user = await User.findById(decoded.id).select("-password").lean();
  if (!user) {
    return res.status(401).json({ msg: "This account no longer exists." });
  }

  req.user = user;
  req.userId = String(user._id);
  next();
};

/**
 * adminOnly — must be used after `protect`.
 */
export const adminOnly = (req, res, next) => {
  if (req.user?.admin !== true) {
    return res.status(403).json({ msg: "Admin access required." });
  }
  next();
};

/**
 * Can the logged-in account act on behalf of `targetUserId`?
 * Allowed when the caller is an admin, the user themself, or the parent of that child.
 */
export const canActForUser = async (req, targetUserId) => {
  if (!targetUserId) return false;
  const target = String(targetUserId);

  if (req.user?.admin === true) return true;
  if (target === req.userId) return true;
  if (!mongoose.Types.ObjectId.isValid(target)) return false;

  const child = await User.findById(target).select("parentId").lean();
  return Boolean(child?.parentId && String(child.parentId) === req.userId);
};

/**
 * Route middleware version of canActForUser — reads the target id from a route param.
 */
export const requireSelfParentOrAdmin = (paramName) => async (req, res, next) => {
  const allowed = await canActForUser(req, req.params[paramName]);
  if (!allowed) {
    return res.status(403).json({ msg: "You do not have access to this account." });
  }
  next();
};

// Backwards-compatible default export (older routes import the default).
export default protect;
