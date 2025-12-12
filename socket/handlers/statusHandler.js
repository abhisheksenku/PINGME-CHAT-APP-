// socket/handlers/statusHandler.js
const { Op } = require("sequelize");
const { Message, UnreadCount } = require("../../models/associations");

/**
 * Registers handlers for user status, presence, and read receipts.
 * @param {Socket} socket - The individual client socket.
 * @param {Server} io - The Socket.IO server instance.
 */
module.exports = (socket, io) => {
  const userId = socket.userId;

  /**
   * Fired when a user opens *any* chat (1-to-1 or group).
   * This updates the database and notifies other users if needed.
   */
  socket.on("markChatAsRead", async (payload) => {
    const { chatId, chatType } = payload;
    if (!chatId || !chatType) return;

    try {
      if (chatType === "individual") {
        // --- 1-to-1 Logic ---
        const otherUserId = chatId;

        // 1. Update all messages *from* them *to* us as "read"
        await Message.update(
          { status: "read" },
          {
            where: {
              senderId: otherUserId,
              receiverId: userId,
              status: { [Op.ne]: "read" },
            },
          }
        );
        // This resets the unread count in the DB
        const affectedRows = await UnreadCount.destroy({
          where: {
            userId: userId,
            chatId: otherUserId, // For 1-to-1, the chatID is the other user's ID
            chatType: "individual",
          },
        });
        if (affectedRows > 0) {
          console.log(
            `✅ SERVER: Reset 1-to-1 unread count for user ${userId} (chat with ${otherUserId})`
          );
        }
        // 2. Notify the other user's room that we've read their messages
        // This makes their "sent" ticks turn into "read" ticks.
        io.to(`user_${otherUserId}`).emit("messagesRead", {
          chatId: userId, // The chat *they* have open with *us*
          readBy: userId,
        });
      } else if (chatType === "group") {
        const groupId = chatId;
        const affectedRows = await UnreadCount.destroy({
          where: { userId: userId, chatId: groupId, chatType: "group" },
        }); // --- ADD THIS LOG ---

        if (affectedRows > 0) {
          console.log(
            `✅ SERVER: Reset group unread count for user ${userId} (group ${groupId})`
          );
        } // --- END LOG ---
        io.to(`user_${userId}`).emit("unreadCountUpdate", {
          chatId: groupId,
          newCount: 0,
        });
      }
    } catch (error) {
      console.error(
        `Error marking chat as read (Type: ${chatType}, ID: ${chatId}):`,
        error
      );
    }
  });
};
