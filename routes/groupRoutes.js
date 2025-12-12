const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const userAuthenticate = require("../middleware/auth");
const { isAdmin } = require('../middleware/groupAuth');
const upload = require("../middleware/upload");

// GET all groups for the current user
router.get('/fetch', userAuthenticate.authenticate, groupController.getMyGroups);

// POST to create a new group
router.post('/create', userAuthenticate.authenticate, groupController.createGroup);

// GET all members of a specific group
router.get('/:groupId/members', userAuthenticate.authenticate, groupController.getGroupMembers);

// PUT to update a group's details (name, description, etc.)
router.put('/:groupId', userAuthenticate.authenticate, isAdmin, groupController.updateGroupDetails);

// DELETE to remove a member from a group
router.delete('/:groupId/members/:userId', userAuthenticate.authenticate, isAdmin, groupController.removeMemberFromGroup);

// PUT to update a member's role (admin/member)
router.put('/:groupId/members/:userId', userAuthenticate.authenticate, isAdmin, groupController.updateMemberRole);

// GET friends who can be added to a group
router.get('/:groupId/addable-friends', userAuthenticate.authenticate, isAdmin, groupController.getAddableFriends);

// DELETE for a user to leave a group
router.delete('/:groupId/leave', userAuthenticate.authenticate, groupController.leaveGroup);

// DELETE to permanently delete a group
router.delete('/:groupId', userAuthenticate.authenticate, isAdmin, groupController.deleteGroup);

// POST to add new members to a group
router.post('/:groupId/members', userAuthenticate.authenticate, isAdmin, groupController.addMembersToGroup);

// GET to check the current user's membership status/role in a group
router.get('/:groupId/membership/me', userAuthenticate.authenticate, groupController.getMembershipStatus);


// --- Group Messages (HTTP API) ---
// These routes are called by sendMessages.js

// GET message history for a group
router.get(
  "/messages/:groupId", 
  userAuthenticate.authenticate, 
  groupController.getGroupConversation
);

// POST to upload a file to a group
router.post(
  "/add-file",
  userAuthenticate.authenticate,
  upload.single("file"), // Multer middleware for file handling
  groupController.sendGroupFile
);
module.exports = router;