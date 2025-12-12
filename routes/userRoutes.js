const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const userAuthenticate = require("../middleware/auth");

// Route for the frontend's initial "fetchCurrentUserId" call
router.get(
  "/profile/me",
  userAuthenticate.authenticate,
  userController.getProfile
);

module.exports = router;