// models/OrderAssignmentModel.js - Enhanced model with admin edit capabilities

import mongoose from 'mongoose';

const { Schema } = mongoose;

const OrderAssignmentSchema = new Schema({
  // Core assignment fields
  orderId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  
  deliveryAgentId: { 
    type: String, 
    required: true,
    index: true
  },
  
  // Status and priority
  status: { 
    type: String, 
    required: true,
    enum: ['Assigned', 'In Progress', 'Completed', 'Failed', 'Cancelled'],
    default: 'Assigned',
    index: true
  },
  
  priority: {
    type: String,
    enum: ['Low', 'Normal', 'High', 'Urgent'],
    default: 'Normal',
    index: true
  },

  // Timestamp fields
  assignedDate: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  
  startedDate: { 
    type: Date 
  },
  
  completedDate: { 
    type: Date 
  },
  
  estimatedDeliveryTime: { 
    type: Date 
  },
  
  actualDeliveryTime: { 
    type: Date 
  },

  // Admin fields for tracking changes
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  lastModifiedDate: {
    type: Date,
    default: Date.now
  },

  // Notes and tracking
  notes: { 
    type: String,
    trim: true
  },
  
  adminNotes: {
    type: String,
    trim: true
  },
  
  assignmentHistory: [{
    action: {
      type: String,
      required: true,
      enum: ['assigned', 'reassigned', 'status_changed', 'priority_changed', 'completed', 'cancelled', 'failed']
    },
    previousValue: String,
    newValue: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String
  }],

  // Reassignment tracking
  reassignmentCount: {
    type: Number,
    default: 0
  },
  
  previousAgents: [{
    agentId: String,
    assignedDate: Date,
    reassignedDate: Date,
    reason: String
  }],

  // Performance tracking
  pickupTime: { 
    type: Date 
  },
  
  deliveryTime: { 
    type: Date 
  },
  
  customerRating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  customerFeedback: {
    type: String,
    trim: true
  },

  // Location tracking
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number },
    address: String,
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },

  // Delivery proof
  deliveryProof: {
    photos: [String],
    signature: String,
    deliveredTo: String,
    deliveryNotes: String
  },

  // Issue tracking
  issues: [{
    type: {
      type: String,
      enum: ['delayed', 'customer_unavailable', 'address_issue', 'product_issue', 'vehicle_breakdown', 'weather', 'other']
    },
    description: String,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedAt: Date,
    resolution: String
  }],

  // Financial tracking
  deliveryFee: {
    type: Number,
    min: 0
  },
  
  agentCommission: {
    type: Number,
    min: 0
  },

  // Cancellation tracking
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date,

  // Additional metadata
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
}, {
  timestamps: true // This will automatically handle createdAt and updatedAt
});

// Indexes for better query performance
OrderAssignmentSchema.index({ orderId: 1, deliveryAgentId: 1 });
OrderAssignmentSchema.index({ status: 1, assignedDate: -1 });
OrderAssignmentSchema.index({ deliveryAgentId: 1, status: 1 });
OrderAssignmentSchema.index({ priority: 1, assignedDate: -1 });
OrderAssignmentSchema.index({ assignedDate: -1 });
OrderAssignmentSchema.index({ completedDate: -1 });

