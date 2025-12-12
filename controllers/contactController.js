const { Op } = require("sequelize");
const {
  User,
  Contact,
  UnreadCount,
  Message,
} = require("../models/associations");

// Helper function to extract the "friend" from a contact object
const getOtherUser = (contact, userId) => {
  // Use the correct Uppercase aliases
  return contact.requesterId === userId ? contact.Addressee : contact.Requester;
};

// GET /api/contacts/friends
const getFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    const contacts = await Contact.findAll({
      where: {
        status: "accepted",
        [Op.or]: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: [
        {
          model: User,
          as: "Requester", // Correct alias
          attributes: ["id", "name", "email", "img", "isOnline", "status"],
        },
        {
          model: User,
          as: "Addressee", // Correct alias
          attributes: ["id", "name", "email", "img", "isOnline", "status"],
        },
      ],
    });

    // 1. Get the list of friend objects
    const friendsList = contacts
      .map((contact) => {
        return getOtherUser(contact, userId);
      })
      .filter((friend) => friend != null); // Filter out nulls if a user was deleted

    const friendIds = friendsList.map((friend) => friend.id);

    // 2. Fetch all unread counts for these friends
    const unreadCounts = await UnreadCount.findAll({
      where: {
        userId: userId,
        chatType: "individual",
        chatId: { [Op.in]: friendIds },
      },
      attributes: ["chatId", "count"],
    });

    // 3. Fetch last message for each friend
    const lastMessages = await Promise.all(
      friendIds.map(async (friendId) => {
        try {
          const lastMessage = await Message.findOne({
            where: {
              [Op.or]: [
                { senderId: userId, receiverId: friendId },
                { senderId: friendId, receiverId: userId },
              ],
            },
            order: [["createdAt", "DESC"]],
            include: [
              {
                model: User,
                as: "Sender", // Correct alias
                attributes: ["id", "name", "img"],
              },
            ],
          });

          return { friendId: friendId, lastMessage: lastMessage };
        } catch (error) {
          console.error(
            `Error fetching last message for friend ${friendId}:`,
            error
          );
          return { friendId: friendId, lastMessage: null };
        }
      })
    );

    // 4. Create maps for easy lookup
    const countMap = unreadCounts.reduce((map, item) => {
      map[item.chatId] = item.count;
      return map;
    }, {});

    const lastMessageMap = lastMessages.reduce((map, item) => {
      map[item.friendId] = item.lastMessage;
      return map;
    }, {});

    // 5. Combine the friend data with their unread count and last message
    const friendsWithData = friendsList.map((friend) => {
      const lastMessage = lastMessageMap[friend.id];

      // Fix: Generate proper placeholder based on actual name
      let userImg = friend.img;

      // If it's the default placeholder with 'U', create a personalized one
      if (
        userImg &&
        userImg.includes("placehold.co") &&
        userImg.includes("text=U")
      ) {
        const firstLetter = friend.name ? friend.name[0].toUpperCase() : "U";
        userImg = `https://placehold.co/50x50/695cfe/ffffff?text=${firstLetter}`;
      }
      // If no image exists, create personalized placeholder
      else if (!userImg) {
        const firstLetter = friend.name ? friend.name[0].toUpperCase() : "U";
        userImg = `https://placehold.co/50x50/695cfe/ffffff?text=${firstLetter}`;
      }

      return {
        ...friend.toJSON(),
        img: userImg,
        unreadCount: countMap[friend.id] || 0,
        messages: lastMessage ? [lastMessage] : [],
        lastMessage: lastMessage,
      };
    });

    console.log(
      "Friends data sample:",
      JSON.stringify(friendsWithData[0], null, 2)
    );
    res.status(200).json({ friends: friendsWithData });
  } catch (error) {
    console.error("Error fetching friends:", error);
    res.status(500).json({ message: "Failed to fetch friends list." });
  }
};

// GET /api/contacts/received/requests
const getReceivedRequests = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const contacts = await Contact.findAll({
      where: {
        status: "pending",
        addresseeId: currentUserId,
      },
      include: [
        {
          model: User,
          as: "Requester", // Correct alias
          attributes: ["id", "name", "email", "img", "status"],
        },
      ],
    });

    const receivedRequests = contacts.map((contact) => ({
      ...contact.Requester.toJSON(),
      Contact: { id: contact.id },
    }));

    res.status(200).json({ receivedRequests });
  } catch (error) {
    console.error("Error fetching received requests:", error);
    res.status(500).json({ message: "Failed to fetch received requests." });
  }
};

// GET /api/contacts/sent/requests
const getSentRequests = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const contacts = await Contact.findAll({
      where: {
        status: "pending",
        requesterId: currentUserId,
      },
      include: [
        {
          model: User,
          as: "Addressee", // Correct alias
          attributes: ["id", "name", "email", "img", "status"],
        },
      ],
    });

    const sentRequests = contacts.map((contact) => ({
      ...contact.Addressee.toJSON(),
      Contact: { id: contact.id },
    }));

    res.status(200).json({ sentRequests });
  } catch (error) {
    console.error("Error while fetching sent requests:", error);
    res.status(500).json({ message: "An internal server error occurred" });
  }
};

