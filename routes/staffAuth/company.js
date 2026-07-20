const express = require("express");

module.exports = function createCompanyRouter(context) {
  const { db, authenticateToken } = context;

  const router = express.Router();

  router.put("/company", authenticateToken, async (req, res) => {
    try {
      const { userId } = req.user;
      const {
        companyDisplayName,
        name,
        nature,
        address,
        contact,
        icon,
        coverPhotos,
        introduction,
        website,
      } = req.body;

      const staffDoc = await db.collection("staffs").doc(userId).get();
      if (!staffDoc.exists) {
        return res.status(404).json({ success: false, message: "Staff not found" });
      }

      const staffData = staffDoc.data();
      if (!staffData.companyId) {
        return res.status(400).json({
          success: false,
          message: "No company associated with this staff",
        });
      }

      const companyRef = db.collection("companies").doc(staffData.companyId);

      const updateData = {
        updatedAt: new Date().toISOString(),
      };
      if (companyDisplayName !== undefined) {
        updateData.companyDisplayName = companyDisplayName;
      }
      if (name !== undefined) {
        updateData.name = name;
      }
      if (nature !== undefined) {
        updateData.nature = nature;
      }
      if (address !== undefined) {
        updateData.address = address;
      }
      if (contact !== undefined) {
        updateData.contact = contact;
      }
      if (icon !== undefined) {
        updateData.icon = icon;
      }
      if (coverPhotos !== undefined) {
        updateData.coverPhotos = Array.isArray(coverPhotos)
          ? coverPhotos
              .filter((photo) => typeof photo === "string" && photo.trim())
              .slice(0, 5)
          : [];
      }
      if (introduction !== undefined) {
        updateData.introduction = introduction;
      }
      if (website !== undefined) {
        updateData.website = website;
      }

      await companyRef.update(updateData);

      res.status(200).json({
        success: true,
        message: "Company profile updated successfully",
        data: updateData,
      });
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during company update",
        error: error.message,
      });
    }
  });

  return router;
};
