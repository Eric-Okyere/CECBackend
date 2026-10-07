import { v2 as cloudinary } from "cloudinary";

// Configured once here and imported everywhere (server.js loads .env before this runs).
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true,
});

export default cloudinary;
