// controllers/OrderAssignmentController.js - Complete version with all functionality

import OrderAssignment from '../models/OrderAssignmentModel.js';
import Order from '../models/order.js';
import DeliveryAgent from '../models/DeliveryAgentModel.js';

// Utility function to safely parse numbers
const safeParseFloat = (value) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const safeParseInt = (value) => {
  const parsed = parseInt(value);
  return isNaN(parsed) ? 0 : parsed;
};

// Utility function to calculate total amount from order items
const calculateTotalAmount = (orderedItems) => {
  if (!orderedItems || !Array.isArray(orderedItems)) return 0;
  
  return orderedItems.reduce((sum, item) => {
    const itemPrice = safeParseFloat(item.price);
    const itemQuantity = safeParseInt(item.quantity);
    return sum + (itemPrice * itemQuantity);
  }, 0);
};

// Utility function to format order items safely
const formatOrderItems = (orderedItems) => {
  if (!orderedItems || !Array.isArray(orderedItems)) return [];
  
  return orderedItems.map(item => ({
    name: item.name || 'Unknown Item',
    price: safeParseFloat(item.price),
    quantity: safeParseInt(item.quantity),
    image: item.image || 'default-image-url',
    productId: item.productId || null,
    status: item.status || 'pending'
  }));
};