// Pre-save middleware to update lastModifiedDate and track changes
OrderAssignmentSchema.pre('save', function(next) {
  this.lastModifiedDate = new Date();
  
  // Track status changes in history
  if (this.isModified('status') && !this.isNew) {
    const previousStatus = this._original?.status;
    if (previousStatus && previousStatus !== this.status) {
      this.assignmentHistory.push({
        action: 'status_changed',
        previousValue: previousStatus,
        newValue: this.status,
        timestamp: new Date(),
        performedBy: this.lastModifiedBy
      });
    }
  }

  // Track priority changes
  if (this.isModified('priority') && !this.isNew) {
    const previousPriority = this._original?.priority;
    if (previousPriority && previousPriority !== this.priority) {
      this.assignmentHistory.push({
        action: 'priority_changed',
        previousValue: previousPriority,
        newValue: this.priority,
        timestamp: new Date(),
        performedBy: this.lastModifiedBy
      });
    }
  }

  // Track reassignments
  if (this.isModified('deliveryAgentId') && !this.isNew) {
    const previousAgent = this._original?.deliveryAgentId;
    if (previousAgent && previousAgent !== this.deliveryAgentId) {
      this.reassignmentCount += 1;
      this.previousAgents.push({
        agentId: previousAgent,
        assignedDate: this._original?.assignedDate,
        reassignedDate: new Date(),
        reason: this.metadata?.get('reassignmentReason') || 'Admin reassignment'
      });
      
      this.assignmentHistory.push({
        action: 'reassigned',
        previousValue: previousAgent,
        newValue: this.deliveryAgentId,
        timestamp: new Date(),
        performedBy: this.lastModifiedBy,
        reason: this.metadata?.get('reassignmentReason')
      });
    }
  }

  // Set completion time when status changes to completed
  if (this.isModified('status') && this.status === 'Completed' && !this.completedDate) {
    this.completedDate = new Date();
    this.actualDeliveryTime = new Date();
  }

  // Set started time when status changes to In Progress
  if (this.isModified('status') && this.status === 'In Progress' && !this.startedDate) {
    this.startedDate = new Date();
  }

  next();
});

// Post-save middleware to store original values for comparison
OrderAssignmentSchema.post('init', function() {
  this._original = this.toObject();
});

// Virtual for calculating delivery duration
OrderAssignmentSchema.virtual('deliveryDuration').get(function() {
  if (this.completedDate && this.assignedDate) {
    return Math.round((this.completedDate - this.assignedDate) / (1000 * 60)); // Duration in minutes
  }
  return null;
});

// Virtual for calculating if assignment is overdue
OrderAssignmentSchema.virtual('isOverdue').get(function() {
  if (this.estimatedDeliveryTime && this.status !== 'Completed' && this.status !== 'Cancelled') {
    return new Date() > this.estimatedDeliveryTime;
  }
  return false;
});

// Static method to get assignments requiring admin attention
OrderAssignmentSchema.statics.getAssignmentsRequiringAttention = function() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const overdueTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours overdue
  
  return this.find({
    $or: [
      { status: 'Failed' },
      { reassignmentCount: { $gte: 2 } },
      { 
        status: { $in: ['Assigned', 'In Progress'] },
        assignedDate: { $lt: twentyFourHoursAgo }
      },
      {
        status: { $in: ['Assigned', 'In Progress'] },
        estimatedDeliveryTime: { $lt: overdueTime }
      },
      { issues: { $elemMatch: { resolved: false } } }
    ]
  }).populate('issues.reportedBy', 'name email');
};

// Static method to get performance metrics
OrderAssignmentSchema.statics.getPerformanceMetrics = function(agentId = null, startDate = null, endDate = null) {
  const matchStage = {};
  
  if (agentId) matchStage.deliveryAgentId = agentId;
  if (startDate && endDate) {
    matchStage.assignedDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  return this.aggregate([
    { $match: matchStage },
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
        averageDeliveryTime: {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$assignedDate', null] }, { $ne: ['$completedDate', null] }] },
              { $divide: [{ $subtract: ['$completedDate', '$assignedDate'] }, 1000 * 60] },
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
            { $multiply: [{ $divide: ['$completedAssignments', '$totalAssignments'] }, 100] },
            0
          ]
        }
      }
    }
  ]);
};

// Instance method to add issue
OrderAssignmentSchema.methods.addIssue = function(issueData, reportedBy) {
  this.issues.push({
    ...issueData,
    reportedBy: reportedBy,
    reportedAt: new Date()
  });
  return this.save();
};

// Instance method to resolve issue
OrderAssignmentSchema.methods.resolveIssue = function(issueId, resolution) {
  const issue = this.issues.id(issueId);
  if (issue) {
    issue.resolved = true;
    issue.resolvedAt = new Date();
    issue.resolution = resolution;
    return this.save();
  }
  throw new Error('Issue not found');
};

// Ensure virtual fields are serialized
OrderAssignmentSchema.set('toJSON', { virtuals: true });
OrderAssignmentSchema.set('toObject', { virtuals: true });

const OrderAssignment = mongoose.model('OrderAssignment', OrderAssignmentSchema);

export default OrderAssignment;