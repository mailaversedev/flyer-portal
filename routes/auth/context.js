const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

const { DEFAULT_FROM, createMailTransport } = require("../../services/mailService");

const db = admin.firestore();

const JWT_SECRET = process.env.JWT_SECRET || "flyer-portal-secret-key-2024";

const JWT_OPTIONS = {
  expiresIn: "24h",
  issuer: "flyer-portal",
  audience: "flyer-portal-users",
};

const RESET_OTP_COLLECTION = "passwordResetOtps";

const normalizeEmail = (value = "") => value.trim().toLowerCase();
const isValidEmail = (value = "") => /\S+@\S+\.\S+/.test(value);

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendPasswordResetEmail = async (email, otp) => {
  const transporter = createMailTransport();

  await transporter.sendMail({
    from: DEFAULT_FROM,
    to: email,
    subject: "[Mailaverse] Your Password Reset Code",
    text: `Your password reset code is: ${otp}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f6f8fa; padding: 32px 0;">
        <div style="max-width: 420px; margin: 0 auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px 28px 24px 28px;">
          <div style="text-align: center; margin-bottom: 18px;">
            <img src='https://mailaverse.io/logo192.png' alt='Mailaverse Logo' style='width: 48px; height: 48px; margin-bottom: 8px;' />
            <h2 style="margin: 0; color: #1a1a1a; font-size: 1.4rem; font-weight: 600;">Mailaverse Password Reset</h2>
          </div>
          <p style="font-size: 1.05rem; color: #333; margin-bottom: 18px; text-align: center;">Use the following code to reset your password:</p>
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="display: inline-block; font-size: 2.1rem; letter-spacing: 0.18em; color: #2d7ff9; background: #f0f6ff; border-radius: 8px; padding: 12px 32px; font-weight: bold; border: 1px solid #e0e7ef;">${otp}</span>
          </div>
          <p style="font-size: 0.98rem; color: #666; text-align: center; margin-bottom: 0;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          <div style="margin-top: 32px; text-align: center; color: #b0b0b0; font-size: 0.92rem;">&copy; ${new Date().getFullYear()} Mailaverse</div>
        </div>
      </div>
    `,
  });
};

const findUserByEmail = async (email) => {
  const directQuery = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  return directQuery.empty ? null : directQuery.docs[0];
};

const storePasswordResetOtp = async (email, otp) => {
  await db.collection(RESET_OTP_COLLECTION).doc(email).set({
    email,
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    used: false,
    createdAt: new Date().toISOString(),
  });
};

const consumePasswordResetOtp = async (email, otp) => {
  const otpRef = db.collection(RESET_OTP_COLLECTION).doc(email);
  const otpDoc = await otpRef.get();

  if (!otpDoc.exists) {
    throw new Error("OTP not found");
  }

  const data = otpDoc.data();

  if (data.used) {
    throw new Error("OTP already used");
  }

  if (Date.now() > data.expiresAt) {
    throw new Error("OTP expired");
  }

  if (data.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  await otpRef.update({
    used: true,
    usedAt: new Date().toISOString(),
  });
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token is required",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    req.user = decoded;
    next();
  });
};

module.exports = {
  db,
  JWT_SECRET,
  JWT_OPTIONS,
  RESET_OTP_COLLECTION,
  normalizeEmail,
  isValidEmail,
  generateOtp,
  sendPasswordResetEmail,
  findUserByEmail,
  storePasswordResetOtp,
  consumePasswordResetOtp,
  authenticateToken,
};
