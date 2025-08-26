const path = require('path');
const express = require('express');
const multer = require('multer');
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");

const app = express();
const PORT = process.env.PORT || 3000;

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://payment-mgmt.firebaseio.com",
});
const db = admin.firestore();

const bucketName = "flyer-genie.firebasestorage.app";
const storage = new Storage();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware for parsing JSON requests (for non-file endpoints)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
// POST /api/flyer - Create flyer (leaflet, query, or qr code)
app.post('/api/flyer', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    // Placeholder response - replace with actual implementation
    const flyerData = {
      type,
      ...data,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    // Save flyerData to Firestore
    const flyerRef = await db.collection('flyers').add(flyerData);

    const response = {
      success: true,
      flyerId: flyerRef.id,
      type: type,
      message: `${type} flyer created successfully`,
      data: flyerData
    };
    
    res.status(201).json(response);
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: 'Failed to create flyer',
      error: error.message 
    });
  }
});

// POST /api/file - Upload file/image
app.post('/api/file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { category = 'general' } = req.body;
    const file = req.file;

    const blob = storage.bucket(bucketName).file(`${category}/${Date.now()}_${file.originalname}`);
    const blobStream = blob.createWriteStream({
        metadata: {
            contentType: file.mimetype
        }
    });

    blobStream.on('error', err => {
        res.status(500).json({
            success: false,
            message: 'Failed to upload file to cloud storage',
            error: err.message
        });
    });

    blobStream.on('finish', async () => {
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
            size: file.size
        };

        res.status(201).json(response);
    });

    blobStream.end(file.buffer);
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: 'Failed to upload file',
      error: error.message 
    });
  }
});

// POST /api/leaflet - Generate leaflet
app.post('/api/leaflet', (req, res) => {
  try {
    const { title, description, images, productPhotos, backgroundPhoto, referenceLayer } = req.body;
    
    // Placeholder response - replace with actual leaflet generation
    const generatedLeaflet = {
      success: true,
      coverPhoto: 'https://img.freepik.com/premium-vector/creative-modern-corporate-business-flyer-design-leaflet-design-template-with-different-layout_1147200-3.jpg',
      metadata: {
        title,
        description,
        generatedAt: new Date().toISOString()
      }
    };
    
    res.status(201).json(generatedLeaflet);
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: 'Failed to generate leaflet',
      error: error.message 
    });
  }
});

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Flyer Portal Server is running on http://localhost:${PORT}`);
});
