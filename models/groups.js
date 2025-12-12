const { DataTypes } = require("sequelize");
const sequelize = require("../utilities/sql");

const Group = sequelize.define(
  "Group",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    img: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Foreign key to link to the User who created the group
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users", // table name
        key: "id",
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    inviteSetting: {
      type: DataTypes.ENUM("admins-only", "all-members"),
      defaultValue: "admins-only",
    },
    messagingSetting: {
      type: DataTypes.ENUM("admins-only", "all-members"),
      defaultValue: "all-members",
    },
    pinnedMessageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "GroupMessages",
        key: "id",
      },
      onDelete: "SET NULL",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Group;
