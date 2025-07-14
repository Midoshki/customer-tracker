// Simple online-only customer service
class CustomerService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async createCustomer(customerData) {
    // Create the customer with join to get user profile
    const { data, error } = await this.supabase
      .from('customers')
      .insert(customerData)
      .select(`
        *,
        user_profiles!created_by (
          id,
          name
        )
      `)
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
    
    return data;
  }

  async updateCustomer(customerId, customerData) {
    // Update the customer with join to get user profile
    const { data, error } = await this.supabase
      .from('customers')
      .update(customerData)
      .eq('id', customerId)
      .select(`
        *,
        user_profiles!created_by (
          id,
          name
        )
      `)
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to update customer: ${error.message}`);
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
    // Try to fetch all customers - RLS policies might be restricting this
    const { data: customers, error } = await this.supabase
      .from('customers')
      .select(`
        *,
        user_profiles!created_by (
          id,
          name
        )
      `)
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
    
    // With the join query, user_profiles should already be attached
    console.log('Fetched customers with profiles:', customers?.slice(0, 2));
    return customers;
  }
}

export default CustomerService; 