// Create an order assignment
export const createOrderAssignment = async (req, res) => {
  console.log('=== CREATE ORDER ASSIGNMENT ===');
  console.log('Request body:', req.body);
  
  const { orderId, deliveryAgentId, priority = 'Normal', notes = '' } = req.body;

  // Validation
  if (!orderId || !deliveryAgentId) {
    return res.status(400).json({ 
      success: false,
      message: 'Order ID and Delivery Agent ID are required.',
      required: ['orderId', 'deliveryAgentId']
    });
  }

  try {
    // Check if order exists - handle both orderId field and _id
    let order = await Order.findOne({ orderId: orderId });
    if (!order) {
      // If not found by orderId field, try by _id
      order = await Order.findById(orderId);
    }
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with ID "${orderId}" not found`
      });
    }

    console.log('Order found:', { orderId: order.orderId, customerName: order.name });

    // Check if delivery agent exists and is active
    const agent = await DeliveryAgent.findOne({ 
      agentId: deliveryAgentId, 
      status: 'Active' 
    });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: `Active delivery agent with ID "${deliveryAgentId}" not found`
      });
    }

    console.log('Agent found:', { agentId: agent.agentId, name: agent.name });

    // Check if order is already assigned - use the order's orderId field
    const existingAssignment = await OrderAssignment.findOne({ orderId: order.orderId });
    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: `Order "${order.orderId}" is already assigned to agent "${existingAssignment.deliveryAgentId}"`
      });
    }

    // Create new assignment using the order's orderId field
    const newAssignment = new OrderAssignment({ 
      orderId: order.orderId, // Use the orderId field from the order document
      deliveryAgentId,
      priority,
      notes,
      status: 'Assigned',
      assignedDate: new Date(),
      createdBy: req.user?._id,
      lastModifiedBy: req.user?._id
    });

    await newAssignment.save();
    console.log('Assignment created:', newAssignment.orderId);

    // Update agent's assigned orders count
    await DeliveryAgent.findOneAndUpdate(
      { agentId: deliveryAgentId },
      { 
        $inc: { assignedOrders: 1 },
        lastActive: new Date()
      }
    );

    // Update order status using the order's orderId
    await Order.findOneAndUpdate(
      { orderId: order.orderId },
      { 
        status: 'Assigned',
        assignedAgent: agent._id,
        deliveryAgentId: deliveryAgentId,
        assignedAt: new Date()
      }
    );

    console.log('Order and agent updated successfully');

    // Create enriched response data
    const totalAmount = calculateTotalAmount(order.orderedItems);
    const formattedItems = formatOrderItems(order.orderedItems);

    const responseData = {
      _id: newAssignment._id,
      orderId: newAssignment.orderId,
      deliveryAgentId: newAssignment.deliveryAgentId,
      status: newAssignment.status,
      priority: newAssignment.priority,
      notes: newAssignment.notes,
      assignedDate: newAssignment.assignedDate,
      customerName: order.name,
      customerAddress: order.address,
      customerPhone: order.phone,
      customerEmail: order.email,
      totalAmount: totalAmount,
      orderItems: formattedItems,
      agentName: agent.name,
      createdAt: order.date
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

// Get all assigned orders with enriched data
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

    console.log('Query parameters:', { status, deliveryAgentId, page, limit, sortBy, sortOrder });

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

    console.log(`Found ${assignments.length} assignments to enrich`);

    // Enrich with order and agent data
    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        try {
          const [orderData, agentData] = await Promise.all([
            Order.findOne({ orderId: assignment.orderId }),
            DeliveryAgent.findOne({ agentId: assignment.deliveryAgentId })
          ]);

          if (!orderData) {
            console.warn(`Order not found for assignment: ${assignment.orderId}`);
            return null;
          }

          const totalAmount = calculateTotalAmount(orderData.orderedItems);
          const formattedItems = formatOrderItems(orderData.orderedItems);

          return {
            _id: assignment._id,
            orderId: assignment.orderId,
            customerName: orderData.name,
            customerAddress: orderData.address,
            customerPhone: orderData.phone,
            customerEmail: orderData.email,
            totalAmount: totalAmount,
            status: assignment.status,
            assignedAgent: assignment.deliveryAgentId,
            agentName: agentData?.name || 'Unknown Agent',
            assignedAt: assignment.assignedDate,
            createdAt: orderData.date,
            priority: assignment.priority,
            notes: assignment.notes,
            orderItems: formattedItems,
            startedDate: assignment.startedDate,
            completedDate: assignment.completedDate,
            estimatedDeliveryTime: assignment.estimatedDeliveryTime,
            actualDeliveryTime: assignment.actualDeliveryTime
          };
        } catch (enrichError) {
          console.error(`Error enriching assignment ${assignment.orderId}:`, enrichError);
          return null;
        }
      })
    );

    // Filter out null results
    const validAssignments = enrichedAssignments.filter(assignment => assignment !== null);

    console.log(`Retrieved ${validAssignments.length} valid assigned orders`);

    res.status(200).json({
      success: true,
      count: validAssignments.length,
      data: validAssignments,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        totalDisplayed: validAssignments.length
      }
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

// Get all unassigned orders
export const getUnassignedOrders = async (req, res) => {
  console.log('=== GET UNASSIGNED ORDERS ===');
  
  try {
    const { limit = 50, sortBy = 'date', sortOrder = 'desc' } = req.query;

    // Get all assigned order IDs
    const assignedOrderIds = await OrderAssignment.distinct('orderId');
    console.log(`Found ${assignedOrderIds.length} assigned order IDs:`, assignedOrderIds);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Find orders not in the assigned list and with appropriate status
    const unassignedOrders = await Order.find({
      orderId: { $nin: assignedOrderIds },
      status: { $in: ['processing', 'Pending', 'Confirmed', 'pending'] }
    })
    .sort(sort)
    .limit(parseInt(limit));

    console.log(`Found ${unassignedOrders.length} unassigned orders`);

    // Format the response with all necessary details
    const formattedOrders = unassignedOrders.map((order, index) => {
      try {
        const totalAmount = calculateTotalAmount(order.orderedItems);
        const formattedItems = formatOrderItems(order.orderedItems);

        console.log(`Processing order ${index + 1}/${unassignedOrders.length}: ${order.orderId}, Total: ${totalAmount}`);

        return {
          _id: order._id.toString(),
          orderId: order.orderId,
          customerName: order.name || 'Unknown Customer',
          customerAddress: order.address || 'No address provided',
          customerPhone: order.phone || 'No phone provided',
          customerEmail: order.email || 'No email provided',
          totalAmount: totalAmount,
          status: 'Pending',
          createdAt: order.date || order.createdAt,
          orderItems: formattedItems,
          notes: order.notes || '',
          // Additional order details
          orderStatus: order.status,
          itemCount: formattedItems.length
        };
      } catch (formatError) {
        console.error(`Error formatting order ${order.orderId}:`, formatError);
        return {
          _id: order._id.toString(),
          orderId: order.orderId,
          customerName: order.name || 'Unknown Customer',
          customerAddress: order.address || 'No address provided',
          customerPhone: order.phone || 'No phone provided',
          customerEmail: order.email || 'No email provided',
          totalAmount: 0,
          status: 'Pending',
          createdAt: order.date || order.createdAt,
          orderItems: [],
          error: 'Error formatting order data'
        };
      }
    });

    const totalAmount = formattedOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    console.log(`Successfully formatted ${formattedOrders.length} unassigned orders with total value: ${totalAmount}`);

    res.status(200).json({
      success: true,
      count: formattedOrders.length,
      data: formattedOrders,
      summary: {
        totalOrders: formattedOrders.length,
        totalValue: totalAmount,
        totalItems: formattedOrders.reduce((sum, order) => sum + order.itemCount, 0)
      }
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

// Get specific order assignment by orderId
export const getAssignedOrderById = async (req, res) => {
  console.log('=== GET ASSIGNED ORDER BY ID ===');
  
  const { orderId } = req.params;
  console.log('Requested order ID:', orderId);

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID parameter is required'
    });
  }

  try {
    const assignment = await OrderAssignment.findOne({ orderId });
    if (!assignment) {
      return res.status(404).json({ 
        success: false,
        message: `Order assignment not found for order ID: ${orderId}` 
      });
    }

    console.log('Assignment found:', assignment.orderId);

    // Get order and agent details
    const [orderData, agentData] = await Promise.all([
      Order.findOne({ orderId }),
      DeliveryAgent.findOne({ agentId: assignment.deliveryAgentId })
    ]);

    if (!orderData) {
      return res.status(404).json({
        success: false,
        message: `Order data not found for order ID: ${orderId}`
      });
    }

    const totalAmount = calculateTotalAmount(orderData.orderedItems);
    const formattedItems = formatOrderItems(orderData.orderedItems);

    const enrichedAssignment = {
      // Assignment data
      _id: assignment._id,
      orderId: assignment.orderId,
      deliveryAgentId: assignment.deliveryAgentId,
      status: assignment.status,
      priority: assignment.priority,
      notes: assignment.notes,
      assignedDate: assignment.assignedDate,
      startedDate: assignment.startedDate,
      completedDate: assignment.completedDate,
      estimatedDeliveryTime: assignment.estimatedDeliveryTime,
      actualDeliveryTime: assignment.actualDeliveryTime,
      
      // Order data
      customerName: orderData.name,
      customerAddress: orderData.address,
      customerPhone: orderData.phone,
      customerEmail: orderData.email,
      totalAmount: totalAmount,
      orderItems: formattedItems,
      createdAt: orderData.date || orderData.createdAt,
      orderStatus: orderData.status,
      orderNotes: orderData.notes,

      // Agent data
      agentName: agentData?.name || 'Unknown Agent',
      agentEmail: agentData?.email,
      agentPhone: agentData?.phoneNumber,
      agentLocation: agentData?.location,

      // Calculated fields
      itemCount: formattedItems.length,
      assignmentDuration: assignment.completedDate && assignment.assignedDate 
        ? Math.round((assignment.completedDate - assignment.assignedDate) / (1000 * 60)) // Duration in minutes
        : null
    };

    console.log('Assignment enriched successfully');

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

// Update order assignment
export const updateOrderAssignment = async (req, res) => {
  console.log('=== UPDATE ORDER ASSIGNMENT ===');
  console.log('Request body:', req.body);
  
  const { orderId, status, priority, notes, deliveryAgentId } = req.body;

  // Validation
  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID is required'
    });
  }

  // Validate status if provided
  if (status) {
    const validStatuses = ['Assigned', 'In Progress', 'Completed', 'Failed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`
      });
    }
  }

  // Validate priority if provided
  if (priority) {
    const validPriorities = ['Low', 'Normal', 'High', 'Urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Valid priorities are: ${validPriorities.join(', ')}`
      });
    }
  }

  try {
    const assignment = await OrderAssignment.findOne({ orderId });
    if (!assignment) {
      return res.status(404).json({ 
        success: false,
        message: `Order assignment not found for order ID: ${orderId}` 
      });
    }

    console.log('Current assignment:', { 
      orderId: assignment.orderId, 
      status: assignment.status,
      agent: assignment.deliveryAgentId 
    });

    // Handle agent reassignment
    if (deliveryAgentId && deliveryAgentId !== assignment.deliveryAgentId) {
      console.log(`Reassigning from ${assignment.deliveryAgentId} to ${deliveryAgentId}`);
      
      // Check if new agent exists and is active
      const newAgent = await DeliveryAgent.findOne({ 
        agentId: deliveryAgentId, 
        status: 'Active' 
      });
      
      if (!newAgent) {
        return res.status(404).json({
          success: false,
          message: `New delivery agent "${deliveryAgentId}" not found or inactive`
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

      // Update the order record as well
      await Order.findOneAndUpdate(
        { orderId },
        { 
          assignedAgent: newAgent._id,
          deliveryAgentId: deliveryAgentId
        }
      );

      console.log('Agent reassignment completed');
    }

    // Update status and related timestamps
    if (status && status !== assignment.status) {
      const oldStatus = assignment.status;
      assignment.status = status;

      // Set appropriate timestamps based on status
      switch(status) {
        case 'In Progress':
          if (!assignment.startedDate) {
            assignment.startedDate = new Date();
          }
          break;
        case 'Completed':
          assignment.completedDate = new Date();
          assignment.actualDeliveryTime = new Date();
          break;
      }

      console.log(`Status updated from ${oldStatus} to ${status}`);
    }

    // Update other fields
    if (priority) assignment.priority = priority;
    if (notes !== undefined) assignment.notes = notes;
    
    assignment.lastModifiedBy = req.user?._id;
    assignment.lastModifiedDate = new Date();

    await assignment.save();
    console.log('Assignment saved successfully');

    // Update corresponding order status
    if (status) {
      let orderStatus = 'processing'; // default
      
      switch(status) {
        case 'Completed':
          orderStatus = 'completed';
          break;
        case 'In Progress':
          orderStatus = 'shipped';
          break;
        case 'Failed':
        case 'Cancelled':
          orderStatus = 'cancelled';
          break;
        case 'Assigned':
          orderStatus = 'processing';
          break;
        default:
          orderStatus = 'processing';
      }

      await Order.findOneAndUpdate(
        { orderId },
        { status: orderStatus, updatedAt: new Date() }
      );

      console.log(`Order status updated to: ${orderStatus}`);
    }

    console.log('Order assignment updated successfully:', orderId);

    // Return enriched assignment data
    const [updatedOrderData, agentData] = await Promise.all([
      Order.findOne({ orderId }),
      DeliveryAgent.findOne({ agentId: assignment.deliveryAgentId })
    ]);

    const enrichedResponse = {
      ...assignment.toObject(),
      customerName: updatedOrderData?.name,
      customerAddress: updatedOrderData?.address,
      agentName: agentData?.name,
      totalAmount: calculateTotalAmount(updatedOrderData?.orderedItems),
      orderItems: formatOrderItems(updatedOrderData?.orderedItems)
    };

    res.status(200).json({
      success: true,
      message: 'Order assignment updated successfully',
      data: enrichedResponse
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

// Delete order assignment (unassign order)
export const deleteOrderAssignment = async (req, res) => {
  console.log('=== DELETE ORDER ASSIGNMENT ===');
  
  const { orderId } = req.params;
  console.log('Order ID to unassign:', orderId);

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID parameter is required'
    });
  }

  try {
    const assignment = await OrderAssignment.findOne({ orderId });
    if (!assignment) {
      return res.status(404).json({ 
        success: false,
        message: `Order assignment not found for order ID: ${orderId}` 
      });
    }

    console.log('Assignment found:', { 
      orderId: assignment.orderId, 
      agent: assignment.deliveryAgentId,
      status: assignment.status 
    });

    // Check if assignment can be deleted (optional business rule)
    if (assignment.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot unassign completed orders'
      });
    }

    // Decrease agent's assigned orders count
    await DeliveryAgent.findOneAndUpdate(
      { agentId: assignment.deliveryAgentId },
      { $inc: { assignedOrders: -1 } }
    );

    console.log(`Decremented assigned orders count for agent: ${assignment.deliveryAgentId}`);

    // Remove assignment
    await OrderAssignment.findOneAndDelete({ orderId });
    console.log('Assignment deleted from database');

    // Update order status back to processing and remove agent references
    await Order.findOneAndUpdate(
      { orderId },
      { 
        status: 'processing',
        updatedAt: new Date(),
        $unset: { 
          assignedAgent: 1, 
          deliveryAgentId: 1, 
          assignedAt: 1 
        }
      }
    );

    console.log('Order updated - agent references removed');

    res.status(200).json({ 
      success: true,
      message: `Order assignment deleted successfully. Order ${orderId} is now available for reassignment.`
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

// Get assignment statistics
export const getAssignmentStatistics = async (req, res) => {
  console.log('=== GET ASSIGNMENT STATISTICS ===');
  
  try {
    const { agentId, startDate, endDate } = req.query;

    // Build date filter if provided
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.assignedDate = {};
      if (startDate) dateFilter.assignedDate.$gte = new Date(startDate);
      if (endDate) dateFilter.assignedDate.$lte = new Date(endDate);
    }

    // Build agent filter if provided
    let agentFilter = {};
    if (agentId) agentFilter.deliveryAgentId = agentId;

    const combinedFilter = { ...dateFilter, ...agentFilter };

    console.log('Statistics filter:', combinedFilter);

    const [
      totalAssigned,
      assignedCount,
      inProgressCount,
      completedCount,
      failedCount,
      cancelledCount,
      assignedOrderIds
    ] = await Promise.all([
      OrderAssignment.countDocuments(combinedFilter),
      OrderAssignment.countDocuments({ ...combinedFilter, status: 'Assigned' }),
      OrderAssignment.countDocuments({ ...combinedFilter, status: 'In Progress' }),
      OrderAssignment.countDocuments({ ...combinedFilter, status: 'Completed' }),
      OrderAssignment.countDocuments({ ...combinedFilter, status: 'Failed' }),
      OrderAssignment.countDocuments({ ...combinedFilter, status: 'Cancelled' }),
      OrderAssignment.distinct('orderId', combinedFilter)
    ]);

    // Get total unassigned count (not affected by date/agent filters for overall system stats)
    const totalUnassigned = await Order.countDocuments({
      orderId: { $nin: assignedOrderIds },
      status: { $in: ['processing', 'Pending', 'Confirmed', 'pending'] }
    });

    // Calculate completion rate
    const completionRate = totalAssigned > 0 ? 
      ((completedCount / totalAssigned) * 100).toFixed(2) : 0;

    // Calculate average delivery time for completed orders
    const completedAssignments = await OrderAssignment.find({
      ...combinedFilter,
      status: 'Completed',
      assignedDate: { $exists: true },
      completedDate: { $exists: true }
    }).select('assignedDate completedDate');

    let averageDeliveryTime = 0;
    if (completedAssignments.length > 0) {
      const totalDeliveryTime = completedAssignments.reduce((sum, assignment) => {
        const deliveryTime = assignment.completedDate - assignment.assignedDate;
        return sum + deliveryTime;
      }, 0);
      
      averageDeliveryTime = Math.round(totalDeliveryTime / completedAssignments.length / (1000 * 60)); // Average in minutes
    }

    const stats = {
      overview: {
        totalAssigned,
        totalUnassigned,
        completionRate: parseFloat(completionRate),
        averageDeliveryTimeMinutes: averageDeliveryTime
      },
      statusBreakdown: {
        assigned: assignedCount,
        inProgress: inProgressCount,
        completed: completedCount,
        failed: failedCount,
        cancelled: cancelledCount
      },
      filters: {
        agentId: agentId || 'All agents',
        dateRange: {
          startDate: startDate || 'No start date',
          endDate: endDate || 'No end date'
        }
      },
      summary: {
        activeAssignments: assignedCount + inProgressCount,
        completedAssignments: completedCount,
        problematicAssignments: failedCount + cancelledCount,
        totalProcessed: totalAssigned
      }
    };

    console.log('Statistics calculated:', {
      totalAssigned,
      completedCount,
      completionRate,
      averageDeliveryTime
    });

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

// Bulk operations for admin
export const bulkUpdateAssignments = async (req, res) => {
  console.log('=== BULK UPDATE ASSIGNMENTS ===');
  console.log('Request body:', req.body);

  const { orderIds, updates } = req.body;

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Order IDs array is required and cannot be empty'
    });
  }

  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Updates object is required'
    });
  }

  try {
    const validUpdates = {};
    
    // Validate and filter updates
    if (updates.status) {
      const validStatuses = ['Assigned', 'In Progress', 'Completed', 'Failed', 'Cancelled'];
      if (validStatuses.includes(updates.status)) {
        validUpdates.status = updates.status;
      }
    }
    
    if (updates.priority) {
      const validPriorities = ['Low', 'Normal', 'High', 'Urgent'];
      if (validPriorities.includes(updates.priority)) {
        validUpdates.priority = updates.priority;
      }
    }
    
    if (updates.notes !== undefined) {
      validUpdates.notes = updates.notes;
    }

    validUpdates.lastModifiedDate = new Date();
    if (req.user?._id) {
      validUpdates.lastModifiedBy = req.user._id;
    }

    console.log('Bulk updating assignments:', { orderIds, validUpdates });

    const result = await OrderAssignment.updateMany(
      { orderId: { $in: orderIds } },
      { $set: validUpdates }
    );

    console.log('Bulk update result:', result);

    res.status(200).json({
      success: true,
      message: `Bulk updated ${result.modifiedCount} assignments out of ${orderIds.length} requested`,
      data: {
        requestedCount: orderIds.length,
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
        updates: validUpdates
      }
    });

  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk update',
      error: error.message
    });
  }
};

