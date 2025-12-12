// ==================
// == IMPORT MODELS ==
// ==================
// Import all the models we need for BOTH 1-to-1 and Group features.
const User = require("./users");
const Message = require("./messages");
const MessageReaction = require("./messageReactions");
const HiddenMessage = require("./hiddenMessages");
const Contact = require("./contacts");
const Status = require("./status"); // Ensure filename matches
const UnreadCount = require("./unreadCount"); // Ensure filename matches
const Media = require("./media");
// --- NEW: Import Group Models ---
const Group = require("./groups");
const GroupMember = require("./groupMembers");
const GroupMessage = require("./groupMessages");
const GroupMessageReaction = require("./groupMessageReactions");
const HiddenGroupMessage = require("./hiddenGroupMessages");

// ======================
// == DEFINE ASSOCIATIONS ==
// ======================

// --- 1-to-1 Chat Associations (Keep these as they are) ---
// --- 1. User <-> Message (1-to-1 Chat) ---
User.hasMany(Message, { foreignKey: "senderId", as: "SentMessages" });
User.hasMany(Message, { foreignKey: "receiverId", as: "ReceivedMessages" });
Message.belongsTo(User, { foreignKey: "senderId", as: "Sender" });
Message.belongsTo(User, { foreignKey: "receiverId", as: "Receiver" });

// --- 2. Message <-> Message (Replies/Threads) ---
Message.hasMany(Message, { foreignKey: "parentMessageId", as: "Replies" });
Message.belongsTo(Message, { foreignKey: "parentMessageId", as: "ParentMessage" });

// --- 3. Message <-> MessageReaction ---
Message.hasMany(MessageReaction, { foreignKey: "messageId" });
MessageReaction.belongsTo(Message, { foreignKey: "messageId" });

// --- 4. User <-> MessageReaction ---
User.hasMany(MessageReaction, { foreignKey: "userId" });
MessageReaction.belongsTo(User, { foreignKey: "userId" });

// --- 5. User <-> Message (via HiddenMessage) ---
User.belongsToMany(Message, { through: HiddenMessage, foreignKey: "userId", as: "HiddenMessages" });
Message.belongsToMany(User, { through: HiddenMessage, foreignKey: "messageId", as: "HiddenByUsers" });

// --- 6. User <-> Contact (Friendship) ---
User.hasMany(Contact, { foreignKey: "requesterId", as: "SentRequests" });
User.hasMany(Contact, { foreignKey: "addresseeId", as: "ReceivedRequests" });
Contact.belongsTo(User, { foreignKey: "requesterId", as: "Requester" });
Contact.belongsTo(User, { foreignKey: "addresseeId", as: "Addressee" });

// --- 7. User <-> Status ---
User.hasMany(Status, { foreignKey: "userId" });
Status.belongsTo(User, { foreignKey: "userId" });

// --- 8. User <-> UnreadCount ---
User.hasMany(UnreadCount, { foreignKey: "userId" });
UnreadCount.belongsTo(User, { foreignKey: "userId" });

// --- NEW: Group Chat Associations ---

// --- 9. Group <-> User (Creator) ---
// A Group belongs to the User who created it
Group.belongsTo(User, {
  foreignKey: "createdBy",
  as: "creator", // Alias for fetching the creator
});
// A User can create many Groups
User.hasMany(Group, {
  foreignKey: "createdBy",
  as: "createdGroups", // Alias for fetching groups created by a user
});

// --- 10. Group <-> User (Members via GroupMember) ---
// This defines the Many-to-Many relationship for membership
User.belongsToMany(Group, {
  through: GroupMember, // The join table model
  foreignKey: "userId",
  otherKey: "groupId", // Specify the other foreign key
  as: "groups", // Alias to get groups a user is in
});
Group.belongsToMany(User, {
  through: GroupMember,
  foreignKey: "groupId",
  otherKey: "userId",
  as: "members", // Alias to get members of a group
});
// Also define the direct relationships with the join table
User.hasMany(GroupMember, { foreignKey: "userId" });
Group.hasMany(GroupMember, { foreignKey: "groupId" });
GroupMember.belongsTo(User, { foreignKey: "userId" });
GroupMember.belongsTo(Group, { foreignKey: "groupId" });

