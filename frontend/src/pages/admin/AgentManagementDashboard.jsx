import React, { useState, useEffect } from 'react';
import { User, MapPin, Phone, Mail, Clock, Package, CheckCircle, AlertCircle, Plus, Edit, Trash2, Eye, Search, Filter, Save, X, RefreshCw, Users } from 'lucide-react';

// API service with backend integration
const API_BASE_URL = 'http://localhost:5002/api';

const deliveryAgentService = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  async getAllAgents() {
    return this.request('/delivery-agents');
  },

  async createAgent(agentData) {
    return this.request('/delivery-agents', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  },

  async updateAgent(agentId, agentData) {
    return this.request(`/delivery-agents/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(agentData),
    });
  },

  async deleteAgent(agentId) {
    return this.request(`/delivery-agents/${agentId}`, {
      method: 'DELETE',
    });
  },

  async getUnassignedOrders() {
    return this.request('/order-assignments/unassigned');
  },

  async getAssignedOrders() {
    return this.request('/order-assignments');
  },

  async assignOrderToAgent(orderId, agentId, priority = 'Normal', notes = '') {
    return this.request('/order-assignments', {
      method: 'POST',
      body: JSON.stringify({
        orderId,
        deliveryAgentId: agentId,
        priority,
        notes
      }),
    });
  },

  async updateAssignedOrder(orderId, updateData) {
    return this.request('/order-assignments', {
      method: 'PUT',
      body: JSON.stringify({
        orderId,
        ...updateData
      }),
    });
  },

  async deleteAssignment(orderId) {
    return this.request(`/order-assignments/${orderId}`, {
      method: 'DELETE',
    });
  }
};

const AgentManagementDashboard = () => {
  const [activeTab, setActiveTab] = useState('agents');
  const [agents, setAgents] = useState([]);
  const [unassignedOrders, setUnassignedOrders] = useState([]);
  const [assignedOrders, setAssignedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [assigningOrder, setAssigningOrder] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Assignment management states
  const [showEditAssignmentModal, setShowEditAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [assignmentFormData, setAssignmentFormData] = useState({
    deliveryAgentId: '',
    status: 'Assigned',
    priority: 'Normal',
    notes: ''
  });
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [deletingAssignment, setDeletingAssignment] = useState(null);
  
  // Agent CRUD states
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentFormData, setAgentFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    location: '',
    status: 'Active'
  });
  const [formErrors, setFormErrors] = useState({});
  const [savingAgent, setSavingAgent] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [agentsResponse, unassignedResponse, assignedResponse] = await Promise.all([
        deliveryAgentService.getAllAgents(),
        deliveryAgentService.getUnassignedOrders(),
        deliveryAgentService.getAssignedOrders()
      ]);
      
      setAgents(agentsResponse.data || []);
      setUnassignedOrders(unassignedResponse.data || []);
      setAssignedOrders(assignedResponse.data || []);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data from server. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignOrder = async (orderId, agentId, priority = 'Normal', notes = '') => {
    try {
      setAssigningOrder(orderId);
      
      await deliveryAgentService.assignOrderToAgent(orderId, agentId, priority, notes);
      
      // Refresh data after successful assignment
      await fetchData();
      
      setShowAssignModal(false);
      setSelectedOrder(null);
      alert('Order assigned successfully!');
      
    } catch (err) {
      console.error('Error assigning order:', err);
      setError('Failed to assign order: ' + err.message);
    } finally {
      setAssigningOrder(null);
    }
  };

  // Assignment management functions
  const openEditAssignmentModal = (assignment) => {
    setEditingAssignment(assignment);
    setAssignmentFormData({
      deliveryAgentId: assignment.assignedAgent || '',
      status: assignment.status || 'Assigned',
      priority: assignment.priority || 'Normal',
      notes: assignment.notes || ''
    });
    setShowEditAssignmentModal(true);
  };

  const handleSaveAssignment = async () => {
    try {
      setSavingAssignment(true);
      
      await deliveryAgentService.updateAssignedOrder(
        editingAssignment.orderId, 
        assignmentFormData
      );
      
      // Refresh data
      await fetchData();
      
      setShowEditAssignmentModal(false);
      setEditingAssignment(null);
      alert('Assignment updated successfully!');
      
    } catch (err) {
      console.error('Error updating assignment:', err);
      setError('Failed to update assignment: ' + err.message);
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    if (!window.confirm(`Are you sure you want to unassign order ${assignment.orderId}? This will return the order to the unassigned list.`)) {
      return;
    }

    try {
      setDeletingAssignment(assignment.orderId);
      
      await deliveryAgentService.deleteAssignment(assignment.orderId);
      
      // Refresh data
      await fetchData();
      
      alert('Order unassigned successfully!');
      
    } catch (err) {
      console.error('Error deleting assignment:', err);
      setError('Failed to unassign order: ' + err.message);
    } finally {
      setDeletingAssignment(null);
    }
  };

  // Agent CRUD operations
  const validateAgentForm = () => {
    const errors = {};
    
    if (!agentFormData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!agentFormData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agentFormData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!agentFormData.phoneNumber.trim()) {
      errors.phoneNumber = 'Phone number is required';
    }
    
    if (!agentFormData.location.trim()) {
      errors.location = 'Location is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreateAgentModal = () => {
    setEditingAgent(null);
    setAgentFormData({
      name: '',
      email: '',
      phoneNumber: '',
      location: '',
      status: 'Active'
    });
    setFormErrors({});
    setShowAgentModal(true);
  };

  const openEditAgentModal = (agent) => {
    setEditingAgent(agent);
    setAgentFormData({
      name: agent.name,
      email: agent.email,
      phoneNumber: agent.phoneNumber,
      location: agent.location,
      status: agent.status
    });
    setFormErrors({});
    setShowAgentModal(true);
  };

  const handleSaveAgent = async () => {
    if (!validateAgentForm()) {
      return;
    }

    try {
      setSavingAgent(true);
      
      if (editingAgent) {
        await deliveryAgentService.updateAgent(editingAgent._id || editingAgent.agentId, agentFormData);
        alert('Agent updated successfully!');
      } else {
        await deliveryAgentService.createAgent(agentFormData);
        alert('Agent created successfully!');
      }
      
      // Refresh data
      await fetchData();
      
      setShowAgentModal(false);
      setEditingAgent(null);
      
    } catch (err) {
      console.error('Error saving agent:', err);
      setError('Failed to save agent: ' + err.message);
    } finally {
      setSavingAgent(false);
    }
  };

  const handleDeleteAgent = async (agent) => {
    if (!window.confirm(`Are you sure you want to delete agent "${agent.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingAgent(agent._id);
      
      await deliveryAgentService.deleteAgent(agent._id || agent.agentId);
      
      // Refresh data
      await fetchData();
      
      alert('Agent deleted successfully!');
      
    } catch (err) {
      console.error('Error deleting agent:', err);
      setError('Failed to delete agent: ' + err.message);
    } finally {
      setDeletingAgent(null);
    }
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          agent.agentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          agent.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Inactive': return 'bg-gray-100 text-gray-800';
      case 'Busy': return 'bg-yellow-100 text-yellow-800';
      case 'Assigned': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-purple-100 text-purple-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading agent management dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Agent Management</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchData}
                className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('agents')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'agents'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <User className="w-4 h-4 inline mr-2" />
                  Agents ({agents.length})
                </button>
                <button
                  onClick={() => setActiveTab('assignments')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'assignments'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Package className="w-4 h-4 inline mr-2" />
                  Unassigned ({unassignedOrders.length})
                </button>
                <button
                  onClick={() => setActiveTab('assigned')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'assigned'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-2" />
                  Assigned ({assignedOrders.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {activeTab === 'agents' && (
          <div>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Agents</p>
                    <p className="text-2xl font-semibold text-gray-900">{agents.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Agents</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {agents.filter(agent => agent.status === 'Active').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-yellow-100">
                    <Package className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Assigned Orders</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {agents.reduce((sum, agent) => sum + (agent.assignedOrders || 0), 0)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100">
                    <Clock className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Rating</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {agents.length > 0 ? (agents.reduce((sum, agent) => sum + (agent.rating || 0), 0) / agents.length).toFixed(1) : '0.0'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search, Filter and Add Agent */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex-1 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="text"
                      placeholder="Search agents by name, ID, or location..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="All">All Status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Busy">Busy</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={openCreateAgentModal}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Agent
                </button>
              </div>
            </div>

            {/* Agents Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredAgents.map(agent => (
                <div key={agent._id || agent.agentId} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {agent.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
                        <p className="text-sm text-gray-500">ID: {agent.agentId || 'N/A'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                      {agent.status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-2" />
                      {agent.email}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2" />
                      {agent.phoneNumber}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2" />
                      {agent.location}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Assigned Orders:</span>
                      <span className="font-semibold text-blue-600">{agent.assignedOrders || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-semibold text-green-600">{agent.completedDeliveries || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Rating:</span>
                      <span className="font-semibold text-yellow-600">⭐ {agent.rating || 0}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setSelectedAgent(agent)}
                      className="flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium flex items-center justify-center"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => openEditAgentModal(agent)}
                      className="flex-1 bg-gray-50 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium flex items-center justify-center"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAgent(agent)}
                      disabled={deletingAgent === agent._id}
                      className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium flex items-center justify-center disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredAgents.length === 0 && (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
                <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div>
            {/* Assignment Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-orange-100">
                    <Package className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Unassigned Orders</p>
                    <p className="text-2xl font-semibold text-gray-900">{unassignedOrders.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100">
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Available Agents</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {agents.filter(agent => agent.status === 'Active').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100">
                    <Clock className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Value</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      ${unassignedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Unassigned Orders */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Unassigned Orders</h2>
                <p className="text-gray-600 mt-1">Click "Assign Agent" to assign orders to available delivery agents</p>
              </div>
              
              <div className="p-6">
                {unassignedOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All orders assigned!</h3>
                    <p className="text-gray-500">No unassigned orders at the moment.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unassignedOrders.map(order => (
                      <div key={order._id || order.orderId} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <h4 className="text-lg font-semibold text-gray-900">
                                Order #{order.orderId}
                              </h4>
                              <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                                {order.status || 'Pending'}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Customer Details</p>
                                <p className="font-medium text-gray-900">{order.customerName}</p>
                                <p className="text-sm text-gray-600">{order.customerAddress}</p>
                                <p className="text-sm text-gray-600">{order.customerPhone}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Order Details</p>
                                <p className="font-medium text-gray-900">Total: ${order.totalAmount || 0}</p>
                                <p className="text-sm text-gray-600">
                                  Items: {order.orderItems?.length || 0}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Created: {formatDate(order.createdAt)}
                                </p>
                              </div>
                            </div>

                            {order.orderItems && order.orderItems.length > 0 && (
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-2">Items:</p>
                                <div className="flex flex-wrap gap-2">
                                  {order.orderItems.map((item, index) => (
                                    <span key={index} className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                      {item.name} x{item.quantity}
                                      {item.price && ` - ${item.price}`}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4">
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowAssignModal(true);
                              }}
                              disabled={assigningOrder === order._id || assigningOrder === order.orderId}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                              {assigningOrder === (order._id || order.orderId) ? 'Assigning...' : 'Assign Agent'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assigned' && (
          <div>
            {/* Assigned Orders Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Assigned</p>
                    <p className="text-2xl font-semibold text-gray-900">{assignedOrders.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-yellow-100">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">In Progress</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {assignedOrders.filter(order => order.status === 'In Progress').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {assignedOrders.filter(order => order.status === 'Completed').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100">
                    <RefreshCw className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Value</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      ${assignedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Assigned Orders List */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Assigned Orders</h2>
                  <p className="text-gray-600 mt-1">Manage currently assigned delivery orders</p>
                </div>
              </div>
              
              <div className="p-6">
                {assignedOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No assigned orders</h3>
                    <p className="text-gray-500">Orders will appear here once they are assigned to agents.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignedOrders.map(assignment => (
                      <div key={assignment._id || assignment.orderId} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-3">
                              <h4 className="text-lg font-semibold text-gray-900">
                                Order #{assignment.orderId}
                              </h4>
                              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(assignment.status)}`}>
                                {assignment.status}
                              </span>
                              {assignment.priority && assignment.priority !== 'Normal' && (
                                <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                                  {assignment.priority} Priority
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Customer Details</p>
                                <p className="font-medium text-gray-900">{assignment.customerName}</p>
                                <p className="text-sm text-gray-600">{assignment.customerAddress}</p>
                                <p className="text-sm text-gray-600">{assignment.customerPhone}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Assignment Details</p>
                                <p className="font-medium text-gray-900">Agent: {assignment.agentName}</p>
                                <p className="text-sm text-gray-600">ID: {assignment.assignedAgent}</p>
                                <p className="text-sm text-gray-600">
                                  Assigned: {formatDate(assignment.assignedAt)}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Order Info</p>
                                <p className="font-medium text-gray-900">Total: ${assignment.totalAmount || 0}</p>
                                <p className="text-sm text-gray-600">
                                  Items: {assignment.orderItems?.length || 0}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Created: {formatDate(assignment.createdAt)}
                                </p>
                              </div>
                            </div>

                            {assignment.orderItems && assignment.orderItems.length > 0 && (
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-2">Items:</p>
                                <div className="flex flex-wrap gap-2">
                                  {assignment.orderItems.map((item, index) => (
                                    <span key={index} className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                      {item.name} x{item.quantity}
                                      {item.price && ` - ${item.price}`}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {assignment.notes && (
                              <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">Notes:</p>
                                <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded">{assignment.notes}</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4 flex flex-col gap-2">
                            <button
                              onClick={() => openEditAssignmentModal(assignment)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAssignment(assignment)}
                              disabled={deletingAssignment === assignment.orderId}
                              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
                            >
                              {deletingAssignment === assignment.orderId ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                              ) : (
                                <Trash2 className="w-4 h-4 mr-1" />
                              )}
                              Unassign
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Agent Create/Edit Modal */}
      {showAgentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingAgent ? 'Edit Agent' : 'Add New Agent'}
              </h3>
              <button
                onClick={() => {
                  setShowAgentModal(false);
                  setEditingAgent(null);
                  setFormErrors({});
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveAgent(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={agentFormData.name}
                  onChange={(e) => setAgentFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter agent's full name"
                />
                {formErrors.name && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={agentFormData.email}
                  onChange={(e) => setAgentFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter email address"
                />
                {formErrors.email && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={agentFormData.phoneNumber}
                  onChange={(e) => setAgentFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.phoneNumber ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter phone number"
                />
                {formErrors.phoneNumber && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.phoneNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  value={agentFormData.location}
                  onChange={(e) => setAgentFormData(prev => ({ ...prev, location: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.location ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter service location"
                />
                {formErrors.location && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.location}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={agentFormData.status}
                  onChange={(e) => setAgentFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Busy">Busy</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAgentModal(false);
                    setEditingAgent(null);
                    setFormErrors({});
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAgent}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
                >
                  {savingAgent ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingAgent ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingAgent ? 'Update Agent' : 'Create Agent'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Edit Modal */}
      {showEditAssignmentModal && editingAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Edit Assignment - Order #{editingAssignment.orderId}
              </h3>
              <button
                onClick={() => {
                  setShowEditAssignmentModal(false);
                  setEditingAssignment(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Customer: {editingAssignment.customerName}</p>
              <p className="text-sm text-gray-600">Address: {editingAssignment.customerAddress}</p>
              <p className="text-sm text-gray-600">Total: ${editingAssignment.totalAmount || 0}</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveAssignment(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Agent *
                </label>
                <select
                  value={assignmentFormData.deliveryAgentId}
                  onChange={(e) => setAssignmentFormData(prev => ({ ...prev, deliveryAgentId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select an agent</option>
                  {agents.filter(agent => agent.status === 'Active').map(agent => (
                    <option key={agent.agentId} value={agent.agentId}>
                      {agent.name} ({agent.agentId}) - {agent.location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={assignmentFormData.status}
                  onChange={(e) => setAssignmentFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Failed">Failed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={assignmentFormData.priority}
                  onChange={(e) => setAssignmentFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={assignmentFormData.notes}
                  onChange={(e) => setAssignmentFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Add any special instructions or notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditAssignmentModal(false);
                    setEditingAssignment(null);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignment}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
                >
                  {savingAssignment ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Update Assignment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Assignment Modal */}
      {showAssignModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Assign Order #{selectedOrder.orderId}
            </h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Customer: {selectedOrder.customerName}</p>
              <p className="text-sm text-gray-600">Location: {selectedOrder.customerAddress}</p>
              <p className="text-sm text-gray-600">Amount: ${selectedOrder.totalAmount || 0}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Delivery Agent
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {agents.filter(agent => agent.status === 'Active').map(agent => (
                  <button
                    key={agent.agentId}
                    onClick={() => handleAssignOrder(selectedOrder.orderId, agent.agentId)}
                    disabled={assigningOrder === (selectedOrder._id || selectedOrder.orderId)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{agent.name}</p>
                        <p className="text-sm text-gray-600">{agent.location}</p>
                        <p className="text-sm text-gray-500">
                          Current orders: {agent.assignedOrders || 0} | Rating: ⭐ {agent.rating || 0}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                          {agent.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedOrder(null);
                }}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Details Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold text-gray-900">Agent Details</h3>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {selectedAgent.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="ml-4">
                  <h4 className="text-2xl font-bold text-gray-900">{selectedAgent.name}</h4>
                  <p className="text-lg text-gray-600">Agent ID: {selectedAgent.agentId || 'N/A'}</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedAgent.status)}`}>
                    {selectedAgent.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <h5 className="text-lg font-semibold text-gray-900 border-b pb-2">Contact Information</h5>
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-gray-700">{selectedAgent.email}</span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-gray-700">{selectedAgent.phoneNumber}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-gray-700">{selectedAgent.location}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-lg font-semibold text-gray-900 border-b pb-2">Performance Stats</h5>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Orders:</span>
                      <span className="font-semibold text-blue-600">{selectedAgent.assignedOrders || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Completed:</span>
                      <span className="font-semibold text-green-600">{selectedAgent.completedDeliveries || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Rating:</span>
                      <span className="font-semibold text-yellow-600">⭐ {selectedAgent.rating || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h5 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Activity Timeline</h5>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Joined Platform:</span>
                    <span className="font-medium text-gray-900">{formatDate(selectedAgent.createdAt)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Last Active:</span>
                    <span className="font-medium text-gray-900">{formatDate(selectedAgent.lastActive || selectedAgent.updatedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setSelectedAgent(null);
                    openEditAgentModal(selectedAgent);
                  }}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Edit className="w-4 h-4 inline mr-2" />
                  Edit Agent
                </button>
                <button 
                  onClick={() => setSelectedAgent(null)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentManagementDashboard;