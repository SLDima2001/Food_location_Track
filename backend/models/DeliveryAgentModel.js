// models/deliveryAgent.js - Simple version that works with your existing setup

import mongoose from 'mongoose';

const deliveryAgentSchema = new mongoose.Schema({
  // Unique agent identifier (DA001, DA002, etc.)
  agentId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Personal Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  
  // Work Information
  location: {
    type: String,
    required: true,
    trim: true
  },
  
  status: {
    type: String,
    required: true,
    enum: ['Active', 'Inactive', 'Busy'],
    default: 'Active'
  },
  
  // Performance Metrics
  assignedOrders: {
    type: Number,
    default: 0
  },
  
  completedDeliveries: {
    type: Number,
    default: 0
  },
  
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // This will automatically handle createdAt and updatedAt
});

// Index for better performance
deliveryAgentSchema.index({ agentId: 1 });
deliveryAgentSchema.index({ email: 1 });
deliveryAgentSchema.index({ status: 1 });

// Pre-save middleware
deliveryAgentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  next();
});

const DeliveryAgent = mongoose.model('DeliveryAgent', deliveryAgentSchema);

export default DeliveryAgent;