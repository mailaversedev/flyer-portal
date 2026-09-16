const express = require("express");
const bcrypt = require("bcryptjs");

module.exports = function createStaffPasswordResetRouter(context) {
  const {
    db,
    normalizeEmail,
    isValidEmail,
    generateOtp,
    storePasswordResetOtp,
    sendPasswordResetEmail,
    consumePasswordResetOtp,
    revokeAllRefreshSessions,
  } = context;
  const router = express.Router();

  const findStaffByEmail = async (email) => {
    const snapshot = await db
      .collection("staffs")
      .where("email", "==", email)
      .limit(1)
      .get();
    return snapshot.empty ? null : snapshot.docs[0];
  };

  router.post("/request-password-reset", async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ success: false, message: "A valid email address is required" });
      }

      const staffDoc = await findStaffByEmail(email);
      if (staffDoc && staffDoc.data()?.isActive !== false) {
        const otp = generateOtp();
        await storePasswordResetOtp(email, otp);
        await sendPasswordResetEmail(email, otp);
      }

      return res.status(200).json({
        success: true,
        message: "If an account exists for this email, a password reset code has been sent.",
      });
    } catch (error) {
      console.error("Error requesting staff password reset:", error);
      return res.status(500).json({ success: false, message: "Internal server error during password reset request" });
    }
  });

  router.post("/reset-password", async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const otp = req.body?.otp?.toString().trim();
      const newPassword = req.body?.newPassword;

      if (!email || !otp || !newPassword) {
        return res.status(400).json({ success: false, message: "Email, OTP, and new password are required" });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: "A valid email address is required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
      }

      await consumePasswordResetOtp(email, otp);
      const staffDoc = await findStaffByEmail(email);
      if (!staffDoc || staffDoc.data()?.isActive === false) {
        return res.status(404).json({ success: false, message: "Staff account not found" });
      }

      await staffDoc.ref.update({
        password: await bcrypt.hash(newPassword, 12),
        updatedAt: new Date().toISOString(),
      });
      await revokeAllRefreshSessions({
        db,
        userId: staffDoc.id,
        subjectType: "staff",
        reason: "password_reset",
      });

      return res.status(200).json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      const safeErrors = new Set(["OTP not found", "OTP already used", "OTP expired", "Invalid OTP"]);
      if (safeErrors.has(error.message)) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error("Error resetting staff password:", error);
      return res.status(500).json({ success: false, message: "Internal server error during password reset" });
    }
  });

  return router;
};