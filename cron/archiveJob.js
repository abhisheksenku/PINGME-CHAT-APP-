const { Op } = require("sequelize");
const sequelize = require("../utilities/sql");
const { Message, GroupMessage } = require("../models/associations");
const ArchivedMessage = require("../models/archivedMessage");
const ArchivedGroupMessage = require("../models/archivedGroupMessage");

/**
 * Moves all messages older than 90 days from live tables to archive tables.
 */
async function runArchive() {
  console.log("Archive Job: Starting...");
  const transaction = await sequelize.transaction();

  try {
    // 1. Define cutoff (90 days ago, not 1 day)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    // --- 2. Archive 1-to-1 Messages ---
    const oldMessages = await Message.findAll({
      where: { createdAt: { [Op.lt]: cutoffDate } },
      transaction,
    });

    if (oldMessages.length > 0) {
      console.log(`Archiving ${oldMessages.length} 1-to-1 messages...`);
      const messagesToArchive = oldMessages.map(msg => msg.toJSON());
      await ArchivedMessage.bulkCreate(messagesToArchive, { transaction });
      const idsToDelete = oldMessages.map(msg => msg.id);
      await Message.destroy({ where: { id: { [Op.in]: idsToDelete } }, transaction });
    }

    // --- 3. Archive Group Messages ---
    const oldGroupMessages = await GroupMessage.findAll({
      where: { createdAt: { [Op.lt]: cutoffDate } },
      transaction,
    });

    if (oldGroupMessages.length > 0) {
      console.log(`Archiving ${oldGroupMessages.length} group messages...`);
      const groupMessagesToArchive = oldGroupMessages.map(msg => msg.toJSON());
      await ArchivedGroupMessage.bulkCreate(groupMessagesToArchive, { transaction });
      const idsToDelete = oldGroupMessages.map(msg => msg.id);
      await GroupMessage.destroy({ where: { id: { [Op.in]: idsToDelete } }, transaction });
    }

    // --- 4. Commit ---
    await transaction.commit();
    console.log("Archive Job: Success.");

  } catch (error) {
    await transaction.rollback();
    console.error("Archive Job: FAILED.", error);
  }
}

module.exports = { runArchive };