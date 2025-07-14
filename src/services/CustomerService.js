// Simple online-only customer service
class CustomerService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async createCustomer(customerData) {
    // First, create the customer without trying to join user_profiles
    const { data, error } = await this.supabase
      .from('customers')
      .insert(customerData)
      .select('*')
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
    
    // Then, fetch the user profile separately if created_by exists
    if (data && data.created_by) {
      try {
        const { data: profile, error: profileError } = await this.supabase
          .from('user_profiles')
          .select('id, name')
          .eq('id', data.created_by)
          .single();
        
        if (!profileError && profile) {
          data.user_profiles = profile;
        } else {
          // If no profile found, set a placeholder to avoid "Unknown"
          data.user_profiles = { id: data.created_by, name: 'User' };
          console.error('User profile not found for user:', data.created_by);
        }
      } catch (profileError) {
        console.error('Could not fetch user profile:', profileError);
        // Set placeholder to avoid "Unknown"
        data.user_profiles = { id: data.created_by, name: 'User' };
      }
    }
    
    return data;
  }

  async updateCustomer(customerId, customerData) {
    // First, update the customer without trying to join user_profiles
    const { data, error } = await this.supabase
      .from('customers')
      .update(customerData)
      .eq('id', customerId)
      .select('*')
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to update customer: ${error.message}`);
    }
    
    // Then, fetch the user profile separately if created_by exists
    if (data && data.created_by) {
      try {
        const { data: profile, error: profileError } = await this.supabase
          .from('user_profiles')
          .select('id, name')
          .eq('id', data.created_by)
          .single();
        
        if (!profileError && profile) {
          data.user_profiles = profile;
        } else {
          // If no profile found, set a placeholder to avoid "Unknown"
          data.user_profiles = { id: data.created_by, name: 'User' };
          console.error('User profile not found for user:', data.created_by);
        }
      } catch (profileError) {
        console.error('Could not fetch user profile:', profileError);
        // Set placeholder to avoid "Unknown"
        data.user_profiles = { id: data.created_by, name: 'User' };
      }
    }
    
    return data;
  }

  async deleteCustomer(customerId) {
    const { error } = await this.supabase
      .from('customers')
      .delete()
      .eq('id', customerId);
    
    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to delete customer: ${error.message}`);
    }
    
    return true;
  }

  async fetchCustomers() {
    // First, fetch all customers
    const { data: customers, error } = await this.supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch customers: ${error.message}`);
    }
    
    if (!customers || customers.length === 0) {
      return [];
    }
    
    // Get unique user IDs for batch fetching profiles
    const userIds = [...new Set(customers.map(c => c.created_by).filter(Boolean))];
    
    if (userIds.length > 0) {
      try {
        const { data: profiles, error: profileError } = await this.supabase
          .from('user_profiles')
          .select('id, name')
          .in('id', userIds);
        
        if (!profileError && profiles) {
          // Create a map for faster lookup
          const profileMap = profiles.reduce((map, profile) => {
            map[profile.id] = profile;
            return map;
          }, {});
          
          // Attach user profiles to customers
          customers.forEach(customer => {
            if (customer.created_by && profileMap[customer.created_by]) {
              customer.user_profiles = profileMap[customer.created_by];
            } else if (customer.created_by) {
              // If no profile found, set a placeholder to avoid "Unknown"
              customer.user_profiles = { id: customer.created_by, name: 'User' };
            }
          });
        } else {
          console.error('Error fetching user profiles:', profileError);
        }
      } catch (profileError) {
        console.error('Could not fetch user profiles:', profileError);
        // Don't fail the customer fetch if profile fetch fails
      }
    }
    
    console.log('Fetched customers with profiles:', customers?.slice(0, 2));
    return customers;
  }
}

export default CustomerService; 