const path = require("path");
const express = require("express");
const admin = require("firebase-admin");

// must be initialized before importing routes
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://flyer-genie.firebaseio.com",
});

// Import Routes
const flyerRoutes = require("./routes/flyer");
const fileRoutes = require("./routes/file");
const { router: authRoutes } = require("./routes/auth");
const paymentRoutes = require("./routes/payment");
const lotteryRoutes = require("./routes/lottery");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON requests (for non-file endpoints)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Use Routes
app.use("/api", flyerRoutes); // /api/flyer, /api/leaflet, /api/flyers
app.use("/api", fileRoutes); // /api/file
app.use("/api/auth", authRoutes); // /api/auth/register, /api/auth/login, /api/auth/profile
app.use("/api/payment", paymentRoutes); // /api/payment/add-tokens, etc.
app.use("/api/lottery", lotteryRoutes); // /api/lottery

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, "build")));

// Catch all handler: send back React's index.html file for any non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Flyer Portal Server is running on http://localhost:${PORT}`);
});
