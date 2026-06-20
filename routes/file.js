const express = require("express");
const multer = require("multer");
const admin = require("firebase-admin");

const router = express.Router();
const bucketName = "flyer-genie.firebasestorage.app";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// POST /api/file - Upload file/image
router.post("/file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { category = "general" } = req.body;
    const file = req.file;

    console.log(`Starting upload: bucket=${bucketName}, category=${category}, filename=${file.originalname}`);

    const bucket = admin.storage().bucket(bucketName);
    const blob = bucket.file(`${category}/${Date.now()}_${file.originalname}`);
    
    console.log("Attempting upload via blob.save()...");

    await blob.save(file.buffer, {
      resumable: false,
      contentType: file.mimetype,
      public: true, // This will attempt to make it public during upload
      metadata: {
        category: category,
      }
    });

    console.log("Upload successful, getting public URL...");
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
    console.log(`File available at: ${publicUrl}`);

    const response = {
      success: true,
      fileId: blob.name,
      fileName: file.originalname,
      fileType: file.mimetype,
      category: category,
      url: publicUrl,
      uploadedAt: new Date().toISOString(),
      size: file.size,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error uploading file:", error);
    // Log full error details for debugging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errors: error.errors
    };
    console.error("Full Error Details:", JSON.stringify(errorDetails, null, 2));

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to upload file to cloud storage",
        error: error.message,
        details: errorDetails
      });
    }
  }
});

module.exports = router;
