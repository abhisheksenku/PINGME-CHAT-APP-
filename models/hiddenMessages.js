// Import the necessary components from the Sequelize library
const { DataTypes } = require('sequelize');
// Import the configured Sequelize instance (your database connection)
const sequelize = require('../utilities/sql');

/**
 * Defines the 'HiddenMessage' model.
 * This model acts as a "join table" to track which messages a user
 * has hidden for themselves (i.e., "Delete for Me").
 *
 * When a user "deletes for me," we don't actually delete the message.
 * Instead, we create a record in this table linking that 'userId'
 * and 'messageId'.
 *
 * When fetching messages for that user, we will join this table
 * and filter out any messages that have an entry here.
 */
const HiddenMessage = sequelize.define('HiddenMessage', {
  // This model doesn't need its own 'id' primary key.
  // The 'userId' and 'messageId' foreign keys will be added
  // by Sequelize during the association step, and together
  // they will form a composite primary key.
}, {
  // 'timestamps: false' is set because we don't need to know
  // *when* a message was hidden, just *that* it is hidden.
  // This saves a small amount of database space and overhead.
  timestamps: false
});

// Export the initialized 'HiddenMessage' model
module.exports = HiddenMessage;