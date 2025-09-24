// routes/OrderAssignmentRoute.js

import express from 'express';
import { 
  createOrderAssignment,
  getAssignedOrders,
  getUnassignedOrders,
  getAssignedOrderById,
  updateOrderAssignment,
  deleteOrderAssignment,
  getAssignmentStatistics
} from '../controllers/OrderAssignmentController.js';
// Remove authentication if you don't want it, or adjust the path
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Order Assignment API is working!',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /': 'Create order assignment',
      'GET /': 'Get all assigned orders',
      'GET /unassigned': 'Get unassigned orders',
      'GET /stats': 'Get assignment statistics',
      'GET /:orderId': 'Get assignment by order ID',
      'PUT /': 'Update order assignment',
      'DELETE /:orderId': 'Delete order assignment (unassign)'
    }
  });
});

router.get('/stats', getAssignmentStatistics);

// Get unassigned orders (orders available for assignment)
router.get('/unassigned', getUnassignedOrders);

// Get all assigned orders with full details
router.get('/', getAssignedOrders);

// Get specific order assignment by orderId
router.get('/:orderId', getAssignedOrderById);

// Create new order assignment (assign order to delivery agent)
router.post('/', createOrderAssignment);

// Update order assignment (status, priority, notes, reassign agent)
router.put('/', updateOrderAssignment);

// Delete order assignment (unassign order from agent)
router.delete('/:orderId', deleteOrderAssignment);

export default router;


