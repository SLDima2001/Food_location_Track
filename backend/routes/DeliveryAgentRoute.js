// routes/DeliveryAgentRoute.js
import express from 'express'
import { 
  createDeliveryAgent,
  getDeliveryAgents,
  getDeliveryAgentById,
  updateDeliveryAgent,
  deleteDeliveryAgent,
  getAgentStatistics,
  getUnassignedOrders,
  assignOrderToAgent
} from '../controllers/DeliveryAgentController.js';

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Delivery Agent API is working!',
    timestamp: new Date().toISOString()
  });
});

// Order management routes
router.get('/orders/unassigned', getUnassignedOrders);
router.post('/orders/assign', assignOrderToAgent);

// Agent statistics
router.get('/stats/:agentId', getAgentStatistics);

// CRUD operations for delivery agents
router.post('/', createDeliveryAgent);
router.get('/', getDeliveryAgents);
router.get('/:agentId', getDeliveryAgentById);
router.put('/:agentId', updateDeliveryAgent);
router.delete('/:agentId', deleteDeliveryAgent);

export default router;

// Example of how to use in your main app.js or server.js:

/*
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import deliveryAgentRoutes from './routes/DeliveryAgentRoute.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/delivery-agents', deliveryAgentRoutes);

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
*/