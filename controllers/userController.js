const { User } = require("../models/associations"); // Assumes associations file

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; //we get this from JWT middleware
    const user = await User.findByPk(userId, {
      attributes: { exclude: ["password"] },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ userData: user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { getProfile };