// Load environment variables from a .env file into process.env
// This allows you to store sensitive info like DB credentials outside your code
require('dotenv').config(); 

// Import the Sequelize class from the 'sequelize' package
// Sequelize is an ORM (Object-Relational Mapping) library for Node.js
// It allows you to interact with SQL databases using JavaScript objects instead of raw SQL queries
const { Sequelize } = require('sequelize');

// Create a new Sequelize instance to connect to your database
// You pass database name, username, password, and configuration options
const sequelize = new Sequelize(
  process.env.DB_NAME,      // Name of your database (from .env)
  process.env.DB_USER,      // Database username (from .env)
  process.env.DB_PASSWORD,  // Database password (from .env)
  {
    host: process.env.DB_HOST,       // Database host (localhost or remote server)
    dialect: process.env.DB_DIALECT, // Type of database (e.g., 'mysql', 'postgres', 'sqlite')
  }
);

// Immediately Invoked Async Function Expression (IIFE)
// Used to test the database connection as soon as this file is loaded
(async () => {
  try {
    // Test the database connection
    // 'authenticate' tries to connect to the database with the provided credentials
    await sequelize.authenticate();
    console.log('Database connection established successfully.'); // Success message
  } catch (error) {
    // If connection fails, log the error
    console.error('Unable to connect to the database:', error);
  }
})();

// Export the sequelize instance
// This allows other files (like models or routes) to import and use this database connection
module.exports = sequelize;
