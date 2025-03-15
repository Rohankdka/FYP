import jwt from "jsonwebtoken";

const authToken = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. Token is required." });
  }

  if (!token.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Invalid token format. Use 'Bearer <token>'." });
  }

  try {
    const tokenWithoutBearer = token.split(" ")[1]; // Extract token without "Bearer"
    const decoded = jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET);

    // Ensure the decoded token includes the required fields
    if (!decoded.id || !decoded.role) {
      return res.status(401).json({ message: "Invalid token payload." });
    }

    req.user = decoded; // Attach user data to the request object
    next();
  } catch (error) {
    let message = "Invalid token.";
    if (error.name === "TokenExpiredError") {
      message = "Token expired. Please log in again.";
    } else if (error.name === "JsonWebTokenError") {
      message = "Invalid token.";
    }
    res.status(401).json({ message });
  }
};

export default authToken;
