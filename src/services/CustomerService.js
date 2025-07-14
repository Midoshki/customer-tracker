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
        
        if (error) {
          console.error('Database error:', error);
          throw new Error(`Database error: ${error.message}. Customer was saved locally and will sync when the issue is resolved.`);
        }
        
        // Verify the data was actually returned
        if (!data || data.length === 0) {
          throw new Error('Database error: No data returned after insert. Customer was saved locally and will sync when the issue is resolved.');
        }
        
        // Attach creator name for local display
        const customerWithName = { 
          ...data[0], 
          user_profiles: [{ name: creatorName }]  // Match the array format for consistency
        };
        // Update local storage
        const localCustomers = this.offlineManager.getLocal('customers') || [];
        localCustomers.unshift(customerWithName);
        this.offlineManager.storeLocally('customers', localCustomers);
        
        return { success: true, data: customerWithName };
      } catch (error) {
        // Store offline and throw error with details
        const offlineCustomer = this.createCustomerOffline(customerData, creatorName);
        throw new Error(error.message || 'Database connection failed. Customer was saved locally and will sync when online.');
      }
    } else {
      const offlineCustomer = this.createCustomerOffline(customerData, creatorName);
      return { success: false, data: offlineCustomer, offline: true };
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
        
        if (error) {
          console.error('Database error:', error);
          throw new Error(`Database error: ${error.message}. Customer was updated locally and will sync when the issue is resolved.`);
        }
        
        // Verify the data was actually returned
        if (!data || data.length === 0) {
          throw new Error('Database error: No data returned after update. Customer was updated locally and will sync when the issue is resolved.');
        }
        
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
        
        return { success: true, data: customerWithName };
      } catch (error) {
        // Store offline and throw error with details
        const offlineCustomer = this.updateCustomerOffline(customerId, customerData, creatorName);
        throw new Error(error.message || 'Database connection failed. Customer was updated locally and will sync when online.');
      }
    } else {
      const offlineCustomer = this.updateCustomerOffline(customerId, customerData, creatorName);
      return { success: false, data: offlineCustomer, offline: true };
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
        // First get all customers
        const { data: customers, error } = await this.supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Get all unique creator IDs
        const creatorIds = [...new Set(customers.map(c => c.created_by).filter(Boolean))];
        
        // Get user profiles for all creators
        const { data: profiles, error: profileError } = await this.supabase
          .from('user_profiles')
          .select('id, name')
          .in('id', creatorIds);
        
        if (profileError) console.warn('Could not fetch user profiles:', profileError);
        
        // Create a map of user_id -> profile
        const profileMap = (profiles || []).reduce((map, profile) => {
          map[profile.id] = profile;
          return map;
        }, {});
        
        // Attach profile data to customers
        const data = customers.map(customer => ({
          ...customer,
          user_profiles: customer.created_by && profileMap[customer.created_by] 
            ? [profileMap[customer.created_by]]
            : []
                 }));
        
        // Normalize the data format to match local storage format
        const normalizedData = (data || []).map(customer => ({
          ...customer,
          user_profiles: customer.user_profiles ? [customer.user_profiles] : []
        }));
        
        // Update local storage
        this.offlineManager.storeLocally('customers', normalizedData);
        return normalizedData;
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
      // First get all customers
      const { data: customers, error } = await this.supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && customers) {
        // Get all unique creator IDs
        const creatorIds = [...new Set(customers.map(c => c.created_by).filter(Boolean))];
        
        // Get user profiles for all creators
        const { data: profiles } = await this.supabase
          .from('user_profiles')
          .select('id, name')
          .in('id', creatorIds);
        
        // Create a map of user_id -> profile
        const profileMap = (profiles || []).reduce((map, profile) => {
          map[profile.id] = profile;
          return map;
        }, {});
        
        // Attach profile data to customers
        const data = customers.map(customer => ({
          ...customer,
          user_profiles: customer.created_by && profileMap[customer.created_by] 
            ? [profileMap[customer.created_by]]
            : []
        }));
        
        this.offlineManager.storeLocally('customers', data);
      }
    } catch (error) {
      console.error('Failed to sync with server:', error);
    }
  }
}

export default CustomerService; 