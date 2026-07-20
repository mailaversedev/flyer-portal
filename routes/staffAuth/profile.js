const express = require("express");

module.exports = function createProfileRouter(context) {
  const { db, authenticateToken } = context;

  const router = express.Router();

  router.put("/profile", authenticateToken, async (req, res) => {
    try {
      const { userId } = req.user;
      const { displayName, ...profileData } = req.body;

      const updateData = {
        updatedAt: new Date().toISOString(),
      };

      if (displayName !== undefined) {
        updateData.displayName = displayName;
      }

      if (Object.keys(profileData).length > 0) {
        updateData.profile = profileData;
      }

      await db.collection("staffs").doc(userId).set(updateData, { merge: true });

      res.status(200).json({
        success: true,
        message: "Staff profile updated successfully",
        data: {
          displayName: updateData.displayName,
          profile: updateData.profile,
        },
      });
    } catch (error) {
      console.error("Error updating staff profile:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during staff profile update",
        error: error.message,
      });
    }
  });

  return router;
};
