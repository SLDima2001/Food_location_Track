import mongoose from 'mongoose';

const { Schema } = mongoose;

const OrderAssignmentSchema = new Schema({
  orderId: { type: String, required: true, unique: true },  // Link to order
  deliveryAgentId: { type: String, required: true },        // Link to delivery agent
  assignedDate: { type: Date, default: Date.now },
  status: { type: String, default: 'Assigned' },            // (Assigned, In Progress, Completed)
});

export default mongoose.model('OrderAssignment', OrderAssignmentSchema);
