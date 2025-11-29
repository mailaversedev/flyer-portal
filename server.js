const path = require('path');

const express = require('express');
const multer = require('multer');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");

const app = express();
const PORT = process.env.PORT || 3000;

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://flyer-genie.firebaseio.com",
});
const db = admin.firestore();

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'flyer-portal-secret-key-2024';

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

    // Save flyerData to Firestore and get the flyer doc id
    const flyerRef = await db.collection('flyers').add(flyerData);

    // Create a lottery event for this flyer (doc id = flyer doc id)
    // Use same lottery parameters as in /api/lottery
    const pool = 5000;
    const spreadingCoefficient = 0.6;
    const lotteryFactor = 20;
    const eventCostPercent = 0.2;
    const eventUsagePercent = 0.8;
    const finalPool = pool / spreadingCoefficient;
    const maxUsers = Math.floor(finalPool / lotteryFactor);
    const eventMoney = pool * (1 - eventCostPercent);
    const lotteryMoney = eventMoney * eventUsagePercent;

    const lotteryEvent = {
      pool,
      spreadingCoefficient,
      lotteryFactor,
      eventCostPercent,
      eventUsagePercent,
      finalPool,
      maxUsers,
      eventMoney,
      lotteryMoney,
      claims: 0,
      remaining: lotteryMoney,
      flyerId: flyerRef.id,
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    await db.collection('lottery').doc(flyerRef.id).set(lotteryEvent);

    const response = {
      success: true,
      flyerId: flyerRef.id,
      type: type,
      message: `${type} flyer created successfully`,
      data: flyerData,
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

// GET /api/flyers - Get all flyers with pagination and sorting
app.get('/api/flyers', async (req, res) => {
  try {
    const { 
      limit = '100', 
      after, 
      sortBy = 'createdAt', 
      direction = 'desc' 
    } = req.query;

    // Convert limit to number and validate
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit. Must be a number between 1 and 1000.'
      });
    }

    // Validate direction
    if (!['asc', 'desc'].includes(direction.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid direction. Must be "asc" or "desc".'
      });
    }

    // Valid sortBy fields
    const validSortFields = ['createdAt', 'updatedAt', 'type', 'status'];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}.`
      });
    }

    let query = db.collection('flyers');

    // Apply sorting
    query = query.orderBy(sortBy, direction.toLowerCase());

    // Apply cursor-based pagination if 'after' is provided
    if (after) {
      try {
        const afterDoc = await db.collection('flyers').doc(after).get();
        if (!afterDoc.exists) {
          return res.status(400).json({
            success: false,
            message: 'Invalid cursor. Document not found.'
          });
        }
        query = query.startAfter(afterDoc);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid cursor format.'
        });
      }
    }

    // Apply limit
    query = query.limit(limitNum);

    // Execute query
    const snapshot = await query.get();
    
    const flyers = [];
    snapshot.forEach(doc => {
      flyers.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Get the last document for next cursor (if there are results)
    let nextCursor = null;
    if (flyers.length === limitNum && flyers.length > 0) {
      nextCursor = flyers[flyers.length - 1].id;
    }

    const response = {
      success: true,
      data: flyers,
      pagination: {
        nextCursor: nextCursor,
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching flyers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flyers',
      error: error.message
    });
  }
});

// Authentication API Routes

// POST /api/auth/register - Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, displayName, password } = req.body;

    // Validate required fields
    if (!username || !displayName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, display name, and password are required'
      });
    }

    // Validate password length (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUserQuery = await db.collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (!existingUserQuery.empty) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user data
    const userData = {
      username: username,
      displayName: displayName,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    // Save user to Firestore and create wallet in a transaction
    const timestamp = new Date().toISOString();
    
    const result = await db.runTransaction(async (transaction) => {
      // Create user document
      const userRef = db.collection('users').doc();
      transaction.set(userRef, userData);
      
      // Create wallet for the user
      const walletData = {
        userId: userRef.id,
        username: userData.username,
        balance: 0,
        currency: 'TOKEN', // Default currency - you can modify this
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: true,
        version: 1 // For optimistic locking
      };
      
      const walletRef = db.collection('wallets').doc();
      transaction.set(walletRef, walletData);
      
      return { userId: userRef.id, walletId: walletRef.id };
    });

    // Return success response (without password)
    const responseData = {
      id: result.userId,
      username: userData.username,
      displayName: userData.displayName,
      createdAt: userData.createdAt,
      isActive: userData.isActive
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully and wallet created',
      data: responseData
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
      error: error.message
    });
  }
});

// POST /api/auth/login - Login user and generate JWT token
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find user by username
    const userQuery = await db.collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // Check if user is active
    if (!userData.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, userData.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Generate JWT token
    const tokenPayload = {
      userId: userDoc.id,
      username: userData.username,
      displayName: userData.displayName
    };

    const token = jwt.sign(
      tokenPayload,
      JWT_SECRET,
      { 
        expiresIn: '24h',
        issuer: 'flyer-portal',
        audience: 'flyer-portal-users'
      }
    );

    // Update last login timestamp
    await db.collection('users').doc(userDoc.id).update({
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Return success response with token
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token: token,
        user: {
          id: userDoc.id,
          username: userData.username,
          displayName: userData.displayName
        }
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login',
      error: error.message
    });
  }
});

// JWT Middleware for protected routes (optional usage)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = decoded;
    next();
  });
};

// Example of a protected route - GET /api/auth/profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();

    // Return user profile (without password)
    res.status(200).json({
      success: true,
      data: {
        id: userDoc.id,
        username: userData.username,
        displayName: userData.displayName,
        createdAt: userData.createdAt,
        lastLoginAt: userData.lastLoginAt,
        isActive: userData.isActive
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Payment API Routes

// Helper function to generate transaction ID
const generateTransactionId = () => {
  return uuidv4();
};

// Helper function to get wallet by user ID
const getWalletByUserId = async (userId) => {
  const walletQuery = await db.collection('wallets')
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  
  if (walletQuery.empty) {
    throw new Error('Wallet not found for user');
  }
  
  return {
    doc: walletQuery.docs[0],
    data: walletQuery.docs[0].data()
  };
};

// POST /api/payment/add-tokens - Add tokens to wallet (idempotent)
app.post('/api/payment/add-tokens', authenticateToken, async (req, res) => {
  try {
    const { amount, description, idempotencyKey } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!amount || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: 'Amount and idempotencyKey are required'
      });
    }

    // Validate amount is positive
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be positive'
      });
    }

    // Check for existing transaction with same idempotency key
    const existingTxQuery = await db.collection('transactions')
      .where('idempotencyKey', '==', idempotencyKey)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existingTxQuery.empty) {
      const existingTx = existingTxQuery.docs[0].data();
      return res.status(200).json({
        success: true,
        message: 'Transaction already processed (idempotent)',
        data: {
          transactionId: existingTx.transactionId,
          amount: existingTx.amount,
          newBalance: existingTx.newBalance,
          status: existingTx.status
        }
      });
    }

    const transactionId = generateTransactionId();
    const timestamp = new Date().toISOString();

    // Execute transaction
    const result = await db.runTransaction(async (transaction) => {
      // Get current wallet
      const wallet = await getWalletByUserId(userId);
      const walletRef = db.collection('wallets').doc(wallet.doc.id);
      const currentWallet = await transaction.get(walletRef);
      
      if (!currentWallet.exists) {
        throw new Error('Wallet not found');
      }

      const walletData = currentWallet.data();
      const newBalance = walletData.balance + amount;
      const newVersion = walletData.version + 1;

      // Update wallet balance
      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: timestamp,
        version: newVersion
      });

      // Create transaction record
      const transactionData = {
        transactionId: transactionId,
        userId: userId,
        walletId: wallet.doc.id,
        type: 'ADD',
        amount: amount,
        previousBalance: walletData.balance,
        newBalance: newBalance,
        description: description || 'Add tokens to wallet',
        status: 'COMPLETED',
        idempotencyKey: idempotencyKey,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const txRef = db.collection('transactions').doc();
      transaction.set(txRef, transactionData);

      return {
        transactionId,
        amount,
        previousBalance: walletData.balance,
        newBalance,
        status: 'COMPLETED'
      };
    });

    res.status(200).json({
      success: true,
      message: 'Tokens added successfully',
      data: result
    });

  } catch (error) {
    console.error('Error adding tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during token addition',
      error: error.message
    });
  }
});

// POST /api/payment/deduct-tokens - Deduct tokens from wallet (idempotent)
app.post('/api/payment/deduct-tokens', authenticateToken, async (req, res) => {
  try {
    const { amount, description, idempotencyKey } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!amount || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: 'Amount and idempotencyKey are required'
      });
    }

    // Validate amount is positive
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be positive'
      });
    }

    // Check for existing transaction with same idempotency key
    const existingTxQuery = await db.collection('transactions')
      .where('idempotencyKey', '==', idempotencyKey)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existingTxQuery.empty) {
      const existingTx = existingTxQuery.docs[0].data();
      return res.status(200).json({
        success: true,
        message: 'Transaction already processed (idempotent)',
        data: {
          transactionId: existingTx.transactionId,
          amount: existingTx.amount,
          newBalance: existingTx.newBalance,
          status: existingTx.status
        }
      });
    }

    const transactionId = generateTransactionId();
    const timestamp = new Date().toISOString();

    // Execute transaction
    const result = await db.runTransaction(async (transaction) => {
      // Get current wallet
      const wallet = await getWalletByUserId(userId);
      const walletRef = db.collection('wallets').doc(wallet.doc.id);
      const currentWallet = await transaction.get(walletRef);
      
      if (!currentWallet.exists) {
        throw new Error('Wallet not found');
      }

      const walletData = currentWallet.data();
      
      // Check if sufficient balance
      if (walletData.balance < amount) {
        throw new Error('Insufficient balance');
      }

      const newBalance = walletData.balance - amount;
      const newVersion = walletData.version + 1;

      // Update wallet balance
      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: timestamp,
        version: newVersion
      });

      // Create transaction record
      const transactionData = {
        transactionId: transactionId,
        userId: userId,
        walletId: wallet.doc.id,
        type: 'DEDUCT',
        amount: amount,
        previousBalance: walletData.balance,
        newBalance: newBalance,
        description: description || 'Deduct tokens from wallet',
        status: 'COMPLETED',
        idempotencyKey: idempotencyKey,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const txRef = db.collection('transactions').doc();
      transaction.set(txRef, transactionData);

      return {
        transactionId,
        amount,
        previousBalance: walletData.balance,
        newBalance,
        status: 'COMPLETED'
      };
    });

    res.status(200).json({
      success: true,
      message: 'Tokens deducted successfully',
      data: result
    });

  } catch (error) {
    console.error('Error deducting tokens:', error);
    
    if (error.message === 'Insufficient balance') {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance in wallet',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during token deduction',
      error: error.message
    });
  }
});

// GET /api/payment/wallet - Get wallet balance and details
app.get('/api/payment/wallet', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const wallet = await getWalletByUserId(userId);

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet.doc.id,
        userId: wallet.data.userId,
        balance: wallet.data.balance,
        currency: wallet.data.currency,
        createdAt: wallet.data.createdAt,
        updatedAt: wallet.data.updatedAt,
        isActive: wallet.data.isActive
      }
    });

  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error fetching wallet',
      error: error.message
    });
  }
});

// GET /api/payment/transactions - Get transaction history
app.get('/api/payment/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0, type } = req.query;

    let query = db.collection('transactions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc');

    // Filter by transaction type if specified
    if (type && (type === 'ADD' || type === 'DEDUCT')) {
      query = query.where('type', '==', type);
    }

    // Apply pagination
    query = query.limit(parseInt(limit)).offset(parseInt(offset));

    const snapshot = await query.get();
    const transactions = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        transactionId: data.transactionId,
        type: data.type,
        amount: data.amount,
        previousBalance: data.previousBalance,
        newBalance: data.newBalance,
        description: data.description,
        status: data.status,
        createdAt: data.createdAt
      });
    });

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: transactions.length
      }
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error fetching transactions',
      error: error.message
    });
  }
});

// GET /api/payment/transaction/:transactionId - Get specific transaction details
app.get('/api/payment/transaction/:transactionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionId } = req.params;

    const txQuery = await db.collection('transactions')
      .where('transactionId', '==', transactionId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (txQuery.empty) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const txData = txQuery.docs[0].data();

    res.status(200).json({
      success: true,
      data: {
        id: txQuery.docs[0].id,
        transactionId: txData.transactionId,
        userId: txData.userId,
        walletId: txData.walletId,
        type: txData.type,
        amount: txData.amount,
        previousBalance: txData.previousBalance,
        newBalance: txData.newBalance,
        description: txData.description,
        status: txData.status,
        idempotencyKey: txData.idempotencyKey,
        createdAt: txData.createdAt,
        updatedAt: txData.updatedAt
      }
    });

  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error fetching transaction',
      error: error.message
    });
  }
});

// GET /api/lottery - Lottery endpoint (idempotent per user, fluctuating reward, pool depletion)
// Requires ?userId=xxx&flyerId=xxx as query params
app.get('/api/lottery', async (req, res) => {
  try {
    const userId = req.query.userId;
    const flyerId = req.query.flyerId;
    if (!userId || !flyerId) {
      return res.status(400).json({ success: false, message: 'userId and flyerId are required' });
    }

    // Retrieve flyer for event/lottery parameters
    const flyerDoc = await db.collection('flyers').doc(flyerId).get();
    if (!flyerDoc.exists) {
      return res.status(404).json({ success: false, message: 'Flyer not found' });
    }

    const flyer = flyerDoc.data();
    // Use flyer fields or fallback to defaults
    const pool = flyer.targetBudget.budget || 5000;
    const lotteryFactor = 20;
    const spreadingCoefficient = 0.6;
    const eventCostPercent = 0.2;
    const eventUsagePercent = 0.8;

    // Step 1: Calculate final pool after spreading
    const finalPool = pool / spreadingCoefficient;
    // Step 2: Max number of users to get the lottery
    const maxUsers = Math.floor(finalPool / lotteryFactor);
    // Step 3: 80% of original pool used for event, 20% as cost
    const eventMoney = pool * (1 - eventCostPercent);
    // Step 4: 80% of event money used for lottery
    const lotteryMoney = eventMoney * eventUsagePercent;
    // Step 5: Average money per user
    const avgMoneyPerUser = lotteryMoney / maxUsers;

    // --- Firestore collections ---
    const lotteryStateRef = db.collection('lottery').doc(flyerId);
    const userClaimsRef = db.collection('lottery').doc(flyerId).collection('claims').doc(userId);

    // --- Transaction for idempotency and atomicity ---
    await db.runTransaction(async (transaction) => {
      // 1. Check if user already claimed
      const userClaimDoc = await transaction.get(userClaimsRef);
      if (userClaimDoc.exists) {
        // Already claimed, return previous result
        const data = userClaimDoc.data();
        res.status(200).json({
          success: true,
          message: 'Already claimed',
          ...data,
          avgMoneyPerUser,
          maxUsers,
        });
        throw new Error('__ALREADY_CLAIMED__'); // abort transaction
      }

      // 2. Get or initialize lottery state
      let lotteryStateDoc = await transaction.get(lotteryStateRef);
      let state;
      if (!lotteryStateDoc.exists) {
        // First claim, initialize state
        state = {
          pool,
          lotteryMoney,
          maxUsers,
          claims: 0,
          remaining: lotteryMoney,
        };
        transaction.set(lotteryStateRef, state);
      } else {
        state = lotteryStateDoc.data();
      }

      // 3. Check if pool is depleted or max users reached
      if (state.claims >= state.maxUsers || state.remaining <= 0) {
        res.status(200).json({
          success: false,
          message: 'All lottery rewards have been claimed',
          avgMoneyPerUser,
          maxUsers,
        });
        throw new Error('__POOL_DEPLETED__');
      }

      // 4. Calculate reward for this user
      let reward;
      if (state.claims === state.maxUsers - 1) {
        // Last user gets all remaining
        reward = state.remaining;
      } else {
        // Fluctuate +-50% of avgMoneyPerUser, but not more than remaining
        const min = Math.max(0, avgMoneyPerUser * 0.5);
        const max = Math.min(state.remaining, avgMoneyPerUser * 1.5);
        reward = Math.random() * (max - min) + min;
        reward = Math.floor(reward * 100) / 100; // round to 2 decimals
        // Don't let reward exceed remaining for last user
        if (reward > state.remaining) reward = state.remaining;
      }

      // 5. Update state
      const newClaims = state.claims + 1;
      const newRemaining = Math.max(0, state.remaining - reward);
      transaction.update(lotteryStateRef, {
        claims: newClaims,
        remaining: newRemaining,
      });

      // 6. Record user claim
      const claimData = {
        userId,
        flyerId,
        reward,
        claimedAt: new Date().toISOString(),
        claimNumber: newClaims,
        avgMoneyPerUser,
        maxUsers,
        remainingAfter: newRemaining,
      };
      transaction.set(userClaimsRef, claimData);

      // 7. Respond
      res.status(200).json({
        success: true,
        ...claimData,
      });
    });
  } catch (error) {
    if (error.message === '__ALREADY_CLAIMED__' || error.message === '__POOL_DEPLETED__') {
      // Response already sent
      return;
    }
    console.error('Lottery error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
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
