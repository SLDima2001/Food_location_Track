import OrderAssignment from '../models/OrderAssignmentModel.js';
import Order from '../models/order.js';

// Create an order assignment
export const createOrderAssignment = async (req, res) => {
  console.log('=== CREATE ORDER ASSIGNMENT ===');
  console.log('Request body:', req.body);
  
  const { orderId, deliveryAgentId, priority = 'Normal', notes = '' } = req.body;

  if (!orderId || !deliveryAgentId) {
    return res.status(400).json({ 
      success: false,
      message: 'Order ID and Delivery Agent ID are required.' 
    });
  }

  try {
    // Check if order exists
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if delivery agent exists and is active
    const agent = await DeliveryAgent.findOne({ 
      agentId: deliveryAgentId, 
      status: 'Active' 
    });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Active delivery agent not found'
      });
    }

    // Check if order is already assigned
    const existingAssignment = await OrderAssignment.findOne({ orderId });
    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Order is already assigned to a delivery agent'
      });
    }

    // Create new assignment
    const newAssignment = new OrderAssignment({ 
      orderId, 
      deliveryAgentId,
      priority,
      notes,
      status: 'Assigned',
      createdBy: req.user?._id,
      lastModifiedBy: req.user?._id
    });

    await newAssignment.save();

    // Update agent's assigned orders count
    await DeliveryAgent.findOneAndUpdate(
      { agentId: deliveryAgentId },
      { 
        $inc: { assignedOrders: 1 },
        lastActive: new Date()
      }
    );

    // Update order status
    await Order.findOneAndUpdate(
      { orderId },
      { 
        status: 'Assigned',
        assignedAgent: agent._id,
        deliveryAgentId: deliveryAgentId,
        assignedAt: new Date()
      }
    );

    console.log('Order assignment created successfully:', newAssignment.orderId);

    // Populate assignment data for response
    const populatedAssignment = await OrderAssignment.findById(newAssignment._id);
    const orderData = await Order.findOne({ orderId });

    const responseData = {
      ...populatedAssignment.toObject(),
      customerName: orderData.name,
      customerAddress: orderData.address,
      customerPhone: orderData.phone,
      totalAmount: orderData.orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      orderItems: orderData.orderedItems,
      agentName: agent.name,
      createdAt: orderData.date
    };

    res.status(201).json({
      success: true,
      message: 'Order assigned successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Error creating order assignment:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to assign order',
      error: error.message 
    });
  }
};


export const getAssignedOrders = async (req, res) => {
  console.log('=== GET ASSIGNED ORDERS ===');
  
  try {
    const {
      status,
      deliveryAgentId,
      page = 1,
      limit = 50,
      sortBy = 'assignedDate',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (deliveryAgentId) filter.deliveryAgentId = deliveryAgentId;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get assignments with pagination
    const assignments = await OrderAssignment.find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Enrich with order and agent data
    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const [orderData, agentData] = await Promise.all([
          Order.findOne({ orderId: assignment.orderId }),
          DeliveryAgent.findOne({ agentId: assignment.deliveryAgentId })
        ]);

        if (!orderData) return null;

        return {
          _id: assignment._id,
          orderId: assignment.orderId,
          customerName: orderData.name,
          customerAddress: orderData.address,
          customerPhone: orderData.phone,
          totalAmount: orderData.orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          status: assignment.status,
          assignedAgent: assignment.deliveryAgentId,
          agentName: agentData?.name || 'Unknown Agent',
          assignedAt: assignment.assignedDate,
          createdAt: orderData.date,
          priority: assignment.priority,
          notes: assignment.notes,
          orderItems: orderData.orderedItems
        };
      })
    );

    // Filter out null results
    const validAssignments = enrichedAssignments.filter(assignment => assignment !== null);

    console.log(`Retrieved ${validAssignments.length} assigned orders`);

    res.status(200).json({
      success: true,
      count: validAssignments.length,
      data: validAssignments
    });

  } catch (error) {
    console.error('Error fetching assigned orders:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch assigned orders',
      error: error.message 
    });
  }
};

export const getUnassignedOrders = async (req, res) => {
  console.log('=== GET UNASSIGNED ORDERS ===');
  
  try {
    // Get all assigned order IDs
    const assignedOrderIds = await OrderAssignment.distinct('orderId');

    // Find orders not in the assigned list and with appropriate status
    const unassignedOrders = await Order.find({
      orderId: { $nin: assignedOrderIds },
      status: { $in: ['processing', 'Pending', 'Confirmed'] }
    })
    .sort({ date: -1 })
    .limit(50);

    // Format the response
    const formattedOrders = unassignedOrders.map(order => ({
      _id: order._id.toString(),
      orderId: order.orderId,
      customerName: order.name,
      customerAddress: order.address,
      customerPhone: order.phone,
      totalAmount: order.orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      status: 'Pending',
      createdAt: order.date,
      orderItems: order.orderedItems
    }));

    console.log(`Found ${formattedOrders.length} unassigned orders`);

    res.status(200).json({
      success: true,
      count: formattedOrders.length,
      data: formattedOrders
    });

  } catch (error) {
    console.error('Error fetching unassigned orders:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch unassigned orders',
      error: error.message 
    });
  }
};


