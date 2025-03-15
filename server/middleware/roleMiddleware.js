// Middleware to check user role
const authorizeRole = (roles) => {
  return (req, res, next) => {
    // If roles is a string, convert it to an array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    // Allow admin to access all routes
    if (req.user.role === "admin") {
      return next();
    }

    // Check if user role is in allowed roles
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // If using driverId or passengerId parameter, check if the user is accessing their own data
    if (req.params.driverId && req.user._id === req.params.driverId) {
      return next();
    }

    if (req.params.passengerId && req.user._id === req.params.passengerId) {
      return next();
    }

    // Special case for trip booking - allow passengers to book trips
    if (req.path.includes("/book/") && req.user.role === "passenger") {
      return next();
    }

    // Special case for trip cancellation - allow passengers to cancel their bookings
    if (req.path.includes("/cancel/") && req.user.role === "passenger") {
      return next();
    }

    return res.status(403).json({
      message: `Access denied. ${allowedRoles.join(" or ")} role required.`,
    });
  };
};

export default authorizeRole;
