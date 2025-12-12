const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");
const userAuthenticate = require("../middleware/auth");

// Route for the frontend's "initializeChatData" call
router.get(
  "/friends",
  userAuthenticate.authenticate,
  contactController.getFriends
);
router.get('/received/requests', userAuthenticate.authenticate, contactController.getReceivedRequests);
router.get('/sent/requests', userAuthenticate.authenticate, contactController.getSentRequests);
router.get('/friends/blocked', userAuthenticate.authenticate, contactController.getBlockedUsers);
router.get('/friends/suggestions', userAuthenticate.authenticate, contactController.getAvailableUsers);

router.post('/send-request/:userId', userAuthenticate.authenticate, contactController.sendFriendRequest);

router.post('/accept/:requestId',userAuthenticate.authenticate, contactController.updateFriendRequest);

router.post('/decline/:requestId',userAuthenticate.authenticate, contactController.updateFriendRequest);

// New
router.post('/cancel-request/:requestId', userAuthenticate.authenticate, contactController.cancelRequest);

router.post('/unfriend/:userId',userAuthenticate.authenticate, contactController.removeFriend);

router.post('/block/:userId',userAuthenticate.authenticate, contactController.blockUser);

router.post('/unblock/:userId',userAuthenticate.authenticate, contactController.unblockUser);


module.exports = router;