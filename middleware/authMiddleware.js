import jwt from "jsonwebtoken";

export default function (req, res, next) {
  // 1. Get the header
  const authHeader = req.headers.authorization;

  // 2. Check if it exists and starts with "Bearer "
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  // 3. Extract the actual token string
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach the user ID to the request object
    // Note: Use req.user = decoded; if your token contains the whole object
    req.user = decoded.id; 
    
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
}