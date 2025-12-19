const express = require("express");
const router = express.Router();
const multer = require("multer");
const { Storage } = require("@google-cloud/storage");

const bucketName = "flyer-genie.firebasestorage.app";
const storage = new Storage();

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
router.post("/file", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { category = "general" } = req.body;
    const file = req.file;

    const blob = storage
      .bucket(bucketName)
      .file(`${category}/${Date.now()}_${file.originalname}`);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on("error", (err) => {
      res.status(500).json({
        success: false,
        message: "Failed to upload file to cloud storage",
        error: err.message,
      });
    });

    blobStream.on("finish", async () => {
      // Make the file public (optional, depending on your requirements)
      await blob.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;

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
    });

    blobStream.end(file.buffer);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to upload file",
      error: error.message,
    });
  }
});

module.exports = router;
