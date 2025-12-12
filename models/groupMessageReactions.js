const { DataTypes } = require('sequelize');
const sequelize = require('../utilities/sql');

const GroupMessageReaction = sequelize.define('GroupMessageReaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  reaction: {
    type: DataTypes.STRING(50),
    allowNull: false,
  }
}, { 
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'groupMessageId', 'reaction']
    }
  ]
});

module.exports = GroupMessageReaction;