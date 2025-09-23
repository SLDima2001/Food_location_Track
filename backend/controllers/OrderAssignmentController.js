import OrderAssignment from '../models/OrderAssignmentModel.js';

// Create an order assignment
export const createOrderAssignment = async (req, res) => {
  const { orderId, deliveryAgentId } = req.body;

  if (!orderId || !deliveryAgentId) {
    return res.status(400).json({ message: 'Order ID and Delivery Agent ID are required.' });
  }

  try {
    const newAssignment = new OrderAssignment({ orderId, deliveryAgentId });
    await newAssignment.save();
    res.status(201).json(newAssignment);
  } catch (error) {
    res.status(500).json({ message: 'Failed to assign order.' });
  }
};

export const getAssignedOrders = async (req, res) => {
  try {
    const assignments = await OrderAssignment.find();
    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch assigned orders.' });
  }
};

export const getAssignedOrderById = async (req, res) => {
  const { orderId } = req.params;

  try {
    const assignment = await OrderAssignment.findOne({ orderId });
    if (!assignment) {
      return res.status(404).json({ message: 'Order assignment not found.' });
    }
    res.status(200).json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch assigned order.' });
  }
};

export const updateOrderAssignment = async (req, res) => {
  const { orderId, status } = req.body;

  try {
    const assignment = await OrderAssignment.findOneAndUpdate(
      { orderId },
      { status },
      { new: true }
    );
    if (!assignment) {
      return res.status(404).json({ message: 'Order assignment not found.' });
    }
    res.status(200).json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update order assignment.' });
  }
};

export const deleteOrderAssignment = async (req, res) => {
  const { orderId } = req.params;

  try {
    const assignment = await OrderAssignment.findOneAndDelete({ orderId });
    if (!assignment) {
      return res.status(404).json({ message: 'Order assignment not found.' });
    }
    res.status(200).json({ message: 'Order assignment deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete order assignment.' });
  }
};