// Get assignments requiring admin attention
export const getAssignmentsRequiringAttention = async (req, res) => {
  console.log('=== GET ASSIGNMENTS REQUIRING ATTENTION ===');

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const overdueTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours overdue

    // Find problematic assignments
    const problematicAssignments = await OrderAssignment.find({
      $or: [
        { status: 'Failed' },
        { reassignmentCount: { $gte: 2 } },
        { 
          status: { $in: ['Assigned', 'In Progress'] },
          assignedDate: { $lt: twentyFourHoursAgo }
        },
        {
          status: { $in: ['Assigned', 'In Progress'] },
          estimatedDeliveryTime: { $exists: true, $lt: overdueTime }
        }
      ]
    }).sort({ assignedDate: -1 });

    console.log(`Found ${problematicAssignments.length} assignments requiring attention`);

    // Enrich with order and agent data
    const enrichedProblems = await Promise.all(
      problematicAssignments.map(async (assignment) => {
        const [orderData, agentData] = await Promise.all([
          Order.findOne({ orderId: assignment.orderId }),
          DeliveryAgent.findOne({ agentId: assignment.deliveryAgentId })
        ]);

        let issueType = 'Unknown';
        let issueDescription = '';

        if (assignment.status === 'Failed') {
          issueType = 'Failed Delivery';
          issueDescription = 'Delivery marked as failed';
        } else if (assignment.reassignmentCount >= 2) {
          issueType = 'Multiple Reassignments';
          issueDescription = `Reassigned ${assignment.reassignmentCount} times`;
        } else if (assignment.assignedDate < twentyFourHoursAgo) {
          issueType = 'Long Pending';
          issueDescription = 'Assigned more than 24 hours ago';
        } else if (assignment.estimatedDeliveryTime && assignment.estimatedDeliveryTime < overdueTime) {
          issueType = 'Overdue';
          issueDescription = 'Past estimated delivery time';
        }

        return {
          _id: assignment._id,
          orderId: assignment.orderId,
          status: assignment.status,
          priority: assignment.priority,
          assignedDate: assignment.assignedDate,
          customerName: orderData?.name || 'Unknown',
          customerAddress: orderData?.address || 'Unknown',
          agentName: agentData?.name || 'Unknown',
          agentId: assignment.deliveryAgentId,
          totalAmount: calculateTotalAmount(orderData?.orderedItems),
          issueType,
          issueDescription,
          daysSinceAssignment: Math.floor((new Date() - assignment.assignedDate) / (1000 * 60 * 60 * 24)),
          notes: assignment.notes
        };
      })
    );

    res.status(200).json({
      success: true,
      count: enrichedProblems.length,
      data: enrichedProblems,
      categories: {
        failed: enrichedProblems.filter(a => a.issueType === 'Failed Delivery').length,
        overdue: enrichedProblems.filter(a => a.issueType === 'Overdue').length,
        longPending: enrichedProblems.filter(a => a.issueType === 'Long Pending').length,
        multipleReassignments: enrichedProblems.filter(a => a.issueType === 'Multiple Reassignments').length
      }
    });

  } catch (error) {
    console.error('Error fetching assignments requiring attention:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments requiring attention',
      error: error.message
    });
  }
};