// GET /api/contacts/friends/blocked
const getBlockedUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const contacts = await Contact.findAll({
      where: {
        status: "blocked",
        requesterId: currentUserId,
      },
      include: [
        {
          model: User,
          as: "Addressee", // Correct alias
          attributes: ["id", "name", "email", "img", "status"],
        },
      ],
    });
    // Filter out any null 'addressee' records (if user was deleted)
    const blockedUsers = contacts
      .map((contact) => contact.Addressee)
      .filter(Boolean);
    res.status(200).json({ blockedUsers });
  } catch (error) {
    console.error("Error while fetching blocked users:", error);
    res.status(500).json({ message: "An internal server error occurred" });
  }
};

// GET /api/contacts/friends/suggestions
const getAvailableUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const contacts = await Contact.findAll({
      where: {
        [Op.or]: [
          { requesterId: currentUserId },
          { addresseeId: currentUserId },
        ],
      },
      attributes: ["requesterId", "addresseeId"],
    });

    const relatedUserIds = contacts.flatMap((contact) => [
      contact.requesterId,
      contact.addresseeId,
    ]);
    const exclusionList = [...new Set([currentUserId, ...relatedUserIds])];

    const availableUsers = await User.findAll({
      where: {
        id: { [Op.notIn]: exclusionList },
      },
      attributes: ["id", "name", "email", "img"],
    });

    res.status(200).json({ availableUsers });
  } catch (error) {
    console.error("Error while fetching available users:", error);
    res.status(500).json({ message: "An internal server error occurred" });
  }
};

