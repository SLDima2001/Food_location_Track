// controllers/DeliveryAgentController.js
import DeliveryAgent from "../models/DeliveryAgentModel.js";

export const createDeliveryAgent = async (req, res) => {
  console.log('=== CREATE DELIVERY AGENT REQUEST ===');
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  
  const { agentId, name, phoneNumber, email, status, location } = req.body;

  if (!agentId || !name || !phoneNumber || !email || !location) {
    return res.status(400).json({ 
      success: false,
      message: 'All fields are required.',
      required: ['agentId', 'name', 'phoneNumber', 'email', 'location']
    });
  }

  try {
    // Check if agent with same ID or email already exists
    const existingAgent = await DeliveryAgent.findOne({
      $or: [{ agentId }, { email }]
    });

    if (existingAgent) {
      return res.status(409).json({
        success: false,
        message: 'Agent with this ID or email already exists.'
      });
    }

    const newAgent = new DeliveryAgent({ 
      agentId, 
      name, 
      phoneNumber, 
      email, 
      status: status || 'Active', 
      location 
    });
    
    await newAgent.save();
    console.log('Agent created successfully:', newAgent);
    
    res.status(201).json({
      success: true,
      message: 'Delivery agent created successfully',
      data: newAgent
    });
  } catch (error) {
    console.error('Error creating delivery agent:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create delivery agent.',
      error: error.message
    });
  }
};

export const getDeliveryAgents = async (req, res) => {
  try {
    console.log('Fetching all delivery agents...');
    const agents = await DeliveryAgent.find().sort({ createdAt: -1 });
    console.log(`Found ${agents.length} delivery agents`);
    
    res.status(200).json({
      success: true,
      count: agents.length,
      data: agents
    });
  } catch (error) {
    console.error('Error fetching delivery agents:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch delivery agents.',
      error: error.message
    });
  }
};

export const getDeliveryAgentById = async (req, res) => {
  const { agentId } = req.params;
  try {
    const agent = await DeliveryAgent.findOne({ agentId });
    if (!agent) {
      return res.status(404).json({ message: 'Delivery agent not found.' });
    }
    res.status(200).json(agent);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch delivery agent.' });
  }
};

export const updateDeliveryAgent = async (req, res) => {
  const { agentId } = req.params;
  const { name, phoneNumber, email, status, location } = req.body;

  console.log('Updating delivery agent:', agentId, 'with data:', req.body);

  if (!agentId) {
    return res.status(400).json({
      success: false,
      message: 'Agent ID is required for update.'
    });
  }

  try {
    // Check if email is being changed and if it conflicts with another agent
    if (email) {
      const existingAgent = await DeliveryAgent.findOne({
        email: email,
        agentId: { $ne: agentId }
      });

      if (existingAgent) {
        return res.status(409).json({
          success: false,
          message: 'Another agent with this email already exists.'
        });
      }
    }

    const agent = await DeliveryAgent.findOneAndUpdate(
      { agentId },
      { name, phoneNumber, email, status, location, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!agent) {
      return res.status(404).json({ 
        success: false,
        message: 'Delivery agent not found.' 
      });
    }
    
    console.log('Agent updated successfully:', agent);
    
    res.status(200).json({
      success: true,
      message: 'Delivery agent updated successfully',
      data: agent
    });
  } catch (error) {
    console.error('Error updating delivery agent:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update delivery agent.',
      error: error.message
    });
  }
};

export const deleteDeliveryAgent = async (req, res) => {
  const { agentId } = req.params;
  try {
    const agent = await DeliveryAgent.findOneAndDelete({ agentId });
    if (!agent) {
      return res.status(404).json({ message: 'Delivery agent not found.' });
    }
    res.status(200).json({ message: 'Delivery agent deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete delivery agent.' });
  }
};