// Search assignments with multiple criteria
export const searchAssignments = async (req, res) => {
  console.log('=== SEARCH ASSIGNMENTS ===');
  console.log('Query parameters:', req.query);

  try {
    const {
      orderId,
      customerName,
      agentName,
      status,
      priority,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    // Build search filter
    let searchFilter = {};

    if (orderId) {
      searchFilter.orderId = { $regex: orderId, $options: 'i' };
    }

    if (status) {
      searchFilter.status = status;
    }

    if (priority) {
      searchFilter.priority = priority;
    }

    if (startDate || endDate) {
      searchFilter.assignedDate = {};
      if (startDate) searchFilter.assignedDate.$gte = new Date(startDate);
      if (endDate) searchFilter.assignedDate.$lte = new Date(endDate);
    }

    console.log('Search filter:', searchFilter);

    // Get assignments matching filter
    const assignments = await OrderAssignment.find(searchFilter)
      .sort({ assignedDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    console.log(`Found ${assignments.length} assignments matching filter`);

    // Filter by customer name or agent name if provided
    let filteredAssignments = assignments;

    if (customerName || agentName) {
      const enrichedAssignments = await Promise.all(
        assignments.map(async (assignment) => {
          const [orderData, agentData] = await Promise.all([
            Order.findOne({ orderId: assignment.orderId }),
            DeliveryAgent.findOne({ agentId: assignment.deliveryAgentId })
          ]);

          const matchesCustomer = !customerName || 
            (orderData?.name && orderData.name.toLowerCase().includes(customerName.toLowerCase()));
          
          const matchesAgent = !agentName || 
            (agentData?.name && agentData.name.toLowerCase().includes(agentName.toLowerCase()));

          if (matchesCustomer && matchesAgent) {
            return {
              assignment,
              orderData,
              agentData
            };
          }
          return null;
        })
      );

      filteredAssignments = enrichedAssignments
        .filter(item => item !== null)
        .map(item => ({
          ...item.assignment.toObject(),
          customerName: item.orderData?.name,
          customerAddress: item.orderData?.address,
          customerPhone: item.orderData?.phone,
          agentName: item.agentData?.name,
          totalAmount: calculateTotalAmount(item.orderData?.orderedItems),
          orderItems: formatOrderItems(item.orderData?.orderedItems)
        }));
    } else {
      // No name filtering, just enrich data
      filteredAssignments = await Promise.all(
        assignments.map(async (assignment) => {
          const [orderData, agentData] = await Promise.all([
            Order.findOne({ orderId: assignment.orderId }),
            DeliveryAgent.findOne({ agentId: assignment.deliveryAgentId })
          ]);

          return {
            ...assignment.toObject(),
            customerName: orderData?.name,
            customerAddress: orderData?.address,
            customerPhone: orderData?.phone,
            agentName: agentData?.name,
            totalAmount: calculateTotalAmount(orderData?.orderedItems),
            orderItems: formatOrderItems(orderData?.orderedItems)
          };
        })
      );
    }

    console.log(`Returning ${filteredAssignments.length} filtered assignments`);

    res.status(200).json({
      success: true,
      count: filteredAssignments.length,
      data: filteredAssignments,
      searchCriteria: {
        orderId,
        customerName,
        agentName,
        status,
        priority,
        dateRange: { startDate, endDate }
      },
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error searching assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search assignments',
      error: error.message
    });
  }
};

// Get performance metrics for agents
export const getPerformanceMetrics = async (req, res) => {
  console.log('=== GET PERFORMANCE METRICS ===');
  
  try {
    const { agentId, startDate, endDate } = req.query;

    let matchFilter = {};
    if (agentId) matchFilter.deliveryAgentId = agentId;
    if (startDate || endDate) {
      matchFilter.assignedDate = {};
      if (startDate) matchFilter.assignedDate.$gte = new Date(startDate);
      if (endDate) matchFilter.assignedDate.$lte = new Date(endDate);
    }

    console.log('Performance metrics filter:', matchFilter);

    const metrics = await OrderAssignment.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: agentId ? null : '$deliveryAgentId',
          totalAssignments: { $sum: 1 },
          completedAssignments: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
          },
          failedAssignments: {
            $sum: { $cond: [{ $eq: ['$status', 'Failed'] }, 1, 0] }
          },
          inProgressAssignments: {
            $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
          },
          averageDeliveryTime: {
            $avg: {
              $cond: [
                { 
                  $and: [
                    { $ne: ['$assignedDate', null] }, 
                    { $ne: ['$completedDate', null] }
                  ]
                },
                { 
                  $divide: [
                    { $subtract: ['$completedDate', '$assignedDate'] }, 
                    1000 * 60 // Convert to minutes
                  ]
                },
                null
              ]
            }
          },
          totalReassignments: { $sum: '$reassignmentCount' },
          averageRating: { $avg: '$customerRating' }
        }
      },
      {
        $addFields: {
          completionRate: {
            $cond: [
              { $gt: ['$totalAssignments', 0] },
              { 
                $multiply: [
                  { $divide: ['$completedAssignments', '$totalAssignments'] }, 
                  100
                ]
              },
              0
            ]
          },
          failureRate: {
            $cond: [
              { $gt: ['$totalAssignments', 0] },
              { 
                $multiply: [
                  { $divide: ['$failedAssignments', '$totalAssignments'] }, 
                  100
                ]
              },
              0
            ]
          }
        }
      }
    ]);

    console.log('Performance metrics calculated:', metrics.length);

    // If specific agent requested, get agent details
    let agentDetails = null;
    if (agentId) {
      agentDetails = await DeliveryAgent.findOne({ agentId }).select('name email location status');
    }

    res.status(200).json({
      success: true,
      data: {
        metrics: metrics,
        agentDetails: agentDetails,
        period: {
          startDate: startDate || 'All time',
          endDate: endDate || 'All time',
          agentId: agentId || 'All agents'
        }
      }
    });

  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance metrics',
      error: error.message
    });
  }
};

