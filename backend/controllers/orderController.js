// controllers/orderController.js

import Order from "../models/order.js";
import Products from "../models/product.js";
import Cart from "../models/cart.js";

// Create a new order from cart
export async function newOrderFromCart(req, res) {
  const { name, address, phone } = req.body;
  const userId = req.user.id;

  try {
    // Get user's cart
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        message: "Cart is empty. Add items to cart before placing an order."
      });
    }

    const newProductArray = [];
    const currentDate = new Date();

    // Process each cart item
    for (let item of cart.items) {
      const product = item.productId;
      const quantity = item.quantity;

      if (!product) {
        return res.status(400).json({
          message: "One or more products in cart no longer exist."
        });
      }

      // Check if product is expired
      if (product.expiryDate && new Date(product.expiryDate) < currentDate) {
        return res.status(400).json({
          message: `Product "${product.productName}" has expired and cannot be ordered.`
        });
      }

      // Check stock availability
      if (product.quantityInStock < quantity) {
        return res.status(400).json({
          message: `Not enough stock for "${product.productName}". Available: ${product.quantityInStock}, Requested: ${quantity}`
        });
      }

      // Reduce stock
      product.quantityInStock -= quantity;
      await product.save();

      newProductArray.push({
        name: product.productName,
        price: product.price,
        quantity,
        image: product.images[0] || "default-image-url"
      });
    }

    // Generate unique order ID
    const latestOrder = await Order.find().sort({ date: -1 }).limit(1);
    let orderId;
    if (latestOrder.length === 0) {
      orderId = "CBC0001";
    } else {
      const currentOrderId = latestOrder[0].orderId;
      const numberString = currentOrderId.replace("CBC", "");
      const number = parseInt(numberString);
      const newNumber = (number + 1).toString().padStart(4, "0");
      orderId = "CBC" + newNumber;
    }

    // Create order
    const newOrderData = {
      orderId,
      email: req.user.email,
      orderedItems: newProductArray,
      name,
      address,
      phone,
    };

    const order = new Order(newOrderData);
    const savedOrder = await order.save();

    // Clear cart after successful order
    await Cart.findOneAndUpdate(
      { userId },
      { items: [], updatedAt: new Date() }
    );

    res.json({
      message: "Order placed successfully from cart.",
      order: savedOrder,
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      message: `Error placing the order: ${error.message}`,
    });
  }
}

// Create a new order (direct order without cart)
export async function newOrder(req, res) {
  const { orderedItems, name, address, phone } = req.body;

  try {
    // Array to store order item details
    const newProductArray = [];

    // Check the stock and reduce it
    for (let i = 0; i < orderedItems.length; i++) {
      const { productId, quantity } = orderedItems[i];
      const product = await Products.findOne({ productId });

      if (!product) {
        return res.json({
          message: `Product with ID ${productId} not found.`,
        });
      }

      // Check if stock is available
      if (product.quantityInStock < quantity) {
        return res.json({
          message: `Not enough stock for ${product.productName}. Available: ${product.quantityInStock}`,
        });
      }

      // Reduce stock for the ordered quantity
      product.quantityInStock -= quantity;
      await product.save();

      newProductArray.push({
        name: product.productName,
        price: product.price,
        quantity,
        image: product.images[0] || "default-image-url",  // Default image if no product image
      });
    }

    // Generate unique order ID (CBC + 4-digit number)
    const latestOrder = await Order.find().sort({ date: -1 }).limit(1);
    let orderId;
    if (latestOrder.length === 0) {
      orderId = "CBC0001";
    } else {
      const currentOrderId = latestOrder[0].orderId;
      const numberString = currentOrderId.replace("CBC", "");
      const number = parseInt(numberString);
      const newNumber = (number + 1).toString().padStart(4, "0");
      orderId = "CBC" + newNumber;
    }

    // Prepare order data
    const newOrderData = {
      orderId,
      email: req.user.email,
      orderedItems: newProductArray,
      name,
      address,
      phone,
    };

    // Save order in database
    const order = new Order(newOrderData);
    const savedOrder = await order.save();

    res.json({
      message: "Order placed successfully.",
      order: savedOrder,
    });
  } catch (error) {
    res.status(500).json({
      message: `Error placing the order: ${error.message}`,
    });
  }
}

