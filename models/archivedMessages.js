const { Model, DataTypes } = require("sequelize");
const sequelize = require("../utilities/sql");

class ArchivedMessage extends Model {}

ArchivedMessage.init(
  {
    // --- Primary Key ---
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true, // Must be the original ID from the Message table
      allowNull: false,
      autoIncrement: false, // DO NOT auto-increment
    },

    // --- Context (Missing from your original) ---
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // --- Message Content ---
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // --- Message Type ---
    type: {
      type: DataTypes.ENUM("text", "image", "file", "media"), // Match all types from Message model
      defaultValue: "text",
    },
    mediaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // --- Message Status ---
    status: {
      type: DataTypes.ENUM("sent", "delivered", "read"),
      defaultValue: "sent",
    },

    // --- Reply Reference ---
    parentMessageId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Just store the ID, no foreign key
    },
    
    // --- Original Timestamps ---
    createdAt: {
      type: DataTypes.DATE,
    },
    updatedAt: {
      type: DataTypes.DATE,
    }
  },
  {
    sequelize,
    modelName: "ArchivedMessage",
    timestamps: false, // We manually copy the original timestamps
    freezeTableName: true,
  }
);

module.exports = ArchivedMessage;