// --- 11. Group <-> GroupMessage ---
// A Group can have many messages
Group.hasMany(GroupMessage, {
  foreignKey: "groupId",
});
// A GroupMessage belongs to one Group
GroupMessage.belongsTo(Group, {
  foreignKey: "groupId",
});

// --- 12. User <-> GroupMessage (Sender) ---
// A User (sender) can send many group messages
User.hasMany(GroupMessage, {
  foreignKey: "senderId",
  as: "sentGroupMessages", // Alias needed if User also has sent 1-to-1 messages
});
// A GroupMessage belongs to one User (sender)
GroupMessage.belongsTo(User, {
  foreignKey: "senderId",
  as: "Sender", // Alias used in controller (lowercase 's' matches your controller!)
});

// --- 13. GroupMessage <-> GroupMessage (Replies) ---
// Self-referencing relationship for threaded replies within a group
GroupMessage.hasMany(GroupMessage, {
  foreignKey: "parentMessageId",
  as: "Replies",
});
GroupMessage.belongsTo(GroupMessage, {
  foreignKey: "parentMessageId",
  as: "ParentMessage",
});

// --- 14. GroupMessage <-> GroupMessageReaction ---
// A GroupMessage can have many reactions
GroupMessage.hasMany(GroupMessageReaction, {
  foreignKey: "groupMessageId",
});
// A GroupMessageReaction belongs to one GroupMessage
GroupMessageReaction.belongsTo(GroupMessage, {
  foreignKey: "groupMessageId",
});

// --- 15. User <-> GroupMessageReaction ---
// A User can add many reactions to group messages
User.hasMany(GroupMessageReaction, {
  foreignKey: "userId",
});
// A GroupMessageReaction belongs to one User
GroupMessageReaction.belongsTo(User, {
  foreignKey: "userId",
});

// --- 16. User <-> GroupMessage (via HiddenGroupMessage) ---
// Many-to-Many for hiding group messages ("Delete for Me")
User.belongsToMany(GroupMessage, {
  through: HiddenGroupMessage,
  foreignKey: "userId",
  as: "HiddenGroupMessages",
});
GroupMessage.belongsToMany(User, {
  through: HiddenGroupMessage,
  foreignKey: "groupMessageId",
  as: "HiddenByGroupUsers",
});

// --- 17. Group <-> GroupMessage (Pinned Message) ---
// A Group has one pinned message (optional)
Group.belongsTo(GroupMessage, {
  foreignKey: "pinnedMessageId",
  as: "pinnedMessage", // Alias to fetch the pinned message
  constraints: false, // Important if pinnedMessageId can be null initially
});
// --- 18. User <-> Media (Uploader) ---
// A user can upload many media files
User.hasMany(Media, { 
  foreignKey: "uploadedByUserId", 
  as: "UploadedMedia" 
});
// A media file belongs to the user who uploaded it
Media.belongsTo(User, { 
  foreignKey: "uploadedByUserId", 
  as: "Uploader" 
});

// --- 19. Media <-> Message (1-to-1) ---
// A media file can be used in many messages
Media.hasMany(Message, { foreignKey: "mediaId", as: "MessageLinks" });
// A message can have (at most) one media file
Message.belongsTo(Media, { foreignKey: "mediaId", as: "Media" });

// --- 20. Media <-> GroupMessage ---
// A media file can be used in many group messages
Media.hasMany(GroupMessage, { foreignKey: "mediaId", as: "GroupMessageLinks" });
// A group message can have (at most) one media file
GroupMessage.belongsTo(Media, { foreignKey: "mediaId", as: "Media" });
// (Optional: A GroupMessage could potentially be pinned in one Group)
// GroupMessage.hasOne(Group, { foreignKey: 'pinnedMessageId' });


// ==================
// == EXPORT MODELS ==
// ==================
// Export ALL models (including the new group ones)
module.exports = {
  // 1-to-1
  User,
  Message,
  MessageReaction,
  HiddenMessage,
  Contact,
  Status,
  UnreadCount,
  // Groups
  Group,
  GroupMember,
  GroupMessage,
  GroupMessageReaction,
  HiddenGroupMessage,
  Media
};