// Get all orders for a customer or admin
export async function listOrder(req, res) {
  try {
    if (req.user.type === "customer") {
      const orderList = await Order.find({ email: req.user.email });
      res.json({ list: orderList });
    } else if (req.user.type === "admin") {
      const orderList = await Order.find();
      res.json({ list: orderList });
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    res.status(500).json({
      message: `Error fetching orders: ${error.message}`,
    });
  }
}

// Update order status (admin can update order status)
export async function updateOrder(req, res) {
  const { orderId } = req.params;
  const { status, notes } = req.body;

  try {
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.json({ message: `Order with ID ${orderId} not found` });
    }

    order.status = status;
    order.notes = notes || order.notes; // Only update notes if provided

    await order.save();

    res.json({
      message: `Order with ID ${orderId} updated successfully`,
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: `Error updating order: ${error.message}`,
    });
  }
}

// Cancel an order
export async function cancelOrder(req, res) {
  const { orderId } = req.params;

  try {
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.json({ message: `Order with ID ${orderId} not found` });
    }

    if (order.status === "shipped" || order.status === "completed") {
      return res.json({ message: `Order cannot be cancelled, it's already ${order.status}` });
    }

    order.status = "cancelled";
    await order.save();

    res.json({
      message: `Order with ID ${orderId} has been cancelled`,
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: `Error cancelling order: ${error.message}`,
    });
  }
}

// Get revenue stats (optional - for admin)
export async function getRevenueStats(req, res) {
  try {
    const orders = await Order.find();

    let totalRevenue = 0;
    orders.forEach((order) => {
      order.orderedItems.forEach((item) => {
        totalRevenue += item.price * item.quantity;
      });
    });

    res.json({
      totalRevenue,
    });
  } catch (error) {
    res.status(500).json({
      message: `Error fetching revenue stats: ${error.message}`,
    });
  }
}

// Get orders containing farmer's products
export async function getFarmerOrders(req, res) {
  try {
    // Check if user is a farmer
    if (!req.user || req.user.type !== 'farmer') {
      return res.status(403).json({
        message: "Only farmers can access this endpoint"
      });
    }

    // Find all orders that contain products owned by this farmer
    const orders = await Order.find()
      .populate({
        path: 'orderedItems.productId',
        match: { owner: req.user._id }
      });

    // Filter orders that actually contain the farmer's products
    const farmerOrders = orders.filter(order => 
      order.orderedItems.some(item => item.productId && item.productId.owner.toString() === req.user._id.toString())
    );

    res.json({
      orders: farmerOrders
    });
  } catch (error) {
    res.status(500).json({
      message: `Error fetching farmer orders: ${error.message}`,
    });
  }
}

// Update order item status (for farmers to update status of their products in orders)
export async function updateOrderItemStatus(req, res) {
  try {
    const { orderId, productId, status } = req.body;

    // Check if user is a farmer
    if (!req.user || req.user.type !== 'farmer') {
      return res.status(403).json({
        message: "Only farmers can update product status in orders"
      });
    }

    // Find the order
    const order = await Order.findById(orderId).populate('orderedItems.productId');
    
    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    // Find the specific item and verify farmer owns the product
    const orderItem = order.orderedItems.find(item => 
      item.productId._id.toString() === productId && 
      item.productId.owner.toString() === req.user._id.toString()
    );

    if (!orderItem) {
      return res.status(404).json({
        message: "Product not found in order or you don't own this product"
      });
    }

    // Update the item status
    orderItem.status = status;
    await order.save();

    res.json({
      message: "Order item status updated successfully",
      order
    });
  } catch (error) {
    res.status(500).json({
      message: `Error updating order item status: ${error.message}`,
    });
  }
}
// Additional controller methods for your existing OrderController.js

// Add these methods to your existing OrderController.js file

export const getUnassignedOrders = async (req, res) => {
  console.log('=== GET UNASSIGNED ORDERS REQUEST ===');
  
  try {
    // Import your Order model here
    // import Order from '../models/OrderModel.js';
    
    // Query orders that don't have a delivery agent assigned
    // This assumes your Order model has fields like 'deliveryAgentId' or 'assignedAgent'
    const unassignedOrders = await Order.find({
      $and: [
        { status: { $in: ['Pending', 'Confirmed'] } }, // Only pending/confirmed orders
        { 
          $or: [
            { deliveryAgentId: { $exists: false } },
            { deliveryAgentId: null },
            { assignedAgent: { $exists: false } },
            { assignedAgent: null }
          ]
        }
      ]
    })
    .populate('customer', 'name email phone') // If you have customer reference
    .sort({ createdAt: -1 });

    console.log(`Found ${unassignedOrders.length} unassigned orders`);
    
    res.status(200).json({
      success: true,
      count: unassignedOrders.length,
      orders: unassignedOrders
    });
  } catch (error) {
    console.error('Error fetching unassigned orders:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch unassigned orders.',
      error: error.message
    });
  }
};

