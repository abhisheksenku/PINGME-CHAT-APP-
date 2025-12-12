// ==================
// == DEPENDENCIES ==
// ==================

// Imports the jsonwebtoken library, used for verifying the user's access token.
const jwt = require("jsonwebtoken");
// Imports the User model to find and attach the authenticated user to the request.
const User = require("../models/users");
// Loads environment variables (like JWT_SECRET) from the .env file.
require("dotenv").config();

// ==================
// == MIDDLEWARE ==
// ==================

/**
 * An Express middleware function to protect routes.
 * It checks for a valid JWT in the request's Authorization header or cookies.
 * If the token is valid, it finds the user in the database and attaches them to the `req` object.
 * If the token is invalid or missing, it blocks the request.
 */
const authenticate = async (req, res, next) => {
  try {
    // --- 1. Token Extraction ---
    // Attempt to find the token in the 'Authorization' header (for API requests)
    // or in the 'token' cookie (for browser navigation).
    let token = req.header("Authorization") || req.cookies.token;

    // If the token is in the header, it's often in the format "Bearer <token>".
    // This checks for and removes the "Bearer " prefix.
    if (token && token.startsWith("Bearer ")) {
      token = token.slice(7); // "Bearer ".length is 7
    }

    console.log("Token received:", token);

    // --- 2. Token Validation ---
    // If no token is found in either location, the user is not authenticated.
    if (!token) {
      // For a browser request (like accessing /chat), redirect to the login page.
      return res.redirect("/login");
      // For an API request, you might send a 401 error instead:
      // return res.status(401).json({ message: "No token provided, authorization denied" });
    }

    // --- 3. Token Verification ---
    // Use jwt.verify() to check if the token is valid and not expired.
    // It uses the JWT_SECRET from your .env file to check the signature.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded JWT:", decoded); // e.g., { user: { id: 1 }, iat: ..., exp: ... }

    // --- 4. Fetch User ---
    // Extract the user's ID from the token's payload.
    const userId = decoded.user.id;
    // Find the user in the database using their ID.
    const user = await User.findByPk(userId);

    // If the user ID in the token doesn't exist in the database (e.g., deleted user),
    // the token is invalid.
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // --- 5. Success: Attach User to Request ---
    // This is the main purpose of the middleware.
    // We attach the full 'user' object from the database to the 'req' object.
    // Now, any *following* route or controller can access `req.user` to
    // know who is making the request.
    req.user = user;

    // Call 'next()' to pass control to the next middleware or route handler
    // in the chain (e.g., the (req, res) => { ... } function in app.js).
    next();
  } catch (error) {
    // --- 6. Error Handling ---
    // This block catches any errors, especially from jwt.verify().
    console.error("Authentication error:", error.message);

    // Specific check for an expired token.
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired" });
    }

    // Specific check for a malformed or invalid token.
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // Fallback for any other errors.
    res.status(500).json({ success: false, message: "Authentication failed" });
  }
};

// ==================
// == EXPORTS ==
// ==================

// Export the authenticate function so it can be imported in app.js and other route files.
module.exports = { authenticate };