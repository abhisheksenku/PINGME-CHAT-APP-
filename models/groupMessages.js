const { DataTypes } = require("sequelize");
const sequelize = require("../utilities/sql");

const GroupMessage = sequelize.define('GroupMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM('text', 'image', 'file', 'media'),
    defaultValue: 'text',
  },
  // Foreign key for replies, creating a self-referencing relationship
  parentMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'GroupMessages', // table name
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  // This is the Foreign Key that links to the new Media table
  mediaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "Media", // Table name for Media
      key: "id",
    },
    onDelete: "SET NULL",
  }
}, {
  timestamps: true,
  indexes: [
      {
        // This index makes fetching a group's chat instantaneous
        name: "group_chat_index",
        fields: ["groupId", "createdAt"],
      },
    ],
});

module.exports = GroupMessage;