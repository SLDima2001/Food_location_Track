import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../../services/api'; // Import your API service
import './Home.css';

function Order() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [debugInfo, setDebugInfo] = useState({});

  // Function to fetch orders using ApiService
  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the ApiService instead of direct fetch
      const data = await ApiService.getOrders();
      
      console.log('Response data:', data);
      
      // Check if data has the expected structure
      if (!data || !data.list) {
        console.error('Unexpected response structure:', data);
        throw new Error('Invalid response structure from server');
      }

      // Transform backend order data to match frontend expectations
      const transformedOrders = data.list.map(order => {
        console.log('Processing order:', order);
        return {
          _id: order._id,
          orderId: order.orderId,
          customerName: order.name,
          customerAddress: order.address,
          customerPhone: order.phone,
          customerEmail: order.email,
          status: mapBackendStatus(order.status),
          date: order.date,
          orderedItems: order.orderedItems,
          notes: order.notes
        };
      });

      console.log('Transformed orders:', transformedOrders);
      setOrders(transformedOrders);
      
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Map backend status to frontend status
  const mapBackendStatus = (backendStatus) => {
    const statusMap = {
      'processing': 'Pending',
      'shipped': 'In Transit',
      'completed': 'Delivered',
      'cancelled': 'Cancelled'
    };
    return statusMap[backendStatus] || 'Pending';
  };

  // Update order status using ApiService
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const backendStatus = mapFrontendToBackendStatus(newStatus);
      
      // Use ApiService to update order
      await ApiService.updateOrderStatus(orderId, backendStatus);
      
      console.log('Order updated successfully');
      
      // Refresh orders list
      fetchOrders();
      
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status: ' + err.message);
    }
  };

  // Map frontend status to backend status
  const mapFrontendToBackendStatus = (frontendStatus) => {
    const statusMap = {
      'Pending': 'processing',
      'In Transit': 'shipped',
      'Delivered': 'completed',
      'Cancelled': 'cancelled'
    };
    return statusMap[frontendStatus] || 'processing';
  };

  // Initialize orders on component mount
  useEffect(() => {
    fetchOrders();
  }, []);

  const startDelivery = (orderId) => {
    console.log('Starting delivery for order:', orderId);
    updateOrderStatus(orderId, 'In Transit');
    navigate(`/map/${orderId}`);
  };

  const completeDelivery = (orderId) => {
    console.log('Completing delivery for order:', orderId);
    updateOrderStatus(orderId, 'Delivered');
  };

  // Calculate total order value
  const calculateOrderTotal = (orderedItems) => {
    if (!orderedItems || orderedItems.length === 0) return '0.00';
    return orderedItems.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="home-container">
        <div className="header">
          <h2>Delivery Orders</h2>
          <button 
            className="refresh-button" 
            onClick={fetchOrders}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
        <div className="loading">Loading orders...</div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="home-container">
        <div className="header">
          <h2>Delivery Orders</h2>
          <button 
            className="refresh-button" 
            onClick={fetchOrders}
          >
            Retry
          </button>
        </div>
        <div className="error">
          <p>Error: {error}</p>
          <button onClick={fetchOrders}>Retry</button>
          <div className="debug-info">
            <h3>Debug Information:</h3>
            <p>Token in storage: {localStorage.getItem('token') ? 'Present' : 'Missing'}</p>
            <p>If token is missing, please <button onClick={() => navigate('/login')}>Login</button></p>
          </div>
        </div>
      </div>
    );
  }

  // Filter orders based on status (show processing and shipped orders for delivery)
  const activeOrders = orders.filter(order => 
    order.status === 'Pending' || order.status === 'In Transit'
  );

  return (
    <div className="home-container">
      <div className="header">
        <h2>Delivery Orders</h2>
        <button 
          className="refresh-button" 
          onClick={fetchOrders}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      {error && (
        <div className="warning">
          <p>Warning: {error}</p>
        </div>
      )}

      <div className="orders-summary">
        <p>Total Active Orders: {activeOrders.length}</p>
        <small>Total Orders in Database: {orders.length}</small>
      </div>

      <div className="orders-list">
        {activeOrders.length === 0 ? (
          <div className="no-orders">
            <p>No active orders available for delivery.</p>
            <p>Total orders loaded: {orders.length}</p>
            <button onClick={fetchOrders}>Refresh Orders</button>
          </div>
        ) : (
          activeOrders.map(order => (
            <div key={order._id} className="order-card">
              <div className="order-header">
                <div className="order-id">
                  <strong>Order #{order.orderId}</strong>
                </div>
                <div className={`status-badge ${order.status.toLowerCase().replace(' ', '-')}`}>
                  {order.status}
                </div>
              </div>
              
              <div className="order-info">
                <p>
                  <b>Customer:</b>
                  <span>{order.customerName}</span>
                </p>
                <p>
                  <b>Phone:</b>
                  <span>{order.customerPhone}</span>
                </p>
                <p>
                  <b>Email:</b>
                  <span>{order.customerEmail}</span>
                </p>
                <p>
                  <b>Address:</b>
                  <span>{order.customerAddress}</span>
                </p>
                <p>
                  <b>Order Date:</b>
                  <span>{new Date(order.date).toLocaleDateString()}</span>
                </p>
                
                {order.orderedItems && order.orderedItems.length > 0 && (
                  <>
                    <div className="ordered-items">
                      <b>Items ({order.orderedItems.length}):</b>
                      <div className="items-list">
                        {order.orderedItems.map((item, index) => (
                          <div key={index} className="order-item">
                            {item.image && (
                              <img 
                                src={item.image} 
                                alt={item.name} 
                                className="item-image"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="item-details">
                              <span className="item-name">{item.name}</span>
                              <span className="item-quantity">Qty: {item.quantity}</span>
                              <span className="item-price">Rs. {item.price.toFixed(2)} each</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p>
                      <b>Total Amount:</b>
                      <span className="total-amount">Rs. {calculateOrderTotal(order.orderedItems)}</span>
                    </p>
                  </>
                )}
                
                {order.notes && (
                  <p>
                    <b>Notes:</b>
                    <span>{order.notes}</span>
                  </p>
                )}
              </div>
              
              <div className="order-actions">
                {order.status === 'Pending' && (
                  <button 
                    className="status-button start"
                    onClick={() => startDelivery(order.orderId)}
                  >
                    Start Delivery
                  </button>
                )}
                
                {order.status === 'In Transit' && (
                  <>
                    <button 
                      className="status-button navigate"
                      onClick={() => navigate(`/map/${order.orderId}`)}
                    >
                      Navigate
                    </button>
                    <button 
                      className="status-button complete"
                      onClick={() => completeDelivery(order.orderId)}
                    >
                      Mark as Delivered
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Order;