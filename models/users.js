// Imports 'DataTypes' object from the Sequelize library
// 'DataTypes' provides different column data types like STRING, INTEGER, BOOLEAN, etc.
// Note: require() is executed immediately, not hoisted
const { DataTypes } = require("sequelize");

// Imports the Sequelize instance (configured connection) from the utilities/sql file
// This instance connects your models to the database
const sequelize = require("../utilities/sql");

// Defines a Sequelize model named "User" linked to a table called 'Users' (auto pluralized by Sequelize)
const User = sequelize.define(
  "User", // Model name — Sequelize will manage it as a table
  {
    // Unique numeric identifier for each user
    id: {
      type: DataTypes.INTEGER,       // Integer type column
      autoIncrement: true,           // Automatically increases with each new user
      primaryKey: true,              // Marks as primary key
      allowNull: false,              // Cannot be null
    },

    // Stores user's name
    name: {
      type: DataTypes.STRING,        // Variable-length text
      allowNull: false,              // Required field
    },

    // Stores unique user email (used for login/identification)
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,                  // Prevents duplicate email entries
    },

    // Stores user's phone number
    phone: {
      type: DataTypes.STRING(15),    // String limited to 15 characters
      allowNull: false,
    },

    // Stores hashed user password
    password: {
      type: DataTypes.TEXT,          // Longer text field, since hashed passwords can be long
      allowNull: false,
    },

    // Stores user's profile image URL (optional)
    img: {
      type: DataTypes.STRING,
      allowNull: true,               // Can be null
      defaultValue: "https://placehold.co/50x50/cccccc/ffffff?text=U", // Default placeholder image
    },

    // Boolean flag to track user's connection state (true if user is online)
    isOnline: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // Short bio or description for the user (optional)
    about: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Enum field to explicitly store "Online" or "Offline" user status
    status: {
      type: DataTypes.ENUM("Online", "Offline"),
      defaultValue: "Offline",       // Default status
    },

    // Token used for password reset functionality (optional)
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Expiration date/time for the reset token
    resetTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },

  // Model configuration options
  {
    timestamps: true,                // Automatically adds createdAt and updatedAt fields
  }
);

// Exports the User model so it can be imported in other files (like associations or controllers)
module.exports = User;
