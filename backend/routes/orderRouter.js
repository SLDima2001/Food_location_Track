import express from 'express';
import { newOrder, newOrderFromCart, listOrder, updateOrder, cancelOrder, getRevenueStats, getFarmerOrders, updateOrderItemStatus,getUnassignedOrders,
  assignOrderToDeliveryAgent,
  getOrderAssignments,
  updateOrderAssignmentStatus,
  unassignOrderFromAgent } from '../controllers/orderController.js';  // Import order controller methods
import { authenticate } from '../middleware/authMiddleware.js';  // Import authenticate middleware
import Order from '../models/order.js'; // Import Order model

const router = express.Router();

// Route to create a new order from cart (recommended)
router.post("/from-cart", authenticate, newOrderFromCart);  // Requires authentication

// Route to create a new order directly (without cart)
router.post("/", authenticate, newOrder);  // Requires authentication

// Route to list orders (for customers to view their own orders or admins to view all orders)
router.get("/", authenticate, listOrder);  // Requires authentication

// Route for farmers to get orders containing their products
router.get("/farmer", authenticate, getFarmerOrders);  // Farmers only

// NEW: Route to get order by orderId (for delivery system)
router.get("/by-order-id/:orderId", async (req, res) => {
  console.log('=== GET ORDER BY ORDER ID REQUEST ===');
  console.log('Order ID:', req.params.orderId);
  
  const { orderId } = req.params;

  try {
    // Find order by orderId field (not _id)
    const order = await Order.findOne({ orderId: orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} not found`
      });
    }

    console.log('Order found:', order);

    res.status(200).json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error fetching order by orderId:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
});

// NEW: Route to update order status by orderId (for delivery system)
router.put("/:orderId/status", async (req, res) => {
  console.log('=== UPDATE ORDER STATUS REQUEST ===');
  console.log('Order ID:', req.params.orderId);
  console.log('Request body:', req.body);
  
  const { orderId } = req.params;
  const { status } = req.body;

  // Validate status
  const validStatuses = ['processing', 'shipped', 'completed', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Valid statuses are: ' + validStatuses.join(', ')
    });
  }

  try {
    // Find order by orderId field (not _id)
    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: orderId }, // Search by orderId field
      { 
        status: status,
        updatedAt: new Date()
      },
      { 
        new: true, // Return updated document
        runValidators: true 
      }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} not found`
      });
    }

    console.log('Order status updated successfully:', updatedOrder);

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

// Route to update order status (admin only) - existing route
router.put("/:orderId", authenticate, updateOrder);  // Only admins can update order status

// Route for farmers to update order item status
router.put("/item-status", authenticate, updateOrderItemStatus);  // Farmers only

// Route to cancel an order (admin or customer can cancel pending orders)
router.delete("/:orderId", authenticate, cancelOrder);  // Requires authentication

// Route to get revenue stats (admin only)
router.get("/revenue-stats", authenticate, getRevenueStats);  // Only admins can view revenue stats

router.get('/unassigned', getUnassignedOrders);
router.post('/assign-to-agent', assignOrderToDeliveryAgent);
router.get('/assignments', getOrderAssignments);
router.put('/assignment-status', updateOrderAssignmentStatus);
router.delete('/unassign/:orderId', unassignOrderFromAgent);

export default router;