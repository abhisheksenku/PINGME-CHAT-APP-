const { DataTypes } = require('sequelize');
const sequelize = require('../utilities/sql');

// This model links a user to a group message they want to hide
const HiddenGroupMessage = sequelize.define('HiddenGroupMessage', {
  // Composite primary key will be defined in associations
}, { timestamps: false });

module.exports = HiddenGroupMessage;