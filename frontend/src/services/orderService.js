// services/orderService.js - Enhanced with assignment functionality

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class OrderService {
  // Helper method to make authenticated requests
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add authentication token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      console.log('🌐 Making Order API request:', { url, method: config.method || 'GET' });
      const response = await fetch(url, config);
      
      console.log('📡 API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error response:', { status: response.status, text: errorText });
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Order API response success:', result);
      return result;
    } catch (error) {
      console.error('❌ Order API request failed:', { url, error: error.message });
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Failed to connect to server. Please check if the backend is running.');
      }
      
      throw error;
    }
  }

  // Existing order methods
  async getOrders() {
    return this.request('/orders');
  }

  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrder(id) {
    return this.request(`/orders/${id}`);
  }

  async updateOrder(id, orderData) {
    return this.request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderData),
    });
  }

  async updateOrderStatus(orderId, status) {
    return this.request(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // New methods for order assignment functionality
  async getUnassignedOrders() {
    try {
      // First, try to get all orders and filter unassigned ones
      const allOrders = await this.request('/orders');
      
      // Filter for orders that don't have an assigned delivery agent
      // This assumes your order model has a field like 'deliveryAgentId' or 'assignedAgent'
      const unassignedOrders = allOrders.filter ? 
        allOrders.filter(order => !order.deliveryAgentId && !order.assignedAgent && order.status === 'Pending') :
        allOrders.orders?.filter(order => !order.deliveryAgentId && !order.assignedAgent && order.status === 'Pending') || [];

      return {
        success: true,
        orders: unassignedOrders
      };
    } catch (error) {
      console.error('Error fetching unassigned orders:', error);
      throw error;
    }
  }

  async assignOrderToAgent(orderId, agentId) {
    try {
      // Call the order assignment API endpoint
      const response = await this.request('/order-assignments', {
        method: 'POST',
        body: JSON.stringify({
          orderId: orderId,
          deliveryAgentId: agentId,
          status: 'Assigned'
        }),
      });

      // Also update the order status to reflect assignment
      try {
        await this.updateOrderStatus(orderId, 'Assigned');
      } catch (statusError) {
        console.warn('Failed to update order status after assignment:', statusError);
        // Continue anyway as the assignment was successful
      }

      return response;
    } catch (error) {
      console.error('Error assigning order to agent:', error);
      throw error;
    }
  }

  // Order assignment management methods
  async getAssignedOrders() {
    return this.request('/order-assignments');
  }

  async getAssignedOrderById(orderId) {
    return this.request(`/order-assignments/${orderId}`);
  }

  async updateOrderAssignment(orderId, status) {
    return this.request('/order-assignments', {
      method: 'PUT',
      body: JSON.stringify({
        orderId: orderId,
        status: status
      }),
    });
  }

  async deleteOrderAssignment(orderId) {
    return this.request(`/order-assignments/${orderId}`, {
      method: 'DELETE',
    });
  }

  // Utility methods
  async getOrdersByAgent(agentId) {
    try {
      const assignedOrders = await this.getAssignedOrders();
      return assignedOrders.filter ? 
        assignedOrders.filter(assignment => assignment.deliveryAgentId === agentId) :
        assignedOrders.data?.filter(assignment => assignment.deliveryAgentId === agentId) || [];
    } catch (error) {
      console.error(`Error fetching orders for agent ${agentId}:`, error);
      throw error;
    }
  }

  async getOrderStatistics() {
    try {
      const [allOrders, assignedOrders] = await Promise.all([
        this.getOrders(),
        this.getAssignedOrders()
      ]);

      const orders = allOrders.orders || allOrders;
      const assignments = assignedOrders.data || assignedOrders;

      return {
        total: orders.length,
        assigned: assignments.length,
        unassigned: orders.length - assignments.length,
        pending: orders.filter(order => order.status === 'Pending').length,
        inProgress: orders.filter(order => order.status === 'In Progress').length,
        completed: orders.filter(order => order.status === 'Completed').length,
      };
    } catch (error) {
      console.error('Error fetching order statistics:', error);
      throw error;
    }
  }

  // Test connection to order assignment API
  async testOrderAssignmentConnection() {
    try {
      const response = await this.request('/order-assignments/test');
      return response;
    } catch (error) {
      console.error('Order assignment API connection test failed:', error);
      throw error;
    }
  }
}

// Export a single instance
export default new OrderService();