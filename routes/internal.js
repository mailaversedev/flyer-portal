const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const nodemailer = require("nodemailer");
const { authenticateToken } = require("./auth");

// POST /api/internal/send-otp-email (no authentication required)

// Helper to generate a 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/internal/send-otp-email (no authentication required)
router.post("/send-otp-email", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    console.error("[send-otp-email] Missing email", req.body);
    return res.status(400).json({ success: false, message: "Missing email" });
  }

  const otp = generateOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

  // Save OTP to Firestore (collection: otps, doc: email)
  await db.collection("otps").doc(email).set({
    otp,
    expiresAt,
    used: false,
    createdAt: new Date().toISOString(),
  });

  // Configure nodemailer SMTP transport
  const transporter = nodemailer.createTransport({
    host: "mail.privateemail.com",
    port: 465,
    secure: true, // SSL
    auth: {
      user: "hi@mailaverse.io",
      pass: process.env.MAILAVESE_SMTP_PASSWORD, // Set this in your environment
    },
  });

  const mailOptions = {
    from: 'hi@mailaverse.io',
    to: email,
    subject: '[Mailaverse] Your OTP Verification Code',
    text: `Your OTP code is: ${otp}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f6f8fa; padding: 32px 0;">
        <div style="max-width: 420px; margin: 0 auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px 28px 24px 28px;">
          <div style="text-align: center; margin-bottom: 18px;">
            <img src='https://mailaverse.io/logo192.png' alt='Mailaverse Logo' style='width: 48px; height: 48px; margin-bottom: 8px;' />
            <h2 style="margin: 0; color: #1a1a1a; font-size: 1.4rem; font-weight: 600;">Mailaverse Verification</h2>
          </div>
          <p style="font-size: 1.05rem; color: #333; margin-bottom: 18px; text-align: center;">Use the following OTP code to verify your email address:</p>
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="display: inline-block; font-size: 2.1rem; letter-spacing: 0.18em; color: #2d7ff9; background: #f0f6ff; border-radius: 8px; padding: 12px 32px; font-weight: bold; border: 1px solid #e0e7ef;">${otp}</span>
          </div>
          <p style="font-size: 0.98rem; color: #666; text-align: center; margin-bottom: 0;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          <div style="margin-top: 32px; text-align: center; color: #b0b0b0; font-size: 0.92rem;">&copy; ${new Date().getFullYear()} Mailaverse</div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "OTP email sent" });
  } catch (error) {
    console.error("[send-otp-email] Failed to send OTP email", error);
    res.status(500).json({ success: false, message: "Failed to send OTP email", error: error.message });
  }
});

// POST /api/internal/validate-otp (no authentication required)
router.post("/validate-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    console.error("[validate-otp] Missing email or otp", req.body);
    return res.status(400).json({ success: false, message: "Missing email or otp" });
  }

  const otpDoc = await db.collection("otps").doc(email).get();
  if (!otpDoc.exists) {
    console.error("[validate-otp] OTP not found for email", email);
    return res.status(400).json({ success: false, message: "OTP not found" });
  }
  const data = otpDoc.data();
  if (data.used) {
    console.error("[validate-otp] OTP already used for email", email);
    return res.status(400).json({ success: false, message: "OTP already used" });
  }
  if (Date.now() > data.expiresAt) {
    console.error("[validate-otp] OTP expired for email", email);
    return res.status(400).json({ success: false, message: "OTP expired" });
  }
  if (data.otp !== otp) {
    console.error("[validate-otp] Invalid OTP for email", email);
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  // Mark OTP as used
  await db.collection("otps").doc(email).update({ used: true, usedAt: new Date().toISOString() });

  res.json({ success: true, message: "OTP validated" });
});

// GET /api/internal/statistic
// Query params: year (optional), month (optional)
router.get("/statistic", authenticateToken, async (req, res) => {
  try {
    let { year, month } = req.query;

    const statsRef = db
      .collection("companies")
      .doc(req.user.companyId)
      .collection("statistics");

    let results = [];

    // Case 1: Specific Month (Year + Month) -> Get single document
    if (year && month) {
      const docId = `${year}-${String(month).padStart(2, "0")}`;
      const doc = await statsRef.doc(docId).get();

      if (doc.exists) {
        results.push({ id: doc.id, ...doc.data() });
      }
    }
    // Case 2: Specific Year -> Query by year field
    else if (year) {
      const snapshot = await statsRef
        .where("year", "==", parseInt(year))
        .orderBy("month", "asc")
        .get();

      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
    }
    // Case 3: No filters -> Return all, ordered by date descending
    else {
      const snapshot = await statsRef
        .orderBy("year", "desc")
        .orderBy("month", "desc")
        .get();

      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
    }

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// POST /api/internal/notification - Send push notification to a specific device
router.post("/notification", authenticateToken, async (req, res) => {
  try {
    const { token, title, body, data } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Device token is required",
      });
    }

    const message = {
      notification: {
        title: title || "New Notification",
        body: body || "",
      },
      data: data || {},
      token: token,
    };

    const response = await admin.messaging().send(message);

    res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      messageId: response,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send notification",
      error: error.message,
    });
  }
});

module.exports = router;
