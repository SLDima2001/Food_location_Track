// routes/OrderAssignmentRoute.js

import express from 'express';
import { 
  createOrderAssignment,
  getAssignedOrders,
  getAssignedOrderById,
  updateOrderAssignment,
  deleteOrderAssignment
} from '../controllers/OrderAssignmentController.js';
// Remove authentication if you don't want it, or adjust the path
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Order Assignment API is working!',
    timestamp: new Date().toISOString()
  });
});

// Assign order to a delivery agent
router.post('/', createOrderAssignment);

// Get all assigned orders
router.get('/', getAssignedOrders);

// Get order assignment by orderId
router.get('/:orderId', getAssignedOrderById);

// Update order assignment status (In Progress, Completed)
router.put('/', updateOrderAssignment);

// Delete an order assignment
router.delete('/:orderId', deleteOrderAssignment);

export default router;