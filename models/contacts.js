// Import the necessary components from the Sequelize library
const { DataTypes } = require('sequelize');
// Import the configured Sequelize instance (your database connection)
const sequelize = require('../utilities/sql');

/**
 * Defines the 'Contact' model.
 * This table is crucial for managing relationships (friendships) between users.
 * A single row represents a relationship initiated by one user (requester)
 * towards another (addressee).
 */
const Contact = sequelize.define('Contact', {
  // --- Primary Key ---
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },

  // --- Relationship Status ---
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'blocked'),
    allowNull: false,
    defaultValue: 'pending', // New relationships start as 'pending' friend requests
  },

  // Foreign keys 'requesterId' (who sent the request) and
  // 'addresseeId' (who received the request) will be added
  // automatically by Sequelize when we define the associations.

}, {
  // --- Model Options ---

  // 'timestamps: true' automatically adds 'createdAt' and 'updatedAt' fields.
  // This is very useful for knowing when a friend request was sent or accepted.
  timestamps: true,

  // --- Database Indexes ---
  indexes: [
    {
      // This composite unique index is the core logic of the model.
      // It ensures that a specific pair of users (requesterId, addresseeId)
      // can only have one entry in the table.
      // This prevents a user from sending multiple friend requests
      // to the same person.
      unique: true,
      fields: ['requesterId', 'addresseeId']
    }
  ]
});

// Export the initialized 'Contact' model
module.exports = Contact;