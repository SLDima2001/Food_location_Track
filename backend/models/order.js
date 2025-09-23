import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  orderedItems: [{
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    image: {
      type: String,
      default: "default-image-url"
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'completed'],
      default: 'pending'
    }
  }],
  status: {
    type: String,
    enum: ['processing', 'shipped', 'completed', 'cancelled'],
    default: 'processing'
  },
  notes: {
    type: String,
    default: ""
  },
  date: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Optional delivery-related fields
  deliveryAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryAgent'
  },
  estimatedDeliveryTime: {
    type: Date
  },
  actualDeliveryTime: {
    type: Date
  },
  deliveryLocation: {
    lat: { type: Number },
    lng: { type: Number }
  }
}, {
  timestamps: true // This will automatically handle createdAt and updatedAt
});

// Update the updatedAt field before saving
orderSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Index for faster queries
orderSchema.index({ orderId: 1 });
orderSchema.index({ email: 1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;