export const assignOrderToDeliveryAgent = async (req, res) => {
  console.log('=== ASSIGN ORDER TO DELIVERY AGENT ===');
  console.log('Request body:', req.body);
  
  const { orderId, deliveryAgentId } = req.body;

  if (!orderId || !deliveryAgentId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID and Delivery Agent ID are required.',
      required: ['orderId', 'deliveryAgentId']
    });
  }

  try {
    // Import your models
    // import Order from '../models/OrderModel.js';
    // import DeliveryAgent from '../models/DeliveryAgentModel.js';
    
    // Verify the delivery agent exists and is active
    const agent = await DeliveryAgent.findOne({ agentId: deliveryAgentId, status: 'Active' });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Active delivery agent not found.'
      });
    }

    // Find and update the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Check if order is already assigned
    if (order.deliveryAgentId || order.assignedAgent) {
      return res.status(400).json({
        success: false,
        message: 'Order is already assigned to a delivery agent.'
      });
    }

    // Update the order with delivery agent assignment
    order.deliveryAgentId = deliveryAgentId;
    order.assignedAgent = agent._id; // If you have agent reference
    order.status = 'Assigned';
    order.assignedAt = new Date();
    
    await order.save();

    console.log('Order assigned successfully:', {
      orderId: order._id,
      agentId: deliveryAgentId,
      agentName: agent.name
    });
    
    res.status(200).json({
      success: true,
      message: 'Order assigned to delivery agent successfully.',
      data: {
        order: order,
        agent: {
          agentId: agent.agentId,
          name: agent.name,
          location: agent.location
        }
      }
    });
  } catch (error) {
    console.error('Error assigning order to delivery agent:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to assign order to delivery agent.',
      error: error.message
    });
  }
};

export const getOrderAssignments = async (req, res) => {
  console.log('=== GET ORDER ASSIGNMENTS ===');
  
  try {
    // Get all orders that have been assigned to delivery agents
    const assignedOrders = await Order.find({
      $and: [
        {
          $or: [
            { deliveryAgentId: { $exists: true, $ne: null } },
            { assignedAgent: { $exists: true, $ne: null } }
          ]
        }
      ]
    })
    .populate('assignedAgent', 'name email phoneNumber location') // If using reference
    .sort({ assignedAt: -1 });

    console.log(`Found ${assignedOrders.length} assigned orders`);
    
    res.status(200).json({
      success: true,
      count: assignedOrders.length,
      data: assignedOrders
    });
  } catch (error) {
    console.error('Error fetching order assignments:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch order assignments.',
      error: error.message
    });
  }
};

export const updateOrderAssignmentStatus = async (req, res) => {
  console.log('=== UPDATE ORDER ASSIGNMENT STATUS ===');
  console.log('Request body:', req.body);
  
  const { orderId, status, location, notes } = req.body;

  if (!orderId || !status) {
    return res.status(400).json({
      success: false,
      message: 'Order ID and status are required.',
      required: ['orderId', 'status']
    });
  }

  const validStatuses = ['Assigned', 'Picked Up', 'In Transit', 'Delivered', 'Failed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status.',
      validStatuses: validStatuses
    });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Update order status and tracking info
    order.status = status;
    order.updatedAt = new Date();
    
    if (location) {
      order.currentLocation = location;
    }
    
    if (notes) {
      if (!order.deliveryNotes) order.deliveryNotes = [];
      order.deliveryNotes.push({
        note: notes,
        timestamp: new Date(),
        status: status
      });
    }

    // Set completion time if delivered
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
    }
    
    await order.save();

    console.log('Order assignment status updated:', {
      orderId: order._id,
      newStatus: status
    });
    
    res.status(200).json({
      success: true,
      message: 'Order assignment status updated successfully.',
      data: order
    });
  } catch (error) {
    console.error('Error updating order assignment status:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update order assignment status.',
      error: error.message
    });
  }
};

export const unassignOrderFromAgent = async (req, res) => {
  console.log('=== UNASSIGN ORDER FROM AGENT ===');
  
  const { orderId } = req.params;
  const { reason } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID is required.'
    });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    if (!order.deliveryAgentId && !order.assignedAgent) {
      return res.status(400).json({
        success: false,
        message: 'Order is not currently assigned to any agent.'
      });
    }

    // Remove agent assignment
    order.deliveryAgentId = null;
    order.assignedAgent = null;
    order.status = 'Pending';
    order.unassignedAt = new Date();
    order.unassignReason = reason || 'Manual unassignment';
    
    await order.save();

    console.log('Order unassigned from agent:', {
      orderId: order._id,
      reason: reason
    });
    
    res.status(200).json({
      success: true,
      message: 'Order unassigned from delivery agent successfully.',
      data: order
    });
  } catch (error) {
    console.error('Error unassigning order from agent:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to unassign order from agent.',
      error: error.message
    });
  }
};