// POST /api/contacts/send-request/:userId
const sendFriendRequest = async (req, res) => {
  try {
    const io = req.app.get("socketio"); // Define io
    const requesterId = req.user.id;
    const addresseeId = parseInt(req.params.userId, 10);

    if (requesterId === addresseeId) {
      return res
        .status(400)
        .json({ message: "You cannot send a friend request to yourself" });
    }
    const addressee = await User.findByPk(addresseeId);
    if (!addressee) {
      return res
        .status(400)
        .json({ message: "The user you are trying to add does not exist" });
    }
    const existingContact = await Contact.findOne({
      where: {
        [Op.or]: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });
    if (existingContact) {
      if (existingContact.status === "accepted") {
        return res
          .status(409)
          .json({ message: "You are already friends with this user" });
      }
      return res
        .status(409)
        .json({ message: "A friend request already exists" });
    }

    const newRequest = await Contact.create({
      requesterId,
      addresseeId,
      status: "pending",
    });

    const sender = await User.findByPk(requesterId, {
      attributes: ["id", "name", "img", "email", "status"],
    });
    const recipientRoom = `user_${addresseeId}`;
    io.to(recipientRoom).emit("newFriendRequest", {
      ...sender.toJSON(),
      Contact: { id: newRequest.id },
    });

    res.status(201).json({
      message: "Friend request sent successfully.",
      request: newRequest,
    });
  } catch (error) {
    console.error("Error sending friend request:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};

// POST /api/contacts/accept/:requestId or /decline/:requestId
const updateFriendRequest = async (req, res) => {
  try {
    const io = req.app.get("socketio"); // Define io
    const currentUserId = req.user.id;
    const requestId = parseInt(req.params.requestId, 10);
    const { action } = req.body;

    if (!["accept", "decline"].includes(action)) {
      return res
        .status(400)
        .json({ message: "Invalid action. Must be 'accept' or 'decline'." });
    }
    const request = await Contact.findByPk(requestId);
    if (!request) {
      return res.status(404).json({ message: "Friend request not found." });
    }
    if (request.addresseeId !== currentUserId) {
      return res.status(403).json({
        message: "You are not authorized to respond to this request.",
      });
    }
    if (request.status !== "pending") {
      return res
        .status(409)
        .json({ message: "This request has already been responded to." });
    }

    if (action === "accept") {
      request.status = "accepted";
      await request.save();

      // Get details for both users
      const acceptor = await User.findByPk(currentUserId, {
        attributes: ["id", "name", "email", "img", "isOnline", "status"],
      });
      const sender = await User.findByPk(request.requesterId, {
        attributes: ["id", "name", "email", "img", "isOnline", "status"],
      });

      // 1. Notify the ORIGINAL SENDER (they get the acceptor as a new friend)
      const senderRoom = `user_${request.requesterId}`;
      io.to(senderRoom).emit("friendRequestAccepted", {
        message: `You are now friends with ${acceptor.name}`,
        newFriend: {
          ...acceptor.toJSON(), // Full user object
          type: "individual",
          unreadCount: 0,
          lastMessage: null,
          messages: [],
        },
      });

      // 2. Notify the ACCEPTOR (this user) (they get the sender as a new friend)
      const acceptorRoom = `user_${currentUserId}`;
      io.to(acceptorRoom).emit("newFriendAdded", {
        message: `You are now friends with ${sender.name}`,
        newFriend: {
          ...sender.toJSON(), // Full user object
          type: "individual",
          unreadCount: 0,
          lastMessage: null,
          messages: [],
        },
      });

      return res
        .status(200)
        .json({ message: "Friend request accepted.", contact: request });
    } else {
      // action === 'decline'
      await request.destroy();
      const senderRoom = `user_${request.requesterId}`;
      io.to(senderRoom).emit("friendRequestDeclined", { requestId: requestId });
      return res.status(200).json({ message: "Friend request declined." });
    }
  } catch (error) {
    console.error("Error updating friend request:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};

// POST /api/contacts/unfriend/:userId
const removeFriend = async (req, res) => {
  try {
    const io = req.app.get("socketio"); // Define io
    const currentUserId = req.user.id;
    const friendId = parseInt(req.params.userId, 10);
    const friendship = await Contact.findOne({
      where: {
        status: "accepted",
        [Op.or]: [
          { requesterId: currentUserId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: currentUserId },
        ],
      },
    });

    if (!friendship) {
      return res
        .status(404)
        .json({ message: "You are not friends with this user." });
    }
    await friendship.destroy();
    const friendRoom = `user_${friendId}`;
    io.to(friendRoom).emit("friendRemoved", { friendId: currentUserId });
    res.status(200).json({ message: "Friend removed successfully." });
  } catch (error) {
    console.error("Error removing friend:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};

// POST /api/contacts/block/:userId
const blockUser = async (req, res) => {
  try {
    const io = req.app.get("socketio"); // Define io
    const requesterId = req.user.id;
    const addresseeId = parseInt(req.params.userId, 10);

    if (requesterId === addresseeId) {
      return res.status(400).json({ message: "You cannot block yourself." });
    }
    const addressee = await User.findByPk(addresseeId);
    if (!addressee) {
      return res
        .status(404)
        .json({ message: "The user you are trying to block does not exist." });
    }

    const existingContact = await Contact.findOne({
      where: {
        [Op.or]: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });

    if (existingContact) {
      existingContact.requesterId = requesterId;
      existingContact.addresseeId = addresseeId;
      existingContact.status = "blocked";
      await existingContact.save();
      res.status(200).json({
        message: "User blocked successfully.",
        contact: existingContact,
      });
    } else {
      const newBlockedContact = await Contact.create({
        requesterId,
        addresseeId,
        status: "blocked",
      });
      const blockedUserRoom = `user_${addresseeId}`;
      io.to(blockedUserRoom).emit("youWereBlocked", { byUser: requesterId });
      res.status(201).json({
        message: "User blocked successfully.",
        contact: newBlockedContact,
      });
    }
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};

// POST /api/contacts/cancel-request/:requestId
const cancelRequest = async (req, res) => {
  try {
    const io = req.app.get("socketio"); // Define io
    const requesterId = req.user.id;
    const requestId = parseInt(req.params.requestId, 10);

    const request = await Contact.findOne({
      where: { id: requestId, requesterId: requesterId, status: "pending" },
    });

    if (!request) {
      return res.status(404).json({
        message: "Request not found or you are not authorized to cancel it.",
      });
    }
    const addresseeId = request.addresseeId;
    await request.destroy();
    const recipientRoom = `user_${addresseeId}`;
    io.to(recipientRoom).emit("friendRequestCancelled", {
      requestId: requestId,
    });
    res.status(200).json({ message: "Friend request cancelled." });
  } catch (error) {
    console.error("Error cancelling request:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// POST /api/contacts/unblock/:userId
const unblockUser = async (req, res) => {
  try {
    const io = req.app.get("socketio"); // Define io
    const currentUserId = req.user.id;
    const blockedUserId = parseInt(req.params.userId, 10);

    const contact = await Contact.findOne({
      where: {
        requesterId: currentUserId,
        addresseeId: blockedUserId,
        status: "blocked",
      },
    });

    if (!contact) {
      return res
        .status(401)
        .json({ message: "Blocked relationship not found." });
    }

    await contact.destroy();
    const unblockedUserRoom = `user_${blockedUserId}`;
    io.to(unblockedUserRoom).emit("youWereUnblocked", {
      byUser: currentUserId,
    });
    res.status(200).json({ message: "User unblocked successfully." });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  getFriends,
  getReceivedRequests,
  getSentRequests,
  getBlockedUsers,
  getAvailableUsers,
  sendFriendRequest,
  updateFriendRequest,
  removeFriend,
  blockUser,
  cancelRequest,
  unblockUser,
};