// Export assignments data for reports
export const exportAssignments = async (req, res) => {
  console.log('=== EXPORT ASSIGNMENTS ===');
  
  try {
    const { format = 'json', status, agentId, startDate, endDate } = req.query;

    // Build filter
    let filter = {};
    if (status) filter.status = status;
    if (agentId) filter.deliveryAgentId = agentId;
    if (startDate || endDate) {
      filter.assignedDate = {};
      if (startDate) filter.assignedDate.$gte = new Date(startDate);
      if (endDate) filter.assignedDate.$lte = new Date(endDate);
    }

    console.log('Export filter:', filter);

    const assignments = await OrderAssignment.find(filter).sort({ assignedDate: -1 });

    // Enrich with order and agent data
    const exportData = await Promise.all(
      assignments.map(async (assignment) => {
        const [orderData, agentData] = await Promise.all([
          Order.findOne({ orderId: assignment.orderId }),
          DeliveryAgent.findOne({ agentId: assignment.deliveryAgentId })
        ]);

        return {
          orderId: assignment.orderId,
          customerName: orderData?.name || 'Unknown',
          customerAddress: orderData?.address || 'Unknown',
          customerPhone: orderData?.phone || 'Unknown',
          agentName: agentData?.name || 'Unknown',
          agentId: assignment.deliveryAgentId,
          status: assignment.status,
          priority: assignment.priority,
          assignedDate: assignment.assignedDate,
          completedDate: assignment.completedDate,
          totalAmount: calculateTotalAmount(orderData?.orderedItems),
          itemCount: orderData?.orderedItems?.length || 0,
          notes: assignment.notes || '',
          deliveryTimeMinutes: assignment.completedDate && assignment.assignedDate ?
            Math.round((assignment.completedDate - assignment.assignedDate) / (1000 * 60)) : null
        };
      })
    );

    console.log(`Exporting ${exportData.length} assignments in ${format} format`);

    if (format.toLowerCase() === 'csv') {
      // Convert to CSV format
      const csvHeaders = Object.keys(exportData[0] || {}).join(',');
      const csvRows = exportData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        ).join(',')
      );
      const csvContent = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=assignments_export_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
    } else {
      // Default JSON format
      res.status(200).json({
        success: true,
        count: exportData.length,
        exportDate: new Date().toISOString(),
        filters: { status, agentId, startDate, endDate },
        data: exportData
      });
    }

  } catch (error) {
    console.error('Error exporting assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export assignments',
      error: error.message
    });
  }
};

// Health check for the assignment service
export const healthCheck = async (req, res) => {
  try {
    // Test database connectivity
    const assignmentCount = await OrderAssignment.countDocuments();
    const orderCount = await Order.countDocuments();
    const agentCount = await DeliveryAgent.countDocuments();

    res.status(200).json({
      success: true,
      message: 'Order Assignment service is healthy',
      timestamp: new Date().toISOString(),
      data: {
        totalAssignments: assignmentCount,
        totalOrders: orderCount,
        totalAgents: agentCount,
        databaseConnected: true
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Order Assignment service health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};