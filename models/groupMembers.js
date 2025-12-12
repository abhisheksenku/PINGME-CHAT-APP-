const { DataTypes } = require("sequelize");
const sequelize = require("../utilities/sql");

const GroupMember = sequelize.define("GroupMember", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM("admin", "member"),
    defaultValue: "member",
  },
}, {
  timestamps: true, // Adds createdAt (joinedAt) and updatedAt
  paranoid: true
});

module.exports = GroupMember;