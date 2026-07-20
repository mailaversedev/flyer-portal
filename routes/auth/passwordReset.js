const express = require("express");
const bcrypt = require("bcryptjs");

module.exports = function createPasswordResetRouter(context) {
  const {
    db,
    normalizeEmail,
    isValidEmail,
    findUserByEmail,
    generateOtp,
    storePasswordResetOtp,
    sendPasswordResetEmail,
    consumePasswordResetOtp,
  } = context;

  const router = express.Router();

  router.post("/request-password-reset", async (req, res) => {
    try {
      const normalizedEmail = normalizeEmail(req.body?.email);

      if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "A valid email address is required",
        });
      }

      const userDoc = await findUserByEmail(normalizedEmail);

      if (!userDoc || userDoc.data()?.isActive === false) {
        return res.status(200).json({
          success: true,
          message:
            "If an account exists for this email, a password reset code has been sent.",
        });
      }

      const otp = generateOtp();
      await storePasswordResetOtp(normalizedEmail, otp);
      await sendPasswordResetEmail(normalizedEmail, otp);

      return res.status(200).json({
        success: true,
        message:
          "If an account exists for this email, a password reset code has been sent.",
      });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during password reset request",
        error: error.message,
      });
    }
  });

  router.post("/reset-password", async (req, res) => {
    try {
      const normalizedEmail = normalizeEmail(req.body?.email);
      const otp = req.body?.otp?.toString().trim();
      const newPassword = req.body?.newPassword;

      if (!normalizedEmail || !otp || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Email, OTP, and new password are required",
        });
      }

      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "A valid email address is required",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      await consumePasswordResetOtp(normalizedEmail, otp);

      const userDoc = await findUserByEmail(normalizedEmail);

      if (!userDoc || userDoc.data()?.isActive === false) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await db.collection("users").doc(userDoc.id).update({
        password: hashedPassword,
        updatedAt: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      const clientSafeErrors = new Set([
        "OTP not found",
        "OTP already used",
        "OTP expired",
        "Invalid OTP",
      ]);

      if (clientSafeErrors.has(error.message)) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error("Error resetting password:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during password reset",
        error: error.message,
      });
    }
  });

  return router;
};
