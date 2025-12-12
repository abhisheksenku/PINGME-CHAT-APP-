
const isAdmin = async (req, res, next) => {
  try {
    // By placing the require here, it only runs when the function is called,
    // after all initial modules have loaded.
    const { GroupMember } = require("../models/associations");

    const { groupId } = req.params;
    const userId = req.user.id;

    const member = await GroupMember.findOne({
      where: {
        groupId: groupId,
        userId: userId,
      },
    });

    if (member && member.role === 'admin') {
      return next();
    }

    return res.status(403).json({ message: "Forbidden: Admin access required." });
  } catch (error) {
    console.error("isAdmin middleware error:", error);
    return res.status(500).json({ message: "Server error during authorization." });
  }
};

module.exports = { isAdmin };