import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import ApiService from '../../services/api'; // Import API service
import './Map.css';

// Fix Leaflet marker icon issue
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function Map() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [coordinates, setCoordinates] = useState([6.9271, 79.8612]); // default: Colombo
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sample orders data with actual Sri Lankan locations (fallback)
  const sampleOrders = [
    {
      _id: '1',
      orderId: 'CBC0001',
      customerName: 'John Doe',
      customerAddress: 'Independence Square, Colombo 07',
      status: 'Out for Delivery',
      items: ['Pizza', 'Burger'],
      total: 2500,
      lat: 6.9011,
      lng: 79.8683
    },
    {
      _id: '2',
      orderId: 'CBC0002',
      customerName: 'Jane Smith',
      customerAddress: 'Temple of the Tooth, Kandy',
      status: 'Out for Delivery',
      items: ['Pasta', 'Salad'],
      total: 1800,
      lat: 7.2936,
      lng: 80.6413
    },
    {
      _id: '3',
      orderId: 'CBC0003',
      customerName: 'Mike Johnson',
      customerAddress: 'Galle Fort, Galle',
      status: 'Out for Delivery',
      items: ['Sandwich', 'Juice'],
      total: 1200,
      lat: 6.0328,
      lng: 80.2167
    }
  ];

  // Fetch order details from API or use sample data
  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First try to get specific order by orderId
        console.log('Fetching order with ID:', orderId);
        
        let foundOrder = null;
        
        try {
          // Try to get order by orderId directly using new route
          const response = await ApiService.get(`/orders/by-order-id/${orderId}`);
          if (response && response.success && response.data) {
            foundOrder = response.data;
            console.log('Order found via direct route:', foundOrder);
          }
        } catch (directError) {
          console.log('Direct order fetch failed, trying list method:', directError.message);
          
          // Fallback: get all orders and find the matching one
          const listResponse = await ApiService.getOrders();
          if (listResponse && listResponse.list) {
            foundOrder = listResponse.list.find(o => o.orderId === orderId);
            console.log('Order found via list search:', foundOrder);
          }
        }
        
        if (foundOrder) {
          // Transform the order data
          const transformedOrder = {
            _id: foundOrder._id,
            orderId: foundOrder.orderId,
            customerName: foundOrder.name,
            customerAddress: foundOrder.address,
            customerPhone: foundOrder.phone,
            customerEmail: foundOrder.email,
            status: mapBackendStatus(foundOrder.status),
            orderedItems: foundOrder.orderedItems,
            // Default coordinates if not provided
            lat: foundOrder.deliveryLocation?.lat || 6.9271,
            lng: foundOrder.deliveryLocation?.lng || 79.8612
          };
          
          setOrder(transformedOrder);
          setCoordinates([transformedOrder.lat, transformedOrder.lng]);
          console.log('Order found and loaded:', transformedOrder);
        } else {
          throw new Error('Order not found in API response');
        }
      } catch (err) {
        console.error('Error fetching order from API:', err);
        console.log('Falling back to sample data...');
        
        // Fallback to sample data
        const foundOrder = sampleOrders.find(o => o.orderId === orderId);
        if (foundOrder) {
          setOrder(foundOrder);
          setCoordinates([foundOrder.lat, foundOrder.lng]);
          console.log('Using sample order data:', foundOrder);
        } else {
          setError('Order not found');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

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

  const handleStartDelivery = async () => {
    if (!order) return;
    
    try {
      setIsLoading(true);
      
      // Update order status to "shipped" (In Transit)
      await ApiService.updateOrderStatus(order.orderId, 'shipped');
      
      // Update local order state
      setOrder(prev => ({ ...prev, status: 'In Transit' }));
      
      // Navigate back to home or to a live tracking view
      alert('Delivery started successfully!');
      navigate('/'); // Navigate back to orders list
      
    } catch (error) {
      console.error('Error starting delivery:', error);
      alert('Failed to start delivery: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!order) return;
    
    try {
      setIsLoading(true);
      
      // Update order status to "completed" (Delivered)
      await ApiService.updateOrderStatus(order.orderId, 'completed');
      
      // Update local order state
      setOrder(prev => ({ ...prev, status: 'Delivered' }));
      
      alert('Delivery completed successfully!');
      navigate('/'); // Navigate back to orders list
      
    } catch (error) {
      console.error('Error completing delivery:', error);
      alert('Failed to complete delivery: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="map-container">
        <h2>Loading order details...</h2>
        <div className="loading">Please wait...</div>
        <button onClick={() => navigate('/')} className="back-button">
          Back to Orders
        </button>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="map-container">
        <h2>Order Not Found</h2>
        <div className="error">
          <p>{error || 'Unable to load order details'}</p>
          <p>Order ID: {orderId}</p>
        </div>
        <button onClick={() => navigate('/')} className="back-button">
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="map-container">
      <h2>Delivery Map</h2>
      <div className="delivery-info">
        <p><strong>Order ID:</strong> {order.orderId}</p>
        <p><strong>Customer:</strong> {order.customerName}</p>
        <p><strong>Address:</strong> {order.customerAddress}</p>
        <p><strong>Phone:</strong> {order.customerPhone}</p>
        <p><strong>Status:</strong> <span className={`status-${order.status.toLowerCase().replace(' ', '-')}`}>{order.status}</span></p>
      </div>

      {/* Leaflet Map */}
      <div className="map-wrapper">
        {coordinates && (
          <MapContainer 
            center={coordinates} 
            zoom={13} 
            style={{ height: "80%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <Marker position={coordinates} icon={defaultIcon}>
              <Popup>
                <div>
                  <strong>{order.customerName}</strong><br />
                  {order.customerAddress}<br />
                  <strong>Status:</strong> {order.status}
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        )}
      </div>

      <div className="bottom-buttons">
        {order.status === 'Pending' && (
          <button 
            onClick={handleStartDelivery} 
            className="success-button"
            disabled={isLoading}
          >
            {isLoading ? 'Starting...' : 'Start Delivery'}
          </button>
        )}
        
        {order.status === 'In Transit' && (
          <button 
            onClick={handleCompleteDelivery} 
            className="success-button"
            disabled={isLoading}
          >
            {isLoading ? 'Completing...' : 'Complete Delivery'}
          </button>
        )}
        
        <button onClick={() => navigate('/')} className="back-button">
          Back to Orders
        </button>
      </div>
    </div>
  );
}

export default Map;