export const getAssignedOrderById = async (req, res) => {
  console.log('=== GET ASSIGNED ORDER BY ID ===');
  
  const { orderId } = req.params;

  try {
    const assignment = await OrderAssignment.findOne({ orderId });
    if (!assignment) {
      return res.status(404).json({ 
        success: false,
        message: 'Order assignment not found' 
      });
    }

    // Get order and agent details
    const [orderData, agentData] = await Promise.all([
      Order.findOne({ orderId }),
      DeliveryAgent.findOne({ agentId: assignment.deliveryAgentId })
    ]);

    const enrichedAssignment = {
      ...assignment.toObject(),
      customerName: orderData?.name,
      customerAddress: orderData?.address,
      customerPhone: orderData?.phone,
      totalAmount: orderData?.orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      orderItems: orderData?.orderedItems,
      agentName: agentData?.name,
      createdAt: orderData?.date
    };

    res.status(200).json({
      success: true,
      data: enrichedAssignment
    });

  } catch (error) {
    console.error('Error fetching assigned order:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch assigned order',
      error: error.message 
    });
  }
};

export const updateOrderAssignment = async (req, res) => {
  console.log('=== UPDATE ORDER ASSIGNMENT ===');
  console.log('Request body:', req.body);
  
  const { orderId, status, priority, notes, deliveryAgentId } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID is required'
    });
  }

  try {
    const assignment = await OrderAssignment.findOne({ orderId });
    if (!assignment) {
      return res.status(404).json({ 
        success: false,
        message: 'Order assignment not found' 
      });
    }

    // Handle agent reassignment
    if (deliveryAgentId && deliveryAgentId !== assignment.deliveryAgentId) {
      // Check if new agent exists and is active
      const newAgent = await DeliveryAgent.findOne({ 
        agentId: deliveryAgentId, 
        status: 'Active' 
      });
      
      if (!newAgent) {
        return res.status(404).json({
          success: false,
          message: 'New delivery agent not found or inactive'
        });
      }

      // Update agent counts
      await Promise.all([
        // Decrease old agent's count
        DeliveryAgent.findOneAndUpdate(
          { agentId: assignment.deliveryAgentId },
          { $inc: { assignedOrders: -1 } }
        ),
        // Increase new agent's count
        DeliveryAgent.findOneAndUpdate(
          { agentId: deliveryAgentId },
          { $inc: { assignedOrders: 1 }, lastActive: new Date() }
        )
      ]);

      assignment.deliveryAgentId = deliveryAgentId;
    }

    // Update other fields
    if (status) assignment.status = status;
    if (priority) assignment.priority = priority;
    if (notes !== undefined) assignment.notes = notes;
    
    assignment.lastModifiedBy = req.user?._id;
    assignment.lastModifiedDate = new Date();

    await assignment.save();

    // Update order status if needed
    if (status) {
      await Order.findOneAndUpdate(
        { orderId },
        { status: status === 'Completed' ? 'completed' : 'processing' }
      );
    }

    console.log('Order assignment updated successfully:', orderId);

    res.status(200).json({
      success: true,
      message: 'Order assignment updated successfully',
      data: assignment
    });

  } catch (error) {
    console.error('Error updating order assignment:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update order assignment',
      error: error.message 
    });
  }
};

export const deleteOrderAssignment = async (req, res) => {
  console.log('=== DELETE ORDER ASSIGNMENT ===');
  
  const { orderId } = req.params;

  try {
    const assignment = await OrderAssignment.findOne({ orderId });
    if (!assignment) {
      return res.status(404).json({ 
        success: false,
        message: 'Order assignment not found' 
      });
    }

    // Decrease agent's assigned orders count
    await DeliveryAgent.findOneAndUpdate(
      { agentId: assignment.deliveryAgentId },
      { $inc: { assignedOrders: -1 } }
    );

    // Remove assignment
    await OrderAssignment.findOneAndDelete({ orderId });

    // Update order status back to processing
    await Order.findOneAndUpdate(
      { orderId },
      { 
        status: 'processing',
        $unset: { 
          assignedAgent: 1, 
          deliveryAgentId: 1, 
          assignedAt: 1 
        }
      }
    );

    console.log('Order assignment deleted successfully:', orderId);

    res.status(200).json({ 
      success: true,
      message: 'Order assignment deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting order assignment:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete order assignment',
      error: error.message 
    });
  }
};
export const getAssignmentStatistics = async (req, res) => {
  console.log('=== GET ASSIGNMENT STATISTICS ===');
  
  try {
    const [
      totalAssigned,
      assignedCount,
      inProgressCount,
      completedCount,
      failedCount,
      totalUnassigned
    ] = await Promise.all([
      OrderAssignment.countDocuments(),
      OrderAssignment.countDocuments({ status: 'Assigned' }),
      OrderAssignment.countDocuments({ status: 'In Progress' }),
      OrderAssignment.countDocuments({ status: 'Completed' }),
      OrderAssignment.countDocuments({ status: 'Failed' }),
      Order.countDocuments({
        orderId: { $nin: await OrderAssignment.distinct('orderId') },
        status: { $in: ['processing', 'Pending', 'Confirmed'] }
      })
    ]);

    const stats = {
      totalAssigned,
      assignedCount,
      inProgressCount,
      completedCount,
      failedCount,
      totalUnassigned,
      totalValue: 0 // Can be calculated if needed
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching assignment statistics:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch assignment statistics',
      error: error.message 
    });
  }
};
