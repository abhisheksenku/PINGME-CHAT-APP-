// socket/handlers/reactionHandler.js
const {
  MessageReaction,
  GroupMessageReaction,
} = require("../../models/associations");

module.exports = (socket, io) => {
  const userId = socket.userId;

  socket.on("addReaction", async (payload) => {
    try {
      const { messageId, reaction, chatType, receiverId, groupId } = payload;
      let recipientRoom;

      if (chatType === "individual") {
        await MessageReaction.findOrCreate({
          where: { messageId: messageId, userId: userId, reaction: reaction },
          defaults: { messageId: messageId, userId: userId, reaction: reaction },
        });
        // FIX: Use underscore to match messageHandler
        recipientRoom = `user_${receiverId}`;
        io.to(recipientRoom).to(`user_${userId}`).emit("reactionAdded", { messageId, reaction, userId });
      } else {
        await GroupMessageReaction.findOrCreate({
          where: { groupMessageId: messageId, userId: userId, reaction: reaction },
          defaults: { groupMessageId: messageId, userId: userId, reaction: reaction },
        });
        // FIX: Use underscore to match messageHandler
        recipientRoom = `group_${groupId}`;
        io.to(recipientRoom).emit("reactionAdded", { messageId, reaction, userId });
      }
    } catch (error) {
      console.error("Error in addReaction:", error);
    }
  });

  socket.on("removeReaction", async (payload) => {
    try {
      const { messageId, reaction, chatType, receiverId, groupId } = payload;
      let recipientRoom;

      if (chatType === "individual") {
        await MessageReaction.destroy({
          where: { messageId: messageId, userId: userId, reaction: reaction },
        });
        // FIX: Use underscore
        recipientRoom = `user_${receiverId}`;
        io.to(recipientRoom).to(`user_${userId}`).emit("reactionRemoved", { messageId, reaction, userId });
      } else {
        await GroupMessageReaction.destroy({
          where: { groupMessageId: messageId, userId: userId, reaction: reaction },
        });
        // FIX: Use underscore
        recipientRoom = `group_${groupId}`;
        io.to(recipientRoom).emit("reactionRemoved", { messageId, reaction, userId });
      }
    } catch (error) {
      console.error("Error in removeReaction:", error);
    }
  });
};