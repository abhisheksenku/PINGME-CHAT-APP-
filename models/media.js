const { DataTypes } = require('sequelize');
const sequelize = require('../utilities/sql');

/**
 * Defines the 'Media' model.
 * This table stores a single record for every file uploaded,
 * regardless of how many times it's shared.
 */
const Media = sequelize.define('Media', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  
  // This will be the public URL or path, e.g., '/uploads/123-abc.jpg'
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  
  // e.g., 'image/jpeg', 'video/mp4', 'application/pdf'
  mimetype: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  
  // Store the file size in bytes
  fileSize: {
    type: DataTypes.BIGINT, // Use BIGINT for large files
    allowNull: true,
  },
  
  // Store the original name of the file
  originalName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  
  // 'uploadedByUserId' (Foreign Key) will be added by associations
}, {
  timestamps: true, // Adds createdAt/updatedAt
});

module.exports = Media;