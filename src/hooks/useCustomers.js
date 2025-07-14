import { useState, useEffect, useRef, useCallback } from 'react';
import CustomerService from '../services/CustomerService';
import { supabase } from '../supabase';

// Simple online-only customer management hook
const useCustomers = (user) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const customerServiceRef = useRef(null);

  // Initialize customer service
  if (!customerServiceRef.current) {
    customerServiceRef.current = new CustomerService(supabase);
  }

  const refreshCustomers = useCallback(async () => {
    // Everyone can view customers, but you need to be authenticated to perform actions
    if (!user) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const customerData = await customerServiceRef.current.fetchCustomers();
      setCustomers(customerData);
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshCustomers();
  }, [refreshCustomers]);

  return { 
    customers, 
    customerService: customerServiceRef.current,
    loading,
    refreshCustomers
  };
};

export default useCustomers; 