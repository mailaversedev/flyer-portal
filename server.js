const path = require("path");
const express = require("express");
const admin = require("firebase-admin");

const fs = require("fs");

// must be initialized before importing routes
const serviceAccountPath = path.join(__dirname, "flyer-genie.json");
let credential;

if (fs.existsSync(serviceAccountPath)) {
  console.log("Using service account from flyer-genie.json");
  credential = admin.credential.cert(serviceAccountPath);
} else {
  console.log("Using application default credentials");
  credential = admin.credential.applicationDefault();
}

admin.initializeApp({
  credential: credential,
  databaseURL: "https://flyer-genie.firebaseio.com",
  storageBucket: "flyer-genie.firebasestorage.app",
});

// Configure Firestore to ignore undefined properties globally
admin.firestore().settings({ ignoreUndefinedProperties: true });

// Import Routes
const flyerRoutes = require("./routes/flyer/index");
const fileRoutes = require("./routes/file");
const { router: authRoutes, authenticateToken } = require("./routes/auth/index");
const staffAuthRoutes = require("./routes/staffAuth/index");
const userRoutes = require("./routes/user");
const paymentRoutes = require("./routes/payment");
const lotteryRoutes = require("./routes/lottery");
const internalRoutes = require("./routes/internal");
const couponRoutes = require("./routes/coupon");
const metadataRoutes = require("./routes/metadata");
const adminRoutes = require("./routes/admin/index");
const voucherRoutes = require("./routes/voucher");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON requests (for non-file endpoints)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Use Routes
// Public Routes
app.use("/api/auth", authRoutes); // /api/auth/register, /api/auth/login
app.use("/api/auth/staff", staffAuthRoutes); // /api/auth/staff/register, /api/auth/staff/login
app.use("/api", flyerRoutes); // /api/flyer (protected), /api/flyers (public)
app.use("/api/internal", internalRoutes); // /api/internal
app.use("/api", fileRoutes); // /api/file
app.use("/api/lottery", lotteryRoutes); // /api/lottery
app.use("/api", metadataRoutes); // /api/industries
app.use("/api", voucherRoutes.router); // /api/vouchers

// Protected Routes
app.use("/api/admin", adminRoutes);
app.use("/api/user", authenticateToken, userRoutes);
app.use("/api/payment", authenticateToken, paymentRoutes); // /api/payment/add-tokens, etc.
app.use("/api/coupon", authenticateToken, couponRoutes); // /api/coupon/claim, /api/coupon/my-coupons

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, "build")));

// Catch all handler: send back React's index.html file for any non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Flyer Portal Server is running on http://localhost:${PORT}`);
});
