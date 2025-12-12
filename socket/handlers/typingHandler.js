// socket/handlers/typingHandler.js
const { User } = require("../../models/associations");

const userCache = new Map();

module.exports = (socket, io) => {
  const userId = socket.userId;

  const getUserName = async () => {
    if (userCache.has(userId)) {
      return userCache.get(userId);
    }
    const user = await User.findByPk(userId, { attributes: ["name"] });
    if (user) {
      userCache.set(userId, user.name);
      return user.name;
    }
    return "Someone";
  };

  socket.on("startTyping", async (payload) => {
    try {
      const { chatType, chatId, receiverId } = payload;
      const userName = await getUserName();
      let recipientRoom;
      
      if (chatType === "individual") {
        // FIX: Use underscore
        recipientRoom = `user_${receiverId}`;
      } else {
        // FIX: Use underscore
        recipientRoom = `group_${chatId}`;
      }
      
      socket.broadcast.to(recipientRoom).emit("userIsTyping", {
        chatId: chatType === "group" ? chatId : userId,
        userName: userName,
      });
    } catch (error) {
      console.error("Error in startTyping:", error);
    }
  });

  socket.on("stopTyping", async (payload) => {
    try {
      const { chatType, chatId, receiverId } = payload;
      const userName = await getUserName();
      let recipientRoom;
      
      if (chatType === "individual") {
        // FIX: Use underscore
        recipientRoom = `user_${receiverId}`;
      } else {
        // FIX: Use underscore
        recipientRoom = `group_${chatId}`;
      }
      
      socket.broadcast.to(recipientRoom).emit("userStoppedTyping", {
        chatId: chatType === "group" ? chatId : userId,
        userName: userName,
      });
    } catch (error) {
      console.error("Error in stopTyping:", error);
    }
  });
};