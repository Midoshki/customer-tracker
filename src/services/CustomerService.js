import OfflineDataManager from './OfflineDataManager';

// Enhanced customer service with offline support
class CustomerService {
  constructor(supabase) {
    this.supabase = supabase;
    this.offlineManager = new OfflineDataManager();
  }

  async createCustomer(customerData, isOnline, creatorName) {
    if (isOnline) {
      try {
        const { data, error } = await this.supabase
          .from('customers')
          .insert(customerData)
          .select();
        
        if (error) throw error;
        
        // Attach creator name for local display
        const customerWithName = { 
          ...data[0], 
          user_profiles: [{ name: creatorName }]  // Match the array format for consistency
        };
        // Update local storage
        const localCustomers = this.offlineManager.getLocal('customers') || [];
        localCustomers.unshift(customerWithName);
        this.offlineManager.storeLocally('customers', localCustomers);
        
        return customerWithName;
      } catch (error) {
        // Fallback to offline mode
        return this.createCustomerOffline(customerData, creatorName);
      }
    } else {
      return this.createCustomerOffline(customerData, creatorName);
    }
  }

  createCustomerOffline(customerData, creatorName) {
    const tempId = `temp_${Date.now()}`;
    const customer = { 
      ...customerData, 
      id: tempId, 
      created_at: new Date().toISOString(), 
      user_profiles: [{ name: creatorName }]  // Match the array format from Supabase
    };
    
    // Store locally
    const localCustomers = this.offlineManager.getLocal('customers') || [];
    localCustomers.unshift(customer);
    this.offlineManager.storeLocally('customers', localCustomers);
    
    // Add to sync queue
    this.offlineManager.addToSyncQueue({
      type: 'INSERT',
      table: 'customers',
      data: customerData,
      tempId
    });

    return customer;
  }

  async updateCustomer(customerId, customerData, isOnline, creatorName) {
    if (isOnline) {
      try {
        const { data, error } = await this.supabase
          .from('customers')
          .update(customerData)
          .eq('id', customerId)
          .select();
        
        if (error) throw error;
        
        // Attach creator name for local display
        const customerWithName = { 
          ...data[0], 
          user_profiles: [{ name: creatorName }]  // Match the array format for consistency
        };
        // Update local storage
        const localCustomers = this.offlineManager.getLocal('customers') || [];
        const index = localCustomers.findIndex(c => c.id === customerId);
        if (index !== -1) {
          localCustomers[index] = customerWithName;
          this.offlineManager.storeLocally('customers', localCustomers);
        }
        
        return customerWithName;
      } catch (error) {
        // Fallback to offline mode
        return this.updateCustomerOffline(customerId, customerData, creatorName);
      }
    } else {
      return this.updateCustomerOffline(customerId, customerData, creatorName);
    }
  }

  updateCustomerOffline(customerId, customerData, creatorName) {
    // Update local storage
    const localCustomers = this.offlineManager.getLocal('customers') || [];
    const index = localCustomers.findIndex(c => c.id === customerId);
    if (index !== -1) {
      localCustomers[index] = { 
        ...localCustomers[index], 
        ...customerData, 
        user_profiles: [{ name: creatorName }]  // Match the array format from Supabase
      };
      this.offlineManager.storeLocally('customers', localCustomers);
    }
    
    // Add to sync queue
    this.offlineManager.addToSyncQueue({
      type: 'UPDATE',
      table: 'customers',
      data: customerData,
      id: customerId
    });

    return localCustomers[index];
  }

  async deleteCustomer(customerId, isOnline) {
    if (isOnline) {
      try {
        const { error } = await this.supabase
          .from('customers')
          .delete()
          .eq('id', customerId);
        
        if (error) throw error;
        
        // Update local storage
        const localCustomers = this.offlineManager.getLocal('customers') || [];
        const filteredCustomers = localCustomers.filter(c => c.id !== customerId);
        this.offlineManager.storeLocally('customers', filteredCustomers);
        
        return true;
      } catch (error) {
        // Fallback to offline mode
        return this.deleteCustomerOffline(customerId);
      }
    } else {
      return this.deleteCustomerOffline(customerId);
    }
  }

  deleteCustomerOffline(customerId) {
    // Update local storage
    const localCustomers = this.offlineManager.getLocal('customers') || [];
    const filteredCustomers = localCustomers.filter(c => c.id !== customerId);
    this.offlineManager.storeLocally('customers', filteredCustomers);
    
    // Add to sync queue
    this.offlineManager.addToSyncQueue({
      type: 'DELETE',
      table: 'customers',
      id: customerId
    });

    return true;
  }

  async fetchCustomers(isOnline, userId, isAdmin) {
    if (isOnline) {
      try {
        // The foreign key links customers.created_by to auth.users(id), and user_profiles.id to auth.users(id)
        // We need to join through the created_by field to get the creator's name
        const { data, error } = await this.supabase
          .from('customers')
          .select(`
            *,
            user_profiles!created_by(name)
          `)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        // Update local storage
        this.offlineManager.storeLocally('customers', data || []);
        return data || [];
      } catch (error) {
        console.error('Error fetching customers:', error);
        // Fallback to local data
        return this.offlineManager.getLocal('customers') || [];
      }
    } else {
      // Load from local storage
      return this.offlineManager.getLocal('customers') || [];
    }
  }

  async syncWhenOnline() {
    await this.offlineManager.processSyncQueue(this.supabase);
    
    // Refresh local data from server
    try {
      const { data, error } = await this.supabase
        .from('customers')
        .select(`
          *,
          user_profiles!created_by(name)
        `)
        .order('created_at', { ascending: false });
      
      if (!error) {
        this.offlineManager.storeLocally('customers', data);
      }
    } catch (error) {
      console.error('Failed to sync with server:', error);
    }
  }
}

export default CustomerService; 