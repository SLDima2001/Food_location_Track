import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import { fileURLToPath } from 'url';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import your existing routers (First server routes)
import userRouter from './routes/userRouter.js';
import productsRouter from './routes/productRouter.js';
import orderRouter from './routes/orderRouter.js';
import cartRouter from './routes/cartRouter.js';
import utilityRouter from './routes/utilityRouter.js';
import paymentrouter from './routes/paymentrouter.js';

// Import delivery system routes (Second server routes - converted to ES6 modules)
import deliveryAgentRoutes from './routes/DeliveryAgentRoute.js';
import orderAssignmentRoutes from './routes/OrderAssignmentRoute.js';

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// MongoDB Connection - Enhanced with fallback
const connectDB = async () => {
  try {
    // Primary connection string from first server
    let mongoURI = process.env.MONGO_URI || process.env.mongodbURL;
    
    // Fallback to second server's connection string if primary not found
    if (!mongoURI) {
      mongoURI = "mongodb+srv://Admin:4R9yAVH4ZB1rAFMF@cluster0.pu3reeq.mongodb.net/deliveryApp";
      console.log('⚠️  Using fallback MongoDB connection');
    }
    
    await mongoose.connect(mongoURI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Database connected successfully');
    console.log('📊 Connected to database:', mongoose.connection.name);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('🔄 Server will continue running without database...');
  }
};

connectDB();

// Enhanced CORS configuration - Merged from both servers
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5176',
  'http://localhost:3000',
  'http://localhost:5555'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    console.warn('🚫 CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true }));

// Enhanced request logging middleware
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Request body:', req.body);
  }
  next();
});

// PayHere Configuration
// (Add your existing PayHere configuration code here if needed)

// Health check endpoint - Enhanced
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Unified Backend API is running',
    timestamp: new Date().toISOString(),
    features: {
      cartPayments: true,
      foodSubscriptions: true,
      notifications: true,
      adminDashboard: true,
      deliveryManagement: true,
      orderAssignment: true
    },
    database: {
      connected: mongoose.connection.readyState === 1,
      name: mongoose.connection.name
    }
  });
});

// Root route from second server
app.get('/', (req, res) => {
    res.json({ 
      message: 'Unified Backend server is running!',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        debug: '/debug',
        users: '/api/users',
        products: '/api/products',
        orders: '/api/orders',
        cart: '/api/cart',
        utility: '/api/utility',
        payments: '/api/payments',
        deliveryAgents: '/api/delivery-agents',
        orderAssignments: '/api/order-assignments'
      }
    });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    PORT: process.env.PORT,
    JWT_SECRET_KEY_EXISTS: !!process.env.JWT_SECRET_KEY,
    JWT_SECRET_KEY_LENGTH: process.env.JWT_SECRET_KEY ? process.env.JWT_SECRET_KEY.length : 0,
    NODE_ENV: process.env.NODE_ENV,
    MONGO_CONNECTION: {
      state: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    }
  });
});

// Mount existing routes from first server
app.use('/api/users', userRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', orderRouter);  // This handles /api/orders/*
app.use('/api/order', orderRouter);   // This handles /api/order/*
app.use('/api/cart', cartRouter);
app.use('/api/utility', utilityRouter);
app.use('/api', paymentrouter);

// Mount delivery system routes from second server
app.use('/api/delivery-agents', deliveryAgentRoutes);
app.use('/api/order-assignments', orderAssignmentRoutes);

// Enhanced error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 Error occurred:');
    console.error('Stack:', err.stack);
    console.error('Request URL:', req.originalUrl);
    console.error('Request Method:', req.method);
    
    res.status(err.status || 500).json({ 
      success: false,
      message: 'Something broke!', 
      error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
      timestamp: new Date().toISOString()
    });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/api/health',
      '/api/users',
      '/api/products', 
      '/api/orders',
      '/api/cart',
      '/api/utility',
      '/api/delivery-agents',
      '/api/order-assignments'
    ]
  });
});

// Start server function
const startServer = async () => {
  try {
    const PORT = process.env.PORT || 5000;
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🚀 Unified Backend Server Started Successfully!');
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log(`🔐 JWT_SECRET_KEY loaded: ${!!process.env.JWT_SECRET_KEY}`);
      console.log(`🛣️  Order routes available at both /api/order and /api/orders`);
      console.log(`🚚 Delivery management routes available at /api/delivery-agents`);
      console.log(`📋 Order assignment routes available at /api/order-assignments`);
      console.log(`🏥 Health check available at /api/health`);
      console.log('\n✨ All systems ready!');
    });
  } catch (error) {
    console.error("🚨 Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();