const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const userAuthenticate = require("../middleware/auth");
const upload = require("../middleware/upload"); // <-- Import multer

// Route to fetch the message history for a 1-to-1 chat
router.get(
  "/fetch/:userId",
  userAuthenticate.authenticate,
  chatController.getConversation
);

// NEW: Route to "catch" a file upload for a 1-to-1 chat
router.post(
  "/add-file",
  userAuthenticate.authenticate,
  upload.single("file"), // <-- Use multer middleware
  chatController.sendFile
);

module.exports = router;