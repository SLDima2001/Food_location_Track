// services/deliveryAgentService.js - Updated to match your backend API

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class DeliveryAgentService {
  // Helper method to make authenticated requests
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}/delivery-agents${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add authentication token if available
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      console.log('🌐 Making Delivery Agent API request:', { url, method: config.method || 'GET' });
      const response = await fetch(url, config);
      
      console.log('📡 API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
        } catch {
          errorMessage = `HTTP error! status: ${response.status} - ${errorText}`;
        }
        console.error('❌ API error response:', { status: response.status, text: errorText });
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log('✅ Delivery Agent API response success:', result);
      return result;
    } catch (error) {
      console.error('❌ Delivery Agent API request failed:', { url, error: error.message });
      
      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Failed to connect to server. Please check if the backend is running.');
      }
      
      throw error;
    }
  }

  // GET all delivery agents
  async getAllAgents(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = queryParams ? `?${queryParams}` : '';
      
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      console.error('Error fetching delivery agents:', error);
      throw error;
    }
  }

  // GET delivery agent by ID (supports both MongoDB _id and agentId like DA001)
  async getAgentById(agentId) {
    try {
      const response = await this.request(`/${agentId}`);
      return response;
    } catch (error) {
      console.error(`Error fetching agent ${agentId}:`, error);
      throw error;
    }
  }

  // POST create new delivery agent
  async createAgent(agentData) {
    try {
      // Validate required fields
      const requiredFields = ['name', 'email', 'phoneNumber', 'location'];
      for (const field of requiredFields) {
        if (!agentData[field] || !agentData[field].trim()) {
          throw new Error(`${field} is required`);
        }
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(agentData.email)) {
        throw new Error('Invalid email format');
      }

      const response = await this.request('', {
        method: 'POST',
        body: JSON.stringify({
          ...agentData,
          status: agentData.status || 'Active', // Default to Active
        }),
      });
      return response;
    } catch (error) {
      console.error('Error creating delivery agent:', error);
      throw error;
    }
  }

  // PUT update delivery agent
  async updateAgent(agentId, agentData) {
    try {
      // Remove fields that shouldn't be updated
      const { _id, agentId: agentIdField, createdAt, ...updateData } = agentData;
      
      const response = await this.request(`/${agentId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      return response;
    } catch (error) {
      console.error(`Error updating agent ${agentId}:`, error);
      throw error;
    }
  }

  // DELETE delivery agent
  async deleteAgent(agentId) {
    try {
      const response = await this.request(`/${agentId}`, {
        method: 'DELETE',
      });
      return response;
    } catch (error) {
      console.error(`Error deleting agent ${agentId}:`, error);
      throw error;
    }
  }

  // GET agent statistics
  async getAgentStatistics(agentId) {
    try {
      const response = await this.request(`/stats/${agentId}`);
      return response;
    } catch (error) {
      console.error(`Error fetching agent statistics for ${agentId}:`, error);
      throw error;
    }
  }

  // Order management methods
  async getUnassignedOrders() {
    try {
      const response = await this.request('/orders/unassigned');
      return response;
    } catch (error) {
      console.error('Error fetching unassigned orders:', error);
      throw error;
    }
  }

  async assignOrderToAgent(orderId, agentId) {
    try {
      const response = await this.request('/orders/assign', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          agentId,
        }),
      });
      return response;
    } catch (error) {
      console.error('Error assigning order to agent:', error);
      throw error;
    }
  }

  // Search agents
  async searchAgents(query, filters = {}) {
    try {
      const params = new URLSearchParams({
        search: query,
        ...filters
      }).toString();
      
      const response = await this.request(`?${params}`);
      return response;
    } catch (error) {
      console.error('Error searching agents:', error);
      throw error;
    }
  }

  // Validation methods
  async validateAgentData(agentData) {
    const errors = {};
    
    // Required field validation
    const requiredFields = ['name', 'email', 'phoneNumber', 'location'];
    for (const field of requiredFields) {
      if (!agentData[field] || !agentData[field].toString().trim()) {
        errors[field] = `${field} is required`;
      }
    }

    // Email validation
    if (agentData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(agentData.email)) {
        errors.email = 'Invalid email format';
      }
    }

    // Phone validation (basic)
    if (agentData.phoneNumber) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(agentData.phoneNumber.replace(/[\s\-\(\)]/g, ''))) {
        errors.phoneNumber = 'Invalid phone number format';
      }
    }

    // Status validation
    if (agentData.status) {
      const validStatuses = ['Active', 'Inactive', 'Busy'];
      if (!validStatuses.includes(agentData.status)) {
        errors.status = `Status must be one of: ${validStatuses.join(', ')}`;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Test connection to delivery agent API
  async testConnection() {
    try {
      const response = await this.request('/test');
      return response;
    } catch (error) {
      console.error('Delivery agent API connection test failed:', error);
      throw error;
    }
  }

  // Get filtered agents with specific status
  async getAgentsByStatus(status) {
    try {
      const response = await this.request(`?status=${status}`);
      return response;
    } catch (error) {
      console.error(`Error fetching agents with status ${status}:`, error);
      throw error;
    }
  }

  // Get agents by location
  async getAgentsByLocation(location) {
    try {
      const response = await this.request(`?location=${encodeURIComponent(location)}`);
      return response;
    } catch (error) {
      console.error(`Error fetching agents in location ${location}:`, error);
      throw error;
    }
  }

  // Get active agents only
  async getActiveAgents() {
    try {
      const response = await this.request('?status=Active');
      return response;
    } catch (error) {
      console.error('Error fetching active agents:', error);
      throw error;
    }
  }
}

// Export a single instance
export const deliveryAgentService = new DeliveryAgentService();
export default deliveryAgentService;