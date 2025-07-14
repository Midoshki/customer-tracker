import { useState, useEffect, useRef, useCallback } from 'react';
import useOnlineStatus from './useOnlineStatus';
import CustomerService from '../services/CustomerService';
import { supabase } from '../supabase';

// Usage in main component
const useOfflineCustomers = (user) => {
  const isOnline = useOnlineStatus();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const customerServiceRef = useRef(null);

  // Initialize customer service
  if (!customerServiceRef.current) {
    customerServiceRef.current = new CustomerService(supabase);
  }

  const refreshCustomers = useCallback(async () => {
    setLoading(true);
    try {
      // If no user, clear customers
      if (!user) {
        setCustomers([]);
        return;
      }
      
      // Get user info for filtering
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || user?.id;
      
      // Check if user is admin
      let isAdmin = false;
      if (userId) {
        const { data } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', userId)
          .single();
        isAdmin = data?.role === 'admin';
      }

      const customerData = await customerServiceRef.current.fetchCustomers(
        isOnline, 
        userId, 
        isAdmin
      );
      setCustomers(customerData);
    } catch (error) {
      console.error('Error loading customers:', error);
      // Fallback to local data only if user is logged in
      if (user) {
        const localCustomers = customerServiceRef.current.offlineManager.getLocal('customers') || [];
        setCustomers(localCustomers);
      } else {
        setCustomers([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, user]);

  useEffect(() => {
    refreshCustomers();
  }, [refreshCustomers]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline) {
      const syncData = async () => {
        try {
          await customerServiceRef.current.syncWhenOnline();
          await refreshCustomers();
        } catch (error) {
          console.error('Error syncing data:', error);
        }
      };

      syncData();
    }
  }, [isOnline, refreshCustomers]);

  return { 
    customers, 
    isOnline, 
    customerService: customerServiceRef.current,
    loading,
    refreshCustomers
  };
};

export default useOfflineCustomers; 