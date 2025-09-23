// routes/DeliveryAgentRoute.js (CommonJS version)
import express from 'express'
import { 
  createDeliveryAgent,
  getDeliveryAgents,
  getDeliveryAgentById,
  updateDeliveryAgent,
  deleteDeliveryAgent
} from '../controllers/DeliveryAgentController.js';
// const { authenticate } = require('../middleware/authMiddleware.js');

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Delivery Agent API is working!',
    timestamp: new Date().toISOString()
  });
});

// Create a new delivery agent
router.post('/', createDeliveryAgent);

// Get all delivery agents
router.get('/', getDeliveryAgents);

// Get delivery agent by ID
router.get('/:agentId', getDeliveryAgentById);

// Update delivery agent
router.put('/:agentId', updateDeliveryAgent);

// Delete delivery agent
router.delete('/:agentId', deleteDeliveryAgent);

export default  router;