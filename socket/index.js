// socket/index.js
const { Server } = require("socket.io");
const socketAuth = require("./middleware");
const { GroupMember } = require("../models/associations"); // Used to find user's groups

// Import all the handlers we will create
// (It's okay if these files don't exist yet, we're just setting up)
const messageHandler = require("./handlers/messageHandler");
const reactionHandler = require("./handlers/reactionHandler");
const typingHandler = require("./handlers/typingHandler");
const roomHandler = require("./handlers/roomHandler");
const statusHandler = require("./handlers/statusHandler");

const userSocketMap = new Map();

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.userSocketMap = userSocketMap;
  socketAuth(io);

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    console.log(`✅ User ${userId} connected with socket ID: ${socket.id}`);

    // --- INITIALIZE SOCKET PROPERTIES ---
    socket.currentChatId = null;
    socket.currentChatType = null;

    // --- ADD ACTIVE CHAT TRACKING HERE ---
    socket.on("userViewingChat", (payload) => {
      const { chatId, chatType } = payload;
      socket.currentChatId = chatId;
      socket.currentChatType = chatType;
      console.log(`👀 User ${userId} is viewing ${chatType} chat: ${chatId}`);
    });

    socket.on("userLeftChat", () => {
      console.log(
        `🚪 User ${userId} left chat view (was: ${socket.currentChatType} chat ${socket.currentChatId})`
      );
      socket.currentChatId = null;
      socket.currentChatType = null;
    });

    // --- EXISTING CONNECTION LOGIC ---
    userSocketMap.set(userId, socket.id);
    socket.join(`user_${userId}`);
    setTimeout(() => {
      io.emit("userOnline", { userId: userId });
    }, 100);

    try {
      const memberships = await GroupMember.findAll({
        where: { userId: userId },
        attributes: ["groupId"],
      });

      memberships.forEach((member) => {
        const groupRoom = `group_${member.groupId}`;
        socket.join(groupRoom);
        console.log(`User ${userId} joined room: ${groupRoom}`);
      });
    } catch (error) {
      console.error(`Failed to join group rooms for user ${userId}`, error);
    }

    // --- REGISTER HANDLERS ---
    messageHandler(socket, io);
    reactionHandler(socket, io);
    typingHandler(socket, io);
    roomHandler(socket, io);
    statusHandler(socket, io);

    // --- DISCONNECT LOGIC ---
    socket.on("disconnect", (reason) => {
      console.log(
        `❌ User ${userId} disconnected: ${socket.id} (Reason: ${reason})`
      );
      userSocketMap.delete(userId);
      io.emit("userOffline", { userId: userId });
    });
  });

  return io;
}

// Export as { initializeSocket } to match app.js
module.exports = { initializeSocket };
