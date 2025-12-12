// Import the necessary components from the Sequelize library
const { DataTypes } = require("sequelize");
// Import the configured Sequelize instance (your database connection)
const sequelize = require("../utilities/sql");

/**
 * Defines the 'Status' model, representing a single status update
 * (like a story) posted by a user.
 * Sequelize will pluralize this to 'Statuses' for the table name.
 */
const Status = sequelize.define(
  "Status",
  {
    // --- Primary Key ---
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true, // This is the unique identifier for each status row
      autoIncrement: true,
      allowNull: false,
    },

    // --- Status Type ---
    type: {
      type: DataTypes.ENUM("text", "image"), // Defines the type of content
      allowNull: false,
    },

    // --- Status Content ---
    content: {
      type: DataTypes.TEXT, // Using TEXT is flexible: it can hold a long string (for text) or a URL (for images)
      allowNull: false,
    },

    // --- Expiration ---
    expiresAt: {
      type: DataTypes.DATE, // Stores the exact date and time when this status should no longer be visible
      allowNull: false, // Every status must have an expiration
    },

    // A 'userId' foreign key will be added automatically by Sequelize
    // when the User.hasMany(Status) association is defined.
  },
  {
    // --- Model Options ---

    // 'timestamps: true' automatically adds 'createdAt' and 'updatedAt' fields.
    // 'createdAt' is very useful here, as it tells us when the status was posted.
    timestamps: true,
  }
);

// Export the initialized 'Status' model
module.exports = Status;