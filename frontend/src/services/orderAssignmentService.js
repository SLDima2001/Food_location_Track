// services/orderAssignmentService.js - Enhanced service for order assignment management

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class OrderAssignmentService {
  // Helper method to make authenticated requests
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}/order-assignments${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add authentication token - prioritize admin token for assignment management
    const adminToken = localStorage.getItem('adminToken');
    const userToken = localStorage.getItem('token');
    const token = adminToken || userToken;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      console.log('🌐 Making Order Assignment API request:', { url, method: config.method || 'GET' });
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
      console.log('✅ Order Assignment API response success:', result);
      return result;
    } catch (error) {
      console.error('❌ Order Assignment API request failed:', { url, error: error.message });
      
      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Failed to connect to server. Please check if the backend is running.');
      }
      
      throw error;
    }
  }

  // GET all order assignments with optional filters and pagination
  async getAllAssignments(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.deliveryAgentId) queryParams.append('deliveryAgentId', filters.deliveryAgentId);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.limit) queryParams.append('limit', filters.limit);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const endpoint = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      console.error('Error fetching order assignments:', error);
      throw error;
    }
  }

  // GET order assignment by orderId with detailed information
  async getAssignmentById(orderId) {
    try {
      const response = await this.request(`/${orderId}`);
      return response;
    } catch (error) {
      console.error(`Error fetching assignment for order ${orderId}:`, error);
      throw error;
    }
  }

  // POST create new order assignment
  async createAssignment(assignmentData) {
    try {
      // Validate required fields
      if (!assignmentData.orderId || !assignmentData.deliveryAgentId) {
        throw new Error('Order ID and Delivery Agent ID are required');
      }

      const response = await this.request('', {
        method: 'POST',
        body: JSON.stringify({
          orderId: assignmentData.orderId,
          deliveryAgentId: assignmentData.deliveryAgentId,
          status: assignmentData.status || 'Assigned',
          priority: assignmentData.priority || 'Normal',
          notes: assignmentData.notes || ''
        }),
      });
      return response;
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw error;
    }
  }

  // PUT update order assignment (Admin only)
  async updateAssignment(orderId, updateData) {
    try {
      // Remove fields that shouldn't be updated directly
      const { _id, assignedDate, ...safeUpdateData } = updateData;
      
      const response = await this.request('', {
        method: 'PUT',
        body: JSON.stringify({
          orderId: orderId,
          ...safeUpdateData
        }),
      });
      return response;
    } catch (error) {
      console.error(`Error updating assignment for order ${orderId}:`, error);
      throw error;
    }
  }

  // DELETE order assignment (Admin only)
  async deleteAssignment(orderId) {
    try {
      const response = await this.request(`/${orderId}`, {
        method: 'DELETE',
      });
      return response;
    } catch (error) {
      console.error(`Error deleting assignment for order ${orderId}:`, error);
      throw error;
    }
  }

  // GET assignment statistics
  async getAssignmentStatistics() {
    try {
      const response = await this.request('/stats');
      return response;
    } catch (error) {
      console.error('Error fetching assignment statistics:', error);
      throw error;
    }
  }

  // PUT bulk update assignments (Admin only)
  async bulkUpdateAssignments(orderIds, updates) {
    try {
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        throw new Error('Order IDs array is required and cannot be empty');
      }

      const response = await this.request('/bulk-update', {
        method: 'PUT',
        body: JSON.stringify({
          orderIds: orderIds,
          updates: updates
        }),
      });
      return response;
    } catch (error) {
      console.error('Error performing bulk update:', error);
      throw error;
    }
  }

  // Reassign order to different agent (Admin only)
  async reassignOrder(orderId, newAgentId, reason = '') {
    try {
      const response = await this.updateAssignment(orderId, {
        deliveryAgentId: newAgentId,
        reassignmentReason: reason,
        reassignedAt: new Date().toISOString()
      });
      return response;
    } catch (error) {
      console.error(`Error reassigning order ${orderId} to agent ${newAgentId}:`, error);
      throw error;
    }
  }

  // Update assignment status with tracking information
  async updateAssignmentStatus(orderId, status, additionalData = {}) {
    try {
      const validStatuses = ['Assigned', 'In Progress', 'Completed', 'Failed', 'Cancelled'];
      
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Valid statuses: ${validStatuses.join(', ')}`);
      }

      const updateData = {
        status: status,
        ...additionalData
      };

      // Add completion timestamp if status is completed
      if (status === 'Completed') {
        updateData.completedDate = new Date().toISOString();
      }

      const response = await this.updateAssignment(orderId, updateData);
      return response;
    } catch (error) {
      console.error(`Error updating assignment status for order ${orderId}:`, error);
      throw error;
    }
  }

  // Get assignments by delivery agent
  async getAssignmentsByAgent(agentId, status = null) {
    try {
      const filters = { deliveryAgentId: agentId };
      if (status) filters.status = status;
      
      const response = await this.getAllAssignments(filters);
      return response;
    } catch (error) {
      console.error(`Error fetching assignments for agent ${agentId}:`, error);
      throw error;
    }
  }

  // Get assignments by date range
  async getAssignmentsByDateRange(startDate, endDate, additionalFilters = {}) {
    try {
      const filters = {
        startDate: startDate,
        endDate: endDate,
        ...additionalFilters
      };
      
      const response = await this.getAllAssignments(filters);
      return response;
    } catch (error) {
      console.error('Error fetching assignments by date range:', error);
      throw error;
    }
  }

  // Search assignments with multiple criteria
  async searchAssignments(searchCriteria) {
    try {
      const queryParams = new URLSearchParams();
      
      // Add search parameters
      if (searchCriteria.orderId) queryParams.append('orderId', searchCriteria.orderId);
      if (searchCriteria.customerName) queryParams.append('customerName', searchCriteria.customerName);
      if (searchCriteria.agentName) queryParams.append('agentName', searchCriteria.agentName);
      if (searchCriteria.status) queryParams.append('status', searchCriteria.status);
      if (searchCriteria.priority) queryParams.append('priority', searchCriteria.priority);

      const endpoint = `/search?${queryParams.toString()}`;
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      console.error('Error searching assignments:', error);
      throw error;
    }
  }

  // Export assignments data (for reports)
  async exportAssignments(filters = {}, format = 'json') {
    try {
      const queryParams = new URLSearchParams({
        format: format,
        ...filters
      });

      const endpoint = `/export?${queryParams.toString()}`;
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      console.error('Error exporting assignments:', error);
      throw error;
    }
  }

  // Validate assignment data before submission
  async validateAssignmentData(assignmentData) {
    const errors = {};
    
    // Required field validation
    if (!assignmentData.orderId || !assignmentData.orderId.trim()) {
      errors.orderId = 'Order ID is required';
    }

    if (!assignmentData.deliveryAgentId || !assignmentData.deliveryAgentId.trim()) {
      errors.deliveryAgentId = 'Delivery Agent ID is required';
    }

    // Status validation
    if (assignmentData.status) {
      const validStatuses = ['Assigned', 'In Progress', 'Completed', 'Failed', 'Cancelled'];
      if (!validStatuses.includes(assignmentData.status)) {
        errors.status = `Status must be one of: ${validStatuses.join(', ')}`;
      }
    }

    // Priority validation
    if (assignmentData.priority) {
      const validPriorities = ['Low', 'Normal', 'High', 'Urgent'];
      if (!validPriorities.includes(assignmentData.priority)) {
        errors.priority = `Priority must be one of: ${validPriorities.join(', ')}`;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Test connection to order assignment API
  async testConnection() {
    try {
      const response = await this.request('/test');
      return response;
    } catch (error) {
      console.error('Order Assignment API connection test failed:', error);
      throw error;
    }
  }

  // Get assignment performance metrics
  async getPerformanceMetrics(agentId = null, dateRange = null) {
    try {
      const queryParams = new URLSearchParams();
      
      if (agentId) queryParams.append('agentId', agentId);
      if (dateRange?.start) queryParams.append('startDate', dateRange.start);
      if (dateRange?.end) queryParams.append('endDate', dateRange.end);

      const endpoint = `/metrics?${queryParams.toString()}`;
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      throw error;
    }
  }

  // Cancel assignment and return order to unassigned pool
  async cancelAssignment(orderId, reason = '') {
    try {
      const response = await this.updateAssignment(orderId, {
        status: 'Cancelled',
        cancellationReason: reason,
        cancelledAt: new Date().toISOString()
      });
      return response;
    } catch (error) {
      console.error(`Error cancelling assignment for order ${orderId}:`, error);
      throw error;
    }
  }

  // Get assignments requiring admin attention (failed, overdue, etc.)
  async getAssignmentsRequiringAttention() {
    try {
      const response = await this.request('/attention-required');
      return response;
    } catch (error) {
      console.error('Error fetching assignments requiring attention:', error);
      throw error;
    }
  }
}

// Export a single instance
export const orderAssignmentService = new OrderAssignmentService();
export default orderAssignmentService;