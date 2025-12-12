// Import the Express framework
const express = require("express");
// Create a new router instance. A router acts like a "mini-application"
// to handle a specific group of routes (in this case, all auth routes).
const router = express.Router();

// Import the controller file that contains the logic for each route.
// authController will be an object with functions like postUsers, loginUser, etc.
const authController = require("../controllers/authController");

// ==================
// == Public Routes ==
// ==================

// Route:   POST /api/auth/signup
// Purpose: Handle new user registration.
// Logic:   Calls the postUsers function from the authController.
router.post("/signup", authController.postUsers);

// Route:   POST /api/auth/login
// Purpose: Handle existing user login.
// Logic:   Calls the loginUser function from the authController.
router.post("/login", authController.loginUser);

// Route:   POST /api/auth/forgot-password
// Purpose: Handle the "forgot password" request (sends reset email).
// Logic:   Calls the requestPasswordReset function from the authController.
router.post("/forgot-password", authController.requestPasswordReset);

// Route:   POST /api/auth/reset-password/:token
// Purpose: Handle the actual password update using a token from the URL.
// Logic:   Calls the updatenewPassword function from the authController.
router.post("/reset-password/:token", authController.updatenewPassword);

// Export the configured router so it can be imported and used
// in your main app.js or server.js file.
module.exports = router;