const { Model, DataTypes } = require("sequelize");
const sequelize = require("../utilities/sql");

class ArchivedGroupMessage extends Model {}

ArchivedGroupMessage.init(
  {
    // --- Primary Key ---
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true, // Must be the original ID from the GroupMessage table
      allowNull: false,
      autoIncrement: false, // DO NOT auto-increment
    },

    // --- Context (Missing from your original) ---
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    groupId: {
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
      type: DataTypes.ENUM("text", "image", "file", "media"), // Match all types
      defaultValue: 'text',
    },
    mediaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    modelName: 'ArchivedGroupMessage',
    timestamps: false, // We manually copy the original timestamps
    freezeTableName: true,
  }
);

module.exports = ArchivedGroupMessage;