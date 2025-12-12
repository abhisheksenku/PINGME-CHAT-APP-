const { Op } = require("sequelize");
const {
  User,
  Message,
  MessageReaction,
  HiddenMessage,
  Media
} = require("../models/associations");
const { uploadToS3 } = require('../services/s3Service');
const {io} = require('../app');
const fs = require('fs/promises');
const path = require('path');
require("dotenv").config();

const getConversation = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = parseInt(req.params.userId, 10);
    const { before } = req.query; // 'since' is no longer needed

    // 1. Get IDs of messages this user has hidden
    const hiddenMessages = await HiddenMessage.findAll({
      where: { userId: currentUserId },
      attributes: ["messageId"],
    });
    const hiddenMessageIds = hiddenMessages.map((h) => h.messageId);

    // 2. Build the query
    const whereClause = {
      [Op.or]: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
      id: { [Op.notIn]: hiddenMessageIds },
    };

    // 3. Add infinite scroll logic
    if (before) {
      whereClause.id = { [Op.lt]: parseInt(before, 10) };
    }

    // 4. Find all messages
    const messages = await Message.findAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: 20, // Load 20 messages at a time
      include: [
        { model: User, as: "Sender", attributes: ["id", "name", "img"] },
        { model: MessageReaction, include: [User] }, // Include reactions
        { model: Media, as: "Media" }, // <-- Include Media data
      ],
    });

    res.status(200).json(messages.reverse()); // Send oldest first
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};
// controllers/chatController.js
const getChatListWithLastMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // 1. Get all friends
    const friends = await User.findAll({
      include: [{
        model: User,
        as: 'Friends',
        through: { where: { userId: currentUserId } },
        attributes: ['id', 'name', 'email', 'img', 'isOnline'],
        through: { attributes: [] } // Don't include friendship table data
      }]
    });

    // 2. For each friend, get the last message
    const friendsWithLastMessage = await Promise.all(
      friends.map(async (friend) => {
        const lastMessage = await Message.findOne({
          where: {
            [Op.or]: [
              { senderId: currentUserId, receiverId: friend.id },
              { senderId: friend.id, receiverId: currentUserId }
            ]
          },
          order: [['createdAt', 'DESC']],
          include: [
            { model: User, as: "Sender", attributes: ["id", "name"] }
          ]
        });

        // 3. Get unread count for this chat
        const unreadCount = await Message.count({
          where: {
            senderId: friend.id,
            receiverId: currentUserId,
            status: 'sent' // Or whatever field you use for read status
          }
        });

        return {
          id: friend.id,
          name: friend.name,
          email: friend.email,
          img: friend.img,
          isOnline: friend.isOnline,
          type: 'individual',
          lastMessage: lastMessage,
          unreadCount: unreadCount
        };
      })
    );

    res.status(200).json(friendsWithLastMessage);
  } catch (error) {
    console.error("Error fetching chat list:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};
// ==========================================================
// NEW: POST /api/chat/add-file
// This "catches" the file upload from the client.
// ==========================================================
// const sendFile = async (req, res) => {
//   try {
//     const senderId = req.user.id;
//     const { receiverId } = req.body;

//     // 1. Validation
//     if (!req.file) {
//       return res.status(400).json({ message: "No file was uploaded." });
//     }
//     if (!receiverId) {
//       return res.status(400).json({ message: "Receiver ID is required." });
//     }

//     // 2. Create the Media record (based on our new schema)
//     const newMedia = await Media.create({
//       url: `/uploads/${req.file.filename}`, // Path from multer
//       mimetype: req.file.mimetype,
//       fileSize: req.file.size,
//       originalName: req.file.originalname,
//       uploadedByUserId: senderId,
//     });

//     // 3. Create the Message, linking to the Media
//     const newMessage = await Message.create({
//       senderId,
//       receiverId: parseInt(receiverId, 10),
//       type: "media", // Use our new 'media' type
//       mediaId: newMedia.id, // Link to the new media
//       message: req.file.originalname, // Store original name
//       status: "sent",
//     });

//     // 4. Fetch the full message with Sender and Media info
//     const messageWithDetails = await Message.findByPk(newMessage.id, {
//       include: [
//         { model: User, as: "Sender", attributes: ["id", "name", "img"] },
//         { model: Media, as: "Media" }, // Include the Media data
//       ],
//     });

//     // --- WEBSOCKET NOTIFICATION ---
//     const io = req.app.get("socketio");
//     const recipientRoom = `user_${receiverId}`;
//     const senderRoom = `user_${senderId}`;

//     // 5. Emit the new message to the recipient *and* the sender
//     // (This notifies the sender's *other* devices, e.g., their phone)
//     io.to(recipientRoom)
//       .to(senderRoom)
//       .emit("newMessage", messageWithDetails.toJSON());
//     // --- END WEBSOCKET NOTIFICATION ---

//     // 6. Send the new message back to the *uploader*
//     res.status(201).json(messageWithDetails);
//   } catch (error) {
//     console.error("Error sending file:", error);
//     res.status(500).json({ message: "An internal server error occurred." });
//   }
// };
const sendFile = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId } = req.body;
    const io = req.app.get('socketio'); // Get Socket.IO

    // 1. Validation
    if (!req.file) {
      return res.status(400).json({ message: 'No file was uploaded.' });
    }
    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required.' });
    }

    let fileURL;

    // 2. Upload Logic (Hybrid)
    if (process.env.NODE_ENV === 'production') {
      // --- PRODUCTION: Upload to S3 ---
      const localFilePath = req.file.path;
      const fileData = await fs.readFile(localFilePath);
      const s3FileName = `chats/user_${senderId}/media/${req.file.filename}`;

      fileURL = await uploadToS3(fileData, s3FileName, req.file.mimetype);
      
      // Clean up the local file
      await fs.unlink(localFilePath);
      
    } else {
      // --- DEVELOPMENT: Use Local URL ---
      console.log("DEBUG: APP_BASE_URL is:", process.env.APP_BASE_URL);
      const localPath = req.file.path.replace(/\\/g, '/'); // Fix Windows paths
      fileURL = `${process.env.APP_BASE_URL}/${localPath}`;
    }

    // 3. Create Media & Message records in database
    const newMedia = await Media.create({
      url: fileURL,
      mimetype: req.file.mimetype,
      fileSize: req.file.size,
      originalName: req.file.originalname,
      uploadedByUserId: senderId,
    });

    const newMessage = await Message.create({
      senderId,
      receiverId: parseInt(receiverId, 10),
      type: req.file.mimetype.startsWith("image") ? "image" : "file",
      mediaId: newMedia.id,
      message: req.file.originalname, // Store original name
      status: "sent",
    });

    // 4. Fetch full details to send to sockets
    const messageWithDetails = await Message.findByPk(newMessage.id, {
      include: [
        { model: User, as: "Sender", attributes: ["id", "name", "img"] },
        { model: Media, as: "Media" } // Ensure this alias matches associations.js
      ],
    });

    // 5. Emit real-time update
    const recipientRoom = `user_${receiverId}`;
    const senderRoom = `user_${senderId}`;
    io.to(recipientRoom).to(senderRoom).emit("newMessage", messageWithDetails.toJSON());

    // 6. Respond to the uploader
    res.status(201).json(messageWithDetails);

  } catch (error) {
    console.error("Error sending file:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};
module.exports = {
  getConversation,
  sendFile,
  getChatListWithLastMessages
};
