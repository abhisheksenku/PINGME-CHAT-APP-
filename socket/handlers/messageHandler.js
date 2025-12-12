// socket/handlers/messageHandler.js
const {
  Message,
  GroupMessage,
  User,
  HiddenMessage,
  HiddenGroupMessage,
  GroupMember,
  UnreadCount,
} = require("../../models/associations");
const sequelize = require("../../utilities/sql");
const { Op } = require("sequelize");

/**
 * Message handler for real-time messaging operations
 * Handles sending, editing, and deleting messages for both 1-to-1 and group chats
 */
module.exports = (socket, io) => {
  const userId = socket.userId;
  console.log(`🧩 messageHandler initialized for socket: ${socket.id} (User: ${userId})`);

  /**
   * Handles sending new text messages
   */
  socket.on("sendMessage", async (payload, callback) => {
    // Start a database transaction
    const transaction = await sequelize.transaction();

    try {
      console.log(`[User: ${userId}] 🔵 sendMessage received:`, payload);

      let createdMessage;
      let recipientRoom;
      let unreadChatId;
      let unreadChatType;
      let unreadRecipientId;

      if (payload.receiverId) {
        // --- 1-to-1 Message ---
        console.log(`[User: ${userId}] 📨 Creating 1-to-1 message for receiver: ${payload.receiverId}`);

        // Check if receiver is online and viewing this chat
        const receiverSockets = await io
          .in(`user_${payload.receiverId}`)
          .fetchSockets();
        const isReceiverOnline = receiverSockets.length > 0;
        const isReceiverViewingChat = receiverSockets.some(
          (s) =>
            s.currentChatId === userId &&
            s.currentChatType === "individual"
        );
        
        const initialStatus = isReceiverOnline && isReceiverViewingChat ? "read" : "sent";
        console.log(`[User: ${userId}] 📝 Message initial status set to: ${initialStatus}`);

        createdMessage = await Message.create(
          {
            senderId: userId,
            receiverId: payload.receiverId,
            message: payload.message,
            type: "text",
            status: initialStatus,
          },
          { transaction }
        );

        recipientRoom = `user_${payload.receiverId}`;
        unreadRecipientId = payload.receiverId;
        unreadChatId = userId; // For receiver, chatId is the sender's ID
        unreadChatType = "individual";

      } else if (payload.groupId) {
        // --- Group Message ---
        console.log(`[User: ${userId}] 👥 Creating group message for group: ${payload.groupId}`);

        createdMessage = await GroupMessage.create(
          {
            senderId: userId,
            groupId: payload.groupId,
            message: payload.message,
            type: "text",
          },
          { transaction }
        );

        recipientRoom = `group_${payload.groupId}`;
        unreadChatId = payload.groupId;
        unreadChatType = "group";
      } else {
        throw new Error("No receiverId or groupId provided");
      }

      // Fetch complete message with sender details
      const messageWithSender = await (payload.receiverId
        ? Message.findByPk(createdMessage.id, {
            include: [
              { model: User, as: "Sender", attributes: ["id", "name", "img"] },
            ],
            transaction,
          })
        : GroupMessage.findByPk(createdMessage.id, {
            include: [
              { model: User, as: "Sender", attributes: ["id", "name", "img"] },
            ],
            transaction,
          }));

      console.log(`[User: ${userId}] ✅ Message created in DB: ${messageWithSender.id}`);

      // Broadcast to appropriate recipients
      if (payload.groupId) {
        socket.broadcast
          .to(recipientRoom)
          .emit("newMessage", messageWithSender.toJSON());
        console.log(`[User: ${userId}] 📤 Broadcasted to group room: ${recipientRoom}`);
      } else {
        io.to(recipientRoom).emit("newMessage", messageWithSender.toJSON());
        console.log(`[User: ${userId}] 📤 Emitted to user room: ${recipientRoom}`);
      }

      // Confirm to sender with complete message data
      callback(messageWithSender.toJSON());

      // --- CORRECTED Unread Count Logic ---
      if (unreadChatType === "individual") {
        if (messageWithSender.status !== "read") {
          console.log(`[User: ${userId}] 🔔 Updating 1-to-1 unread count for receiver: ${unreadRecipientId}`);
          
          // 1. Find or Create the record
          const [unread, created] = await UnreadCount.findOrCreate({
            where: {
              userId: unreadRecipientId,
              chatId: unreadChatId,
              chatType: unreadChatType,
            },
            defaults: { count: 1 }, // Start count at 1 if created
            transaction,
          });

          // 2. If it already existed, increment it
          if (!created) {
            await unread.increment('count', { transaction });
          }
          
          // 3. Get the final count
          const finalCount = created ? 1 : unread.count + 1;

          io.to(recipientRoom).emit("unreadCountUpdate", {
            chatId: unreadChatId,
            newCount: finalCount,
          });
          console.log(`[User: ${userId}] 📊 Unread count for ${unreadRecipientId} is now ${finalCount}`);
        } else {
          console.log(`[User: ${userId}] ✅ Receiver is viewing chat, skipping unread increment.`);
          socket.emit("messagesRead", { chatId: payload.receiverId, chatType: "individual" });
        }
      } else if (unreadChatType === "group") {
        console.log(`[User: ${userId}] 🔔 Updating group unread counts for group: ${unreadChatId}`);
        const otherMembers = await GroupMember.findAll({
          where: {
            groupId: unreadChatId,
            userId: { [Op.ne]: userId },
          },
          transaction,
        });

        console.log(`[User: ${userId}] 👥 Found ${otherMembers.length} other members to update.`);

        for (const member of otherMembers) {
          const memberSockets = await io.in(`user_${member.userId}`).fetchSockets();
          const isMemberViewingChat = memberSockets.some(
            (s) =>
              s.currentChatId === payload.groupId &&
              s.currentChatType === "group"
          );

          if (!isMemberViewingChat) {
            const [unread, created] = await UnreadCount.findOrCreate({
              where: {
                userId: member.userId,
                chatId: unreadChatId,
                chatType: unreadChatType,
              },
              defaults: { count: 1 },
              transaction,
            });

            if (!created) {
              await unread.increment('count', { transaction });
            }

            const finalCount = created ? 1 : unread.count + 1;
            io.to(`user_${member.userId}`).emit("unreadCountUpdate", {
              chatId: unreadChatId,
              newCount: finalCount,
            });
            console.log(`[User: ${userId}] 📊 Unread count for member ${member.userId} is now ${finalCount}`);
          } else {
            console.log(`[User: ${userId}] ✅ Member ${member.userId} is viewing chat, skipping unread increment.`);
          }
        }
      }
      // --- END Unread Count Logic ---

      await transaction.commit();
      console.log(`[User: ${userId}] ✅ sendMessage Transaction committed`);

    } catch (error) {
      await transaction.rollback();
      console.error(`[User: ${userId}] ❌ Error in sendMessage, transaction rolled back:`, error);
      callback({ error: "Message could not be sent." });
    }
  });

  /**
   * Handles editing existing messages
   */
  socket.on("editMessage", async (payload) => {
    try {
      console.log(`[User: ${userId}] ✏️ editMessage received:`, payload);
      const { messageId, message, chatType, receiverId, groupId } = payload;
      let recipientRoom;

      if (chatType === "individual") {
        const msg = await Message.findByPk(messageId);
        if (msg && msg.senderId === userId) {
          msg.message = message;
          await msg.save();
          recipientRoom = `user_${receiverId}`; // Use underscore
          io.to(recipientRoom).to(`user_${userId}`).emit("messageEdited", msg.toJSON());
          console.log(`[User: ${userId}] ✅ 1-to-1 message ${messageId} edited and broadcasted.`);
        } else {
          console.log(`[User: ${userId}] ❌ editMessage failed: Message ${messageId} not found or unauthorized.`);
        }
      } else {
        const msg = await GroupMessage.findByPk(messageId);
        if (msg && msg.senderId === userId) {
          msg.message = message;
          await msg.save();
          recipientRoom = `group_${groupId}`; // Use underscore
          io.to(recipientRoom).emit("messageEdited", msg.toJSON());
          console.log(`[User: ${userId}] ✅ Group message ${messageId} edited and broadcasted.`);
        } else {
          console.log(`[User: ${userId}] ❌ editMessage (group) failed: Message ${messageId} not found or unauthorized.`);
        }
      }
    } catch (error) {
      console.error(`[User: ${userId}] ❌ Error in editMessage:`, error);
    }
  });

  /**
   * Handles message deletion (for me or for everyone)
   */
  socket.on("deleteMessage", async (payload) => {
    try {
      console.log(`[User: ${userId}] 🗑️ deleteMessage received:`, payload);
      const { messageId, forEveryone, chatType, receiverId, groupId } = payload;

      if (forEveryone) {
        let recipientRoom;
        if (chatType === "individual") {
          const msg = await Message.findByPk(messageId);
          if (msg && msg.senderId === userId) {
            await msg.destroy();
            recipientRoom = `user_${receiverId}`; // Use underscore
            io.to(recipientRoom).to(`user_${userId}`).emit("messageDeleted", { messageId });
            console.log(`[User: ${userId}] ✅ 1-to-1 message ${messageId} deleted for everyone.`);
          } else {
            console.log(`[User: ${userId}] ❌ deleteMessage failed: Message ${messageId} not found or unauthorized.`);
          }
        } else {
          const msg = await GroupMessage.findByPk(messageId);
          if (msg && msg.senderId === userId) {
            await msg.destroy();
            recipientRoom = `group_${groupId}`; // Use underscore
            io.to(recipientRoom).emit("messageDeleted", { messageId });
            console.log(`[User: ${userId}] ✅ Group message ${messageId} deleted for everyone.`);
          } else {
            console.log(`[User: ${userId}] ❌ deleteMessage (group) failed: Message ${messageId} not found or unauthorized.`);
          }
        }
      } else {
        // Delete for me only
        if (chatType === "individual") {
          await HiddenMessage.findOrCreate({
            where: { userId: userId, messageId: messageId },
          });
          console.log(`[User: ${userId}] ✅ 1-to-1 message ${messageId} hidden for self.`);
        } else {
          await HiddenGroupMessage.findOrCreate({
            where: { userId: userId, groupMessageId: messageId },
          });
          console.log(`[User: ${userId}] ✅ Group message ${messageId} hidden for self.`);
        }
      }
    } catch (error) {
      console.error(`[User: ${userId}] ❌ Error in deleteMessage:`, error);
    }
  });
};