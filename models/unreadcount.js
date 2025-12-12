// Import the necessary components from the Sequelize library
const { DataTypes } = require("sequelize");
// Import the configured Sequelize instance (your database connection)
const sequelize = require("../utilities/sql");

/**
 * Defines the 'UnreadCount' model.
 * This table is a simple and efficient way to track the number of
 * unread messages a user has in each chat.
 *
 * A row in this table means "User X has Y unread messages in Chat Z".
 */
const UnreadCount = sequelize.define(
  "UnreadCount",
  {
    // The 'userId' of the person who has unread messages
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users", // Assumes your User model's table is named 'Users'
        key: "id",
      },
    },
    // The ID of the chat that has unread messages.
    // For 1-to-1 chat, this will be the 'userId' of the *other* person.
    chatId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // The type of chat (we'll only use 'individual' for now)
    chatType: {
      type: DataTypes.STRING, // 'individual' or 'group'
      allowNull: false,
    },
    // The actual number of unread messages
    count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Note: A primary key 'id' is added automatically by default
  },
  {
    // --- Model Options ---
    sequelize, // Pass the connection instance
    modelName: "UnreadCount",
    timestamps: true, // Automatically add createdAt/updatedAt
    indexes: [
      {
        // This composite unique index is the most important part.
        // It ensures there can only be ONE row for a specific
        // user/chat/type combination.
        // This prevents duplicate counters for the same chat.
        unique: true,
        fields: ["userId", "chatId", "chatType"],
      },
    ],
  }
);

module.exports = UnreadCount;