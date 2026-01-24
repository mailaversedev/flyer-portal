const path = require("path");
const express = require("express");
const admin = require("firebase-admin");

// must be initialized before importing routes
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://flyer-genie.firebaseio.com",
});

// Configure Firestore to ignore undefined properties globally
admin.firestore().settings({ ignoreUndefinedProperties: true });

// Import Routes
const flyerRoutes = require("./routes/flyer");
const fileRoutes = require("./routes/file");
const { router: authRoutes, authenticateToken } = require("./routes/auth");
const staffAuthRoutes = require("./routes/staffAuth");
const userRoutes = require("./routes/user");
const paymentRoutes = require("./routes/payment");
const lotteryRoutes = require("./routes/lottery");
const internalRoutes = require("./routes/internal");
const couponRoutes = require("./routes/coupon");

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

// Protected Routes
app.use("/api/user", userRoutes); // Authentication handled per route in user.js
app.use("/api/payment", authenticateToken, paymentRoutes); // /api/payment/add-tokens, etc.
app.use("/api/lottery", authenticateToken, lotteryRoutes); // /api/lottery
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
