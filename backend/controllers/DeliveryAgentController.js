// controllers/DeliveryAgentController.js - Complete version with all exports

import DeliveryAgent from '../models/DeliveryAgentModel.js';
import Order from '../models/order.js';

// Create a new delivery agent
export const createDeliveryAgent = async (req, res) => {
  try {
    const { name, email, phoneNumber, location, status = 'Active' } = req.body;

    // Validation
    if (!name || !email || !phoneNumber || !location) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone number, and location are required'
      });
    }

    // Check if email already exists
    const existingAgent = await DeliveryAgent.findOne({ email: email.toLowerCase() });
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'An agent with this email already exists'
      });
    }

    // Generate unique agent ID
    const lastAgent = await DeliveryAgent.findOne({}, {}, { sort: { 'agentId': -1 } });
    let newAgentId = 'DA001';
    
    if (lastAgent && lastAgent.agentId) {
      const lastIdNumber = parseInt(lastAgent.agentId.replace('DA', ''));
      newAgentId = `DA${String(lastIdNumber + 1).padStart(3, '0')}`;
    }

    // Create new agent
    const newAgent = new DeliveryAgent({
      agentId: newAgentId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      location: location.trim(),
      status,
      assignedOrders: 0,
      completedDeliveries: 0,
      rating: 0,
      createdAt: new Date(),
      lastActive: new Date()
    });

    const savedAgent = await newAgent.save();

    console.log('New delivery agent created:', savedAgent.agentId);

    res.status(201).json({
      success: true,
      message: 'Delivery agent created successfully',
      data: savedAgent
    });
  } catch (error) {
    console.error('Error creating delivery agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create delivery agent',
      error: error.message
    });
  }
};

// Get all delivery agents
export const getDeliveryAgents = async (req, res) => {
  try {
    const {
      status,
      location,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (location) filter.location = { $regex: location, $options: 'i' };
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { agentId: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Fetch agents with filters, pagination, and sorting
    const [agents, totalCount] = await Promise.all([
      DeliveryAgent.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      DeliveryAgent.countDocuments(filter)
    ]);

    console.log(`Retrieved ${agents.length} delivery agents`);

    res.status(200).json({
      success: true,
      data: agents,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching delivery agents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery agents',
      error: error.message
    });
  }
};

// Get delivery agent by ID
export const getDeliveryAgentById = async (req, res) => {
  try {
    const { agentId } = req.params;

    // Try to find by MongoDB _id first, then by agentId
    let agent = await DeliveryAgent.findById(agentId).select('-__v');
    
    if (!agent) {
      // If not found by _id, try to find by agentId (DA001, DA002, etc.)
      agent = await DeliveryAgent.findOne({ agentId }).select('-__v');
    }
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Delivery agent not found'
      });
    }

    // Get agent's current orders if Order model is available
    let currentOrders = [];
    try {
      currentOrders = await Order.find({
        $or: [
          { deliveryAgentId: agent.agentId },
          { assignedAgent: agent._id }
        ],
        status: { $in: ['Assigned', 'Picked Up', 'In Transit', 'Pending'] }
      }).select('_id customerName customerAddress status createdAt totalAmount');
    } catch (orderError) {
      console.log('Could not fetch orders (Order model may not exist):', orderError.message);
    }

    console.log(`Retrieved agent details for: ${agent.agentId}`);

    res.status(200).json({
      success: true,
      data: {
        ...agent.toObject(),
        currentOrders
      }
    });
  } catch (error) {
    console.error('Error fetching delivery agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery agent',
      error: error.message
    });
  }
};

// Update delivery agent
export const updateDeliveryAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.agentId;
    delete updateData.createdAt;

    // Check if email is being updated and if it already exists
    if (updateData.email) {
      const existingAgent = await DeliveryAgent.findOne({
        email: updateData.email.toLowerCase().trim(),
        $and: [
          { _id: { $ne: agentId } },
          { agentId: { $ne: agentId } }
        ]
      });
      
      if (existingAgent) {
        return res.status(400).json({
          success: false,
          message: 'An agent with this email already exists'
        });
      }
      
      updateData.email = updateData.email.toLowerCase().trim();
    }

    // Add updated timestamp
    updateData.updatedAt = new Date();

    // Try to update by MongoDB _id first, then by agentId
    let updatedAgent = await DeliveryAgent.findByIdAndUpdate(
      agentId,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updatedAgent) {
      // If not found by _id, try to update by agentId
      updatedAgent = await DeliveryAgent.findOneAndUpdate(
        { agentId },
        updateData,
        { new: true, runValidators: true }
      ).select('-__v');
    }

    if (!updatedAgent) {
      return res.status(404).json({
        success: false,
        message: 'Delivery agent not found'
      });
    }

    console.log(`Updated delivery agent: ${updatedAgent.agentId}`);

    res.status(200).json({
      success: true,
      message: 'Delivery agent updated successfully',
      data: updatedAgent
    });
  } catch (error) {
    console.error('Error updating delivery agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery agent',
      error: error.message
    });
  }
};

