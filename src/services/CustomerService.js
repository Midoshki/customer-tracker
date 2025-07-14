// Simple online-only customer service
class CustomerService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async createCustomer(customerData) {
    // First, create the customer without the join
    const { data, error } = await this.supabase
      .from('customers')
      .insert(customerData)
      .select('*')
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
    
    // Then fetch the user profile separately
    if (data && data.created_by) {
      try {
        const { data: profile, error: profileError } = await this.supabase
          .from('user_profiles')
          .select('id, name')
          .eq('id', data.created_by)
          .single();
        
        if (!profileError && profile) {
          data.user_profiles = profile;
        }
      } catch (profileError) {
        console.warn('Could not fetch user profile:', profileError);
      }
    }
    
    return data;
  }

  async updateCustomer(customerId, customerData) {
    // First, update the customer without the join
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
    
    // Then fetch the user profile separately
    if (data && data.created_by) {
      try {
        const { data: profile, error: profileError } = await this.supabase
          .from('user_profiles')
          .select('id, name')
          .eq('id', data.created_by)
          .single();
        
        if (!profileError && profile) {
          data.user_profiles = profile;
        }
      } catch (profileError) {
        console.warn('Could not fetch user profile:', profileError);
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
    // First, fetch all customers without joins
    const { data: customers, error } = await this.supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    
    console.log('Raw customers from database:', customers?.length || 0, 'customers');
    console.log('Sample customer data:', customers?.[0]);
    
    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch customers: ${error.message}`);
    }
    
    if (!customers || customers.length === 0) {
      return [];
    }
    
    // Get unique user IDs for batch fetching profiles
    const userIds = [...new Set(customers.map(c => c.created_by).filter(Boolean))];
    console.log('Customer created_by IDs:', userIds);
    
    if (userIds.length > 0) {
      try {
        const { data: profiles, error: profileError } = await this.supabase
          .from('user_profiles')
          .select('id, name')
          .in('id', userIds);
        
        if (!profileError && profiles) {
          console.log('Fetched profiles:', profiles);
          // Create a map for faster lookup
          const profileMap = profiles.reduce((map, profile) => {
            map[profile.id] = profile;
            return map;
          }, {});
          
          // Attach user profiles to customers
          customers.forEach(customer => {
            if (customer.created_by && profileMap[customer.created_by]) {
              customer.user_profiles = profileMap[customer.created_by];
            }
          });
        } else {
          console.error('Error fetching user profiles:', profileError);
        }
      } catch (profileError) {
        console.error('Could not fetch user profiles:', profileError);
      }
    }
    
    console.log('Fetched customers with profiles:', customers?.slice(0, 2));
    return customers;
  }
}

export default CustomerService; 