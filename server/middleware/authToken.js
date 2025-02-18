import jwt from "jsonwebtoken";

const authToken = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ message: "Access denied. Token is required." });
  }

  try {
    const tokenWithoutBearer = token.startsWith("Bearer ")
      ? token.split(" ")[1]
      : token;

    const decoded = jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (error) {
    const message = error.name === "TokenExpiredError"
      ? "Token expired. Please log in again."
      : "Invalid token.";
    res.status(401).json({ message });
  }
};

export default authToken;