// Delete delivery agent
export const deleteDeliveryAgent = async (req, res) => {
  try {
    const { agentId } = req.params;

    // First, try to find the agent
    let agent = await DeliveryAgent.findById(agentId);
    
    if (!agent) {
      // If not found by _id, try to find by agentId
      agent = await DeliveryAgent.findOne({ agentId });
    }

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Delivery agent not found'
      });
    }

    // Check if agent has active orders (if Order model is available)
    let activeOrders = 0;
    try {
      activeOrders = await Order.countDocuments({
        $or: [
          { deliveryAgentId: agent.agentId },
          { assignedAgent: agent._id }
        ],
        status: { $in: ['Assigned', 'Picked Up', 'In Transit'] }
      });
    } catch (orderError) {
      console.log('Could not check active orders (Order model may not exist):', orderError.message);
    }

    if (activeOrders > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete agent with ${activeOrders} active orders. Please reassign or complete active orders first.`
      });
    }

    // Delete the agent
    await DeliveryAgent.findByIdAndDelete(agent._id);

    console.log(`Deleted delivery agent: ${agent.agentId}`);

    res.status(200).json({
      success: true,
      message: 'Delivery agent deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting delivery agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete delivery agent',
      error: error.message
    });
  }
};

// Get agent statistics
export const getAgentStatistics = async (req, res) => {
  try {
    const { agentId } = req.params;

    let agent = await DeliveryAgent.findById(agentId);
    if (!agent) {
      agent = await DeliveryAgent.findOne({ agentId });
    }
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Delivery agent not found'
      });
    }

    // Get detailed statistics
    let totalOrders = 0;
    let completedOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;

    try {
      [totalOrders, completedOrders, pendingOrders, cancelledOrders] = await Promise.all([
        Order.countDocuments({
          $or: [
            { deliveryAgentId: agent.agentId },
            { assignedAgent: agent._id }
          ]
        }),
        Order.countDocuments({
          $or: [
            { deliveryAgentId: agent.agentId },
            { assignedAgent: agent._id }
          ],
          status: 'Delivered'
        }),
        Order.countDocuments({
          $or: [
            { deliveryAgentId: agent.agentId },
            { assignedAgent: agent._id }
          ],
          status: { $in: ['Assigned', 'Picked Up', 'In Transit'] }
        }),
        Order.countDocuments({
          $or: [
            { deliveryAgentId: agent.agentId },
            { assignedAgent: agent._id }
          ],
          status: 'Failed'
        })
      ]);
    } catch (orderError) {
      console.log('Could not fetch order statistics (Order model may not exist):', orderError.message);
    }

    const stats = {
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      successRate: totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(2) : 0,
      rating: agent.rating || 0
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching agent statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agent statistics',
      error: error.message
    });
  }
};

// Get unassigned orders
export const getUnassignedOrders = async (req, res) => {
  try {
    let unassignedOrders = [];
    
    try {
      unassignedOrders = await Order.find({
        $and: [
          { status: { $in: ['Pending', 'Confirmed'] } },
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
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(50);
    } catch (orderError) {
      console.log('Could not fetch unassigned orders (Order model may not exist):', orderError.message);
      // Return empty array if Order model doesn't exist
      unassignedOrders = [];
    }

    console.log(`Found ${unassignedOrders.length} unassigned orders`);

    res.status(200).json({
      success: true,
      count: unassignedOrders.length,
      data: unassignedOrders
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

// Assign order to agent
export const assignOrderToAgent = async (req, res) => {
  try {
    const { orderId, agentId } = req.body;

    if (!orderId || !agentId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and Agent ID are required'
      });
    }

    // Find the agent
    let agent = await DeliveryAgent.findOne({ agentId, status: 'Active' });
    if (!agent) {
      agent = await DeliveryAgent.findById(agentId);
    }

    if (!agent || agent.status !== 'Active') {
      return res.status(404).json({
        success: false,
        message: 'Active delivery agent not found'
      });
    }

    try {
      // Find and update the order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      if (order.deliveryAgentId || order.assignedAgent) {
        return res.status(400).json({
          success: false,
          message: 'Order is already assigned to a delivery agent'
        });
      }

      // Update the order
      order.deliveryAgentId = agent.agentId;
      order.assignedAgent = agent._id;
      order.status = 'Assigned';
      order.assignedAt = new Date();
      await order.save();

      // Update agent's assigned orders count
      agent.assignedOrders += 1;
      agent.lastActive = new Date();
      await agent.save();

      console.log(`Order ${orderId} assigned to agent ${agent.agentId}`);

      res.status(200).json({
        success: true,
        message: 'Order assigned to delivery agent successfully',
        data: {
          order,
          agent: {
            agentId: agent.agentId,
            name: agent.name,
            location: agent.location
          }
        }
      });
    } catch (orderError) {
      console.log('Could not assign order (Order model may not exist):', orderError.message);
      res.status(500).json({
        success: false,
        message: 'Could not assign order - Order management not available',
        error: orderError.message
      });
    }
  } catch (error) {
    console.error('Error assigning order to agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign order to agent',
      error: error.message
    });
  }
};