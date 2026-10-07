// Grants admin rights to an existing account.
// Usage:  node scripts/makeAdmin.js you@example.com
import "dotenv/config";
import mongoose from "mongoose";
import User from "../model/User.js";
import { exactInsensitive } from "../utils/escapeRegex.js";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/makeAdmin.js <email>");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const user = await User.findOneAndUpdate(
  { email: exactInsensitive(email) },
  { $set: { admin: true } },
  { returnDocument: "after" }
);
console.log(user ? `✅ ${user.email} is now an admin.` : `❌ No account found for ${email}.`);
await mongoose.disconnect();
