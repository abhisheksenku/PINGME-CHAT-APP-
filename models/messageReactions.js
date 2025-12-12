// Import the necessary components from the Sequelize library
const { DataTypes } = require('sequelize');
// Import the configured Sequelize instance (your database connection)
const sequelize = require('../utilities/sql');

/**
 * Defines the 'MessageReaction' model.
 * This table acts as a 'join table' or 'lookup table' to store
 * which user added which reaction to which message.
 */
const MessageReaction = sequelize.define('MessageReaction', {
  // --- Primary Key ---
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },

  // --- Reaction Content ---
  reaction: {
    type: DataTypes.STRING(50), // Sized to store an emoji (which can be multi-byte) or a text code
    allowNull: false, // A reaction must have content
  }
  
  // Foreign keys 'userId' and 'messageId' will be added automatically
  // by Sequelize when we define the associations (e.g., User.hasMany(MessageReaction)).

}, {
  // --- Model Options ---

  // 'timestamps: true' automatically adds 'createdAt' and 'updatedAt' fields.
  // This is useful for knowing *when* a reaction was added.
  timestamps: true,

  // --- Database Indexes ---
  indexes: [
    {
      // This composite unique index is a crucial piece of business logic.
      // It ensures that a single user ('userId') can only add a specific
      // reaction ('reaction') to a specific message ('messageId') *one time*.
      // This prevents a user from adding the same "👍" reaction multiple times
      // to the same message.
      unique: true,
      fields: ['userId', 'messageId', 'reaction']
    }
  ]
});

// Export the initialized 'MessageReaction' model
module.exports = MessageReaction;