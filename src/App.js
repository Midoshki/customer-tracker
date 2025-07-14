import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';
import useOfflineCustomers from './hooks/useOfflineCustomers';
import OfflineIndicator from './components/OfflineIndicator';

// Fix default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const otherIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const existingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [15, 24],
  iconAnchor: [7, 24],
  popupAnchor: [1, -20],
  shadowSize: [24, 24]
});

const currentLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Enhanced search function for Arabic text
const fuzzySearch = (searchTerm, text) => {
  if (!searchTerm || !text) return false;
  
  const normalizeArabic = (str) => {
    return str
      .replace(/[أإآا]/g, 'ا')
      .replace(/[ة]/g, 'ه')
      .replace(/[ي]/g, 'ى')
      .replace(/[ء]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };
  
  const normalizedSearch = normalizeArabic(searchTerm);
  const normalizedText = normalizeArabic(text);
  
  return normalizedText.includes(normalizedSearch) || 
         normalizedSearch.split(' ').some(word => 
           word.length > 2 && normalizedText.includes(word)
         );
};

// Map click handler component
function MapClickHandler({ onMapClick, tempMarker }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });

  return tempMarker ? (
    <Marker position={[tempMarker.lat, tempMarker.lng]}>
      <Popup>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: '500', color: '#e2e8f0' }}>📍 New Customer Location</p>
          <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>
            {tempMarker.lat.toFixed(6)}, {tempMarker.lng.toFixed(6)}
          </p>
        </div>
      </Popup>
    </Marker>
  ) : null;
}

function App() {
  // Authentication state
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({ email: '', password: '', name: '' });
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // App state
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState('list');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [tempMarker, setTempMarker] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showActionsMenu, setShowActionsMenu] = useState({});
  const [notification, setNotification] = useState({ 
    show: false, 
    message: '', 
    type: 'info', 
    isConfirm: false, 
    onConfirm: null, 
    onCancel: null 
  });
  const [showFilters, setShowFilters] = useState(false);

  // Offline customer management
  const { customers, isOnline, customerService, loading, refreshCustomers } = useOfflineCustomers();
  
  // Authentication loading state
  const [authLoading, setAuthLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    latitude: '',
    longitude: '',
    status: 'lead',
    notes: ''
  });

  // Add filter state
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterRadius, setFilterRadius] = useState(''); // in km
  const [filterCenter, setFilterCenter] = useState(null); // { lat, lng }

  // Helper: get unique creators for filter dropdown
  const uniqueCreators = Array.from(new Set(customers.map(c => c.user_profiles?.name || 'Unknown')));

  // Helper: haversine formula for distance in km
  function getDistanceKm(lat1, lng1, lat2, lng2) {
    function toRad(x) { return x * Math.PI / 180; }
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Detect mobile screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get current location ONLY when user explicitly requests it - completely isolated
  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setNotification({
        show: true,
        message: 'Geolocation is not supported by your browser.',
        type: 'error'
      });
      setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), 5000);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCurrentLocation(location);
        setNotification({
          show: true,
          message: 'Location found successfully!',
          type: 'success'
        });
        setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), 5000);
      },
      (error) => {
        let message = 'Unable to get your location. ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message += 'Location access was denied. Please enable location permission in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            message += 'Location information is unavailable. Please try again.';
            break;
          case error.TIMEOUT:
            message += 'Location request timed out. Please try again.';
            break;
          default:
            message += 'An unknown error occurred while retrieving location.';
            break;
        }
        setNotification({
          show: true,
          message: message,
          type: 'error'
        });
        setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), 5000);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 20000, 
        maximumAge: 0  // Always get fresh location for better PC accuracy
      }
    );
  };

  // Show notification function with confirmation support
  const showNotification = (message, type = 'info', isConfirm = false, onConfirm = null, onCancel = null) => {
    setNotification({ 
      show: true, 
      message, 
      type, 
      isConfirm, 
      onConfirm, 
      onCancel 
    });
    
    if (!isConfirm) {
      setTimeout(() => {
        setNotification({ show: false, message: '', type: 'info' });
      }, 5000);
    }
  };

  // Check authentication on load
  useEffect(() => {
    checkUser();
    
    // Close profile menu when clicking outside
    const handleClickOutside = (event) => {
      if (showProfileMenu && !event.target.closest('.profile-container')) {
        setShowProfileMenu(false);
      }
      // Close actions menu when clicking outside
      if (Object.keys(showActionsMenu).length > 0 && !event.target.closest('.actions-container')) {
        setShowActionsMenu({});
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        checkIfAdmin(session.user.id);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
      }, [showProfileMenu, showActionsMenu]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await checkIfAdmin(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    }
  };

  const checkIfAdmin = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (!error && data?.role === 'admin') {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authData.email,
          password: authData.password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authData.email,
          password: authData.password,
          options: {
            data: { name: authData.name }
          }
        });
        if (error) throw error;
        
        if (data.user) {
          await supabase.from('user_profiles').insert([
            { id: data.user.id, name: authData.name, email: authData.email, role: 'user' }
          ]);
        }
        
        setAwaitingConfirmation(true);
      }
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setShowProfileMenu(false);
  };

  // Inline status change handler
  const handleStatusChange = async (customer, newStatus) => {
    try {
      await customerService.updateCustomer(customer.id, { status: newStatus }, isOnline, customer.user_profiles?.name || '');
      await refreshCustomers();
      showNotification('Status updated' + (!isOnline ? ' (Will sync when online)' : ''), 'success');
    } catch (error) {
      showNotification('Error updating status: ' + error.message, 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!tempMarker) {
      showNotification('Please pin the customer location on the map first!', 'warning');
      return;
    }

    try {
      const customerData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        address: formData.address,
        latitude: tempMarker.lat,
        longitude: tempMarker.lng,
        status: formData.status,
        notes: formData.notes,
        created_by: user.id
      };
      // Get the user's name from user object or authData
      const creatorName = user?.user_metadata?.name || user?.name || authData.name || 'Unknown';
      let result;
      if (editingCustomer) {
        result = await customerService.updateCustomer(editingCustomer.id, customerData, isOnline, creatorName);
      } else {
        result = await customerService.createCustomer(customerData, isOnline, creatorName);
      }

      resetForm();
      setCurrentView('list');
      setShowProfileMenu(false);
      await refreshCustomers();
      
      const message = editingCustomer ? 'Customer updated successfully!' : 'Customer added successfully!';
      if (!isOnline) {
        showNotification(message + ' (Will sync when online)', 'success');
      } else {
        showNotification(message, 'success');
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      showNotification('Error saving customer: ' + error.message, 'error');
    }
  };

  const handleEdit = (customer) => {
    if (!isAdmin && customer.created_by !== user.id) {
      showNotification('You can only edit customers you created.', 'warning');
      return;
    }

    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone,
      address: customer.address,
      status: customer.status,
      notes: customer.notes || ''
    });
    setTempMarker({ lat: customer.latitude, lng: customer.longitude });
    setCurrentView('add');
    setShowProfileMenu(false);
  };

  const handleDelete = async (customer) => {
    if (!isAdmin && customer.created_by !== user.id) {
      showNotification('You can only delete customers you created.', 'warning');
      return;
    }

    // Custom confirmation dialog using notification
    setNotification({
      show: true,
      message: `Are you sure you want to delete ${customer.name}?`,
      type: 'warning',
      isConfirm: true,
      onConfirm: () => performDelete(customer),
      onCancel: () => setNotification({ show: false, message: '', type: 'info' })
    });
  };

  const performDelete = async (customer) => {
    try {
      await customerService.deleteCustomer(customer.id, isOnline);
      await refreshCustomers();
      const message = 'Customer deleted successfully!';
      if (!isOnline) {
        showNotification(message + ' (Will sync when online)', 'success');
      } else {
        showNotification(message, 'success');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      showNotification('Error deleting customer: ' + error.message, 'error');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', address: '', status: 'lead', notes: '' });
    setTempMarker(null);
    setEditingCustomer(null);
  };

  const handleMapClick = (latlng) => {
    if (currentView === 'add') {
      setTempMarker(latlng);
    }
  };

  // Update filteredCustomers logic to apply all filters
  const filteredCustomers = customers.filter(customer => {
    // Text search
    if (searchTerm && !(
      fuzzySearch(searchTerm, customer.name) ||
      fuzzySearch(searchTerm, customer.email || '') ||
      fuzzySearch(searchTerm, customer.phone) ||
      fuzzySearch(searchTerm, customer.address) ||
      customer.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fuzzySearch(searchTerm, customer.notes || '')
    )) return false;
    // Status filter
    if (filterStatus && customer.status !== filterStatus) return false;
    // Created by filter
    if (filterCreatedBy && (customer.user_profiles?.name || 'Unknown') !== filterCreatedBy) return false;
    // Date added filter
    if (filterDateFrom && (!customer.created_at || customer.created_at < filterDateFrom)) return false;
    if (filterDateTo && (!customer.created_at || customer.created_at > (filterDateTo + 'T23:59:59'))) return false;
    // Map radius filter
    if (filterRadius && filterCenter && customer.latitude && customer.longitude) {
      const dist = getDistanceKm(
        filterCenter.lat,
        filterCenter.lng,
        customer.latitude,
        customer.longitude
      );
      if (dist > Number(filterRadius)) return false;
    }
    return true;
  });

  // MTM Brand Colors with Dark Grey Theme
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#e2e8f0'
    },
    header: {
      backgroundColor: '#2a2a2a',
      borderBottom: '1px solid #3a3a3a',
      padding: '1rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: isOnline ? 0 : '2rem',
      zIndex: 1000,
      boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.4)',
      transition: 'top 0.3s ease'
    },
    headerContent: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto'
    },
    logoContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    },
    logo: {
      height: '48px',
      width: 'auto'
    },
    title: {
      fontSize: '1.25rem',
      fontWeight: '700',
      color: '#ffffff',
      margin: 0
    },
    modernButton: {
      background: 'transparent',
      color: '#a0a0a0',
      border: 'none',
      borderRadius: '8px',
      padding: '0.75rem 1.5rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.25rem',
      minWidth: '80px'
    },
    modernButtonActive: {
      color: '#e67e22',
      backgroundColor: 'rgba(230, 126, 34, 0.1)'
    },
    modernButtonHover: {
      color: '#ffffff',
      backgroundColor: 'rgba(255, 255, 255, 0.1)'
    },
    mobileBottomNav: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#2a2a2a',
      borderTop: '1px solid #3a3a3a',
      padding: '0.5rem',
      display: 'flex',
      justifyContent: 'space-around',
      zIndex: 1000,
      boxShadow: '0 -2px 8px 0 rgba(0, 0, 0, 0.4)',
      alignItems: 'center'
    },
    profileButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      backgroundColor: 'transparent',
      border: 'none',
      color: '#e2e8f0',
      cursor: 'pointer',
      padding: '0.5rem',
      borderRadius: '8px',
      transition: 'all 0.3s ease',
      position: 'relative'
    },
    profileDropdown: {
      position: 'absolute',
      top: '100%',
      right: 0,
      backgroundColor: '#2a2a2a',
      border: '1px solid #3a3a3a',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      padding: '0.5rem',
      minWidth: '200px',
      zIndex: 1001,
      marginTop: '0.5rem'
    },
    profileInfo: {
      padding: '0.75rem',
      borderBottom: '1px solid #3a3a3a',
      marginBottom: '0.5rem'
    },
    profileEmail: {
      fontSize: '0.875rem',
      color: '#e2e8f0',
      fontWeight: '500'
    },
    profileRole: {
      fontSize: '0.75rem',
      color: '#94a3b8',
      marginTop: '0.25rem'
    },
    mobileNavButton: {
      background: 'none',
      border: 'none',
      color: '#a0a0a0',
      fontSize: '0.75rem',
      fontWeight: '500',
      cursor: 'pointer',
      padding: '0.75rem 0.5rem',
      borderRadius: '12px',
      transition: 'all 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.25rem',
      minWidth: '70px',
      flex: 1,
      outline: 'none'
    },
    mobileNavButtonActive: {
      color: '#e67e22',
      backgroundColor: 'rgba(230, 126, 34, 0.1)'
    },
    logoutButton: {
      background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      padding: '0.5rem 1rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
    },
    content: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '1rem',
      minHeight: 'calc(100vh - 80px)',
      paddingBottom: isMobile ? '6rem' : '1rem',
      paddingTop: isOnline ? '1rem' : '3rem'
    },
    card: {
      backgroundColor: '#2a2a2a',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1rem',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      border: '1px solid #3a3a3a'
    },
    searchInput: {
      width: '100%',
      padding: '1rem',
      fontSize: '1rem',
      border: '1px solid #3a3a3a',
      borderRadius: '12px',
      marginBottom: '1.5rem',
      backgroundColor: '#2a2a2a',
      color: '#e2e8f0',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    },
    formGroup: {
      marginBottom: '1rem'
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: '500',
      color: '#d1d5db',
      marginBottom: '0.5rem'
    },
    input: {
      width: '100%',
      padding: '0.875rem',
      fontSize: '1rem',
      border: '1px solid #3a3a3a',
      borderRadius: '8px',
      backgroundColor: '#2a2a2a',
      color: '#e2e8f0',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box'
    },
    select: {
      width: '100%',
      padding: '0.875rem',
      fontSize: '1rem',
      border: '1px solid #3a3a3a',
      borderRadius: '8px',
      backgroundColor: '#2a2a2a',
      color: '#e2e8f0',
      boxSizing: 'border-box'
    },
    primaryButton: {
      background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '12px',
      padding: '1rem 2rem',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 16px rgba(230, 126, 34, 0.3)',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    secondaryButton: {
      background: 'linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%)',
      color: '#e2e8f0',
      border: 'none',
      borderRadius: '8px',
      padding: '0.5rem 1rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      cursor: 'pointer',
      margin: '0 0.25rem',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
    },
    dangerButton: {
      backgroundColor: '#dc2626',
      color: '#ffffff',
      border: 'none',
      padding: '0.5rem 1rem',
      borderRadius: '0.375rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      cursor: 'pointer',
      margin: '0 0.25rem'
    },
    statusBadge: {
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: '500',
      textTransform: 'uppercase'
    },
    mapContainer: {
      height: '400px',
      width: '100%',
      borderRadius: '0.5rem',
      overflow: 'hidden',
      marginBottom: '1rem',
      border: '1px solid #475569'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1rem'
    },
    customerCard: {
      backgroundColor: '#2a2a2a',
      borderRadius: '16px',
      padding: '1.25rem',
      border: '1px solid #3a3a3a',
      transition: 'all 0.3s ease',
      cursor: 'pointer'
    },
    mobileCustomerCard: {
      backgroundColor: '#2a2a2a',
      borderRadius: '12px',
      padding: '0.75rem',
      border: '1px solid #3a3a3a',
      transition: 'all 0.3s ease',
      marginBottom: '0.5rem'
    },
    actionsButton: {
      background: 'linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%)',
      color: '#e2e8f0',
      border: 'none',
      borderRadius: '6px',
      padding: '0.5rem 0.75rem',
      fontSize: '0.75rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      position: 'relative'
    },
    actionsDropdown: {
      position: 'absolute',
      top: '100%',
      right: 0,
      backgroundColor: '#2a2a2a',
      border: '1px solid #3a3a3a',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      padding: '0.25rem',
      minWidth: '120px',
      zIndex: 1001,
      marginTop: '0.25rem'
    },
    actionItem: {
      width: '100%',
      padding: '0.5rem 0.75rem',
      backgroundColor: 'transparent',
      border: 'none',
      color: '#e2e8f0',
      fontSize: '0.75rem',
      fontWeight: '500',
      cursor: 'pointer',
      borderRadius: '4px',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    authContainer: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a1a1a',
      padding: '1rem'
    },
    authCard: {
      backgroundColor: '#2a2a2a',
      padding: '2rem',
      borderRadius: '20px',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
      width: '100%',
      maxWidth: '400px',
      border: '1px solid #3a3a3a'
    },
    authLogo: {
      height: '120px',
      width: 'auto',
      margin: '0 auto 1.5rem auto',
      display: 'block'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1rem',
      marginBottom: '1.5rem'
    },
    locationButton: {
      background: 'linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%)',
      color: '#ffffff',
      border: '1px solid #e67e22',
      borderRadius: '8px',
      padding: '0.5rem 1rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      cursor: 'pointer',
      margin: '0.5rem 0',
      transition: 'all 0.3s ease'
    },
    notification: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: '#2a2a2a',
      color: '#e2e8f0',
      padding: '1rem 1.5rem',
      borderRadius: '12px',
      border: '1px solid #3a3a3a',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      zIndex: 9999,
      maxWidth: '400px',
      animation: 'slideIn 0.3s ease-out'
    },
    notificationSuccess: {
      borderColor: '#10b981',
      backgroundColor: '#064e3b'
    },
    notificationError: {
      borderColor: '#ef4444',
      backgroundColor: '#7f1d1d'
    },
    notificationWarning: {
      borderColor: '#f59e0b',
      backgroundColor: '#78350f'
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      lead: { bg: '#fecaca', color: '#991b1b' },
      prospect: { bg: '#fde68a', color: '#a16207' },
      customer: { bg: '#bbf7d0', color: '#166534' },
      inactive: { bg: '#e2e8f0', color: '#475569' }
    };
    return colors[status] || colors.lead;
  };

  if (loading) {
    return (
      <div style={{ ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
          <div style={{ fontSize: '1.125rem', color: '#94a3b8' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (awaitingConfirmation) {
      return (
        <div style={styles.authContainer}>
          <div style={styles.authCard}>
            <h2 style={{ color: '#e67e22', textAlign: 'center' }}>
              Account created!
            </h2>
            <p style={{ color: '#fff', textAlign: 'center' }}>
              Please check your email to verify your account before logging in.
            </p>
            <button
              style={styles.primaryButton}
              onClick={() => {
                setAuthMode('login');
                setAwaitingConfirmation(false);
              }}
            >
              Go to Login
            </button>
          </div>
        </div>
      );
    }
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <img 
            src="/logo.png" 
            alt="MTM Logo" 
            style={styles.authLogo}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <h2 style={{ fontSize: '1.875rem', fontWeight: '700', textAlign: 'center', marginBottom: '2rem', color: '#ffffff' }}>
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          
          <form onSubmit={handleAuth}>
            {authMode === 'signup' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  style={styles.input}
                  value={authData.name}
                  onChange={(e) => setAuthData({...authData, name: e.target.value})}
                  required
                  placeholder="Enter your full name"
                />
              </div>
            )}
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                style={styles.input}
                value={authData.email}
                onChange={(e) => setAuthData({...authData, email: e.target.value})}
                required
                placeholder="Enter your email"
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                style={styles.input}
                value={authData.password}
                onChange={(e) => setAuthData({...authData, password: e.target.value})}
                required
                minLength={6}
                placeholder="Enter your password (min 6 characters)"
              />
            </div>
            
            <button
              type="submit"
              style={{ ...styles.primaryButton, width: '100%', marginBottom: '1rem' }}
              disabled={authLoading}
            >
              {authLoading ? 'Loading...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          
          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              style={{ background: 'none', border: 'none', color: '#e67e22', textDecoration: 'underline', cursor: 'pointer' }}
            >
              {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <OfflineIndicator isOnline={isOnline} />
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logoContainer}>
            <img 
              src="/logo.png" 
              alt="MTM Logo" 
              style={styles.logo}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <h1 style={styles.title}>Customer Tracker</h1>
          </div>

          {!isMobile && (
            <div style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '1rem'
            }}>
              <button
                onClick={() => setCurrentView('list')}
                className={`desktop-nav-button ${currentView === 'list' ? 'active' : ''}`}
              >
                <span style={{ fontSize: '1.25rem' }}>📋</span>
                <span>List</span>
              </button>
              <button
                onClick={() => setCurrentView('map')}
                className={`desktop-nav-button ${currentView === 'map' ? 'active' : ''}`}
              >
                <span style={{ fontSize: '1.25rem' }}>🗺️</span>
                <span>Map</span>
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setCurrentView('add');
                }}
                className={`desktop-nav-button ${currentView === 'add' ? 'active' : ''}`}
              >
                <span style={{ fontSize: '1.25rem' }}>➕</span>
                <span>Add</span>
              </button>
            </div>
          )}

          <div style={{ position: 'relative' }} className="profile-container">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowProfileMenu(!showProfileMenu);
              }}
              style={styles.profileButton}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#e67e22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: '600'
              }}>
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <span style={{ 
                fontSize: '0.875rem', 
                color: '#ffffff', 
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                fontWeight: 'bold',
                fontFamily: 'Arial, sans-serif'
              }}>▼</span>
            </button>
            
            {showProfileMenu && (
              <div style={styles.profileDropdown}>
                <div style={styles.profileInfo}>
                  <div style={styles.profileEmail}>{user.email}</div>
                  <div style={styles.profileRole}>{isAdmin ? 'Administrator' : 'User'}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLogout();
                    setShowProfileMenu(false);
                  }}
                  style={{
                    ...styles.logoutButton,
                    width: '100%',
                    justifyContent: 'center'
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {isMobile && (
        <div style={styles.mobileBottomNav}>
          <button
            onClick={() => setCurrentView('list')}
            className={`mobile-nav-button ${currentView === 'list' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.5rem' }}>📋</span>
            <span>List</span>
          </button>
          <button
            onClick={() => setCurrentView('map')}
            className={`mobile-nav-button ${currentView === 'map' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.5rem' }}>🗺️</span>
            <span>Map</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setCurrentView('add');
            }}
            className={`mobile-nav-button ${currentView === 'add' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.5rem' }}>➕</span>
            <span>Add</span>
          </button>
        </div>
      )}

      <main style={styles.content}>
        {(currentView === 'list' || currentView === 'map') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search customers by name, email, phone, address, or status... (Arabic supported)"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            <button
              style={{
                ...styles.secondaryButton,
                padding: '0.75rem 1rem',
                height: '48px', // match search input height
                minWidth: 'unset',
                fontSize: '1rem',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                margin: 0,
                marginTop: '-20px'
              }}
              onClick={() => setShowFilters(f => !f)}
            >
              Filters
            </button>
          </div>
        )}

        {showFilters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', alignItems: 'center', background: '#232323', borderRadius: '8px', padding: '1rem' }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={styles.input}>
              <option value=''>All Statuses</option>
              <option value='lead'>Lead</option>
              <option value='prospect'>Prospect</option>
              <option value='customer'>Customer</option>
              <option value='inactive'>Inactive</option>
            </select>
            <select value={filterCreatedBy} onChange={e => setFilterCreatedBy(e.target.value)} style={styles.input}>
              <option value=''>All Creators</option>
              {uniqueCreators.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <input type='date' value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={styles.input} placeholder='From date' />
            <input type='date' value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={styles.input} placeholder='To date' />
            <select value={filterRadius} onChange={e => setFilterRadius(e.target.value)} style={styles.input}>
              <option value=''>Any Distance</option>
              <option value='1'>Within 1 km</option>
              <option value='5'>Within 5 km</option>
              <option value='10'>Within 10 km</option>
              <option value='25'>Within 25 km</option>
              <option value='50'>Within 50 km</option>
            </select>
            <button
              style={styles.secondaryButton}
              onClick={() => {
                if (currentLocation) setFilterCenter(currentLocation);
                else requestUserLocation();
              }}
              title='Use my location as center'
            >
              📍 Use My Location
            </button>
            <button
              style={styles.secondaryButton}
              onClick={() => setFilterCenter(null)}
              title='Clear map center filter'
            >
              ❌ Clear Center
            </button>
            {filterCenter && (
              <span style={{ color: '#e67e22', fontSize: '0.9em' }}>
                Center: {filterCenter.lat.toFixed(4)}, {filterCenter.lng.toFixed(4)}
              </span>
            )}
          </div>
        )}

        {currentView === 'list' && (
          <div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#e2e8f0', margin: 0 }}>
                  Customers ({filteredCustomers.length})
                </h2>
              </div>
              
              {filteredCustomers.length === 0 ? (
                <div style={{ ...styles.card, textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
                  <h3 style={{ fontSize: '1.25rem', color: '#94a3b8', margin: 0 }}>
                    {searchTerm || filterStatus || filterCreatedBy || filterDateFrom || filterDateTo || filterRadius ? 'No customers found matching your search' : 'No customers yet'}
                  </h3>
                  <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
                    {searchTerm || filterStatus || filterCreatedBy || filterDateFrom || filterDateTo || filterRadius ? 'Try adjusting your search terms' : 'Add your first customer to get started'}
                  </p>
                </div>
              ) : (
                <div style={isMobile ? { display: 'block' } : styles.grid}>
                  {filteredCustomers.map(customer => {
                    const statusStyle = getStatusColor(customer.status);
                    const canEdit = isAdmin || customer.created_by === user.id;
                    
                    if (isMobile) {
                      // Mobile compact view
                      return (
                        <div
                          key={customer.id}
                          style={styles.mobileCustomerCard}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>
                                  {customer.name}
                                </h3>
                                <span
                                  style={{
                                    ...styles.statusBadge,
                                    backgroundColor: statusStyle.bg,
                                    color: statusStyle.color,
                                    fontSize: '0.625rem',
                                    padding: '0.125rem 0.5rem'
                                  }}
                                >
                                  {canEdit ? (
                                    <select
                                      value={customer.status}
                                      onChange={e => handleStatusChange(customer, e.target.value)}
                                      style={{
                                        background: 'transparent',
                                        color: statusStyle.color,
                                        border: 'none',
                                        fontWeight: 'bold',
                                        fontSize: '0.625rem',
                                        textTransform: 'uppercase',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        minWidth: '60px'
                                      }}
                                    >
                                      <option value="lead">Lead</option>
                                      <option value="prospect">Prospect</option>
                                      <option value="customer">Customer</option>
                                      <option value="inactive">Inactive</option>
                                    </select>
                                  ) : (
                                    customer.status
                                  )}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.2' }}>
                                <div>{customer.phone}</div>
                                {customer.email && <div>{customer.email}</div>}
                                <div style={{ opacity: 0.8 }}>{customer.address}</div>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#e67e22', fontWeight: 500, marginBottom: '0.25rem' }}>
                                Added by: {customer.user_profiles?.name || 'Unknown'}
                              </div>
                              {customer.notes && (
                                <div style={{ marginBottom: '0.25rem', color: '#fbbf24', fontSize: '0.85em' }}>
                                  📝 {customer.notes}
                                </div>
                              )}
                            </div>
                            
                            {/* Mobile Actions Button */}
                            <div style={{ position: 'relative' }} className="actions-container">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowActionsMenu({
                                    ...showActionsMenu,
                                    [customer.id]: !showActionsMenu[customer.id]
                                  });
                                }}
                                style={styles.actionsButton}
                              >
                                ⋯ Actions
                              </button>
                              
                              {showActionsMenu[customer.id] && (
                                <div style={styles.actionsDropdown}>
                                  {canEdit && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleEdit(customer);
                                          setShowActionsMenu({});
                                        }}
                                        style={{
                                          ...styles.actionItem,
                                          ':hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                      >
                                        ✏️ Edit
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setNotification({
                                            show: true,
                                            message: `Are you sure you want to delete ${customer.name}?`,
                                            type: 'warning',
                                            isConfirm: true,
                                            onConfirm: () => performDelete(customer),
                                            onCancel: () => setNotification({ show: false, message: '', type: 'info' })
                                          });
                                          setShowActionsMenu({});
                                        }}
                                        style={{
                                          ...styles.actionItem,
                                          color: '#f87171'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(248, 113, 113, 0.1)'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                      >
                                        🗑️ Delete
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const url = `https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}`;
                                      window.open(url, '_blank');
                                      setShowActionsMenu({});
                                    }}
                                    style={{
                                      ...styles.actionItem,
                                      color: '#e67e22'
                                    }}
                                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(230, 126, 34, 0.1)'}
                                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                  >
                                    🧭 Navigate
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Desktop view (unchanged)
                    return (
                      <div
                        key={customer.id}
                        style={styles.customerCard}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.borderColor = '#e67e22';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.borderColor = '#3a3a3a';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>
                            {customer.name}
                          </h3>
                          <span
                            style={{
                              ...styles.statusBadge,
                              backgroundColor: statusStyle.bg,
                              color: statusStyle.color
                            }}
                          >
                            {canEdit ? (
                              <select
                                value={customer.status}
                                onChange={e => handleStatusChange(customer, e.target.value)}
                                style={{
                                  background: 'transparent',
                                  color: statusStyle.color,
                                  border: 'none',
                                  fontWeight: 'bold',
                                  fontSize: '0.75rem',
                                  textTransform: 'uppercase',
                                  outline: 'none',
                                  cursor: 'pointer',
                                  minWidth: '80px'
                                }}
                              >
                                <option value="lead">Lead</option>
                                <option value="prospect">Prospect</option>
                                <option value="customer">Customer</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            ) : (
                              customer.status
                            )}
                          </span>
                        </div>
                        
                        <div style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                          <div style={{ marginBottom: '0.25rem' }}>📞 {customer.email || 'No email'}</div>
                          <div style={{ marginBottom: '0.25rem' }}>📞 {customer.phone}</div>
                          <div style={{ marginBottom: '0.25rem' }}>📍 {customer.address}</div>
                          <div style={{ fontSize: '0.75rem', color: '#e67e22', fontWeight: 500, marginBottom: '0.25rem' }}>
                            Added by: {customer.user_profiles?.name || 'Unknown'}
                          </div>
                          {customer.notes && (
                            <div style={{ marginBottom: '0.25rem', color: '#fbbf24', fontSize: '0.85em' }}>
                              📝 {customer.notes}
                            </div>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleEdit(customer)}
                                  style={styles.secondaryButton}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(customer)}
                                  style={styles.dangerButton}
                                >
                                  🗑️ Delete
                                </button>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const url = `https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}`;
                              window.open(url, '_blank');
                            }}
                            style={{ ...styles.primaryButton, padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                          >
                            🧭 Navigate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'map' && (
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#e2e8f0', margin: 0 }}>
                Customer Locations ({filteredCustomers.length})
              </h2>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  requestUserLocation();
                }}
                style={styles.locationButton}
              >
                📍 Get My Location
              </button>
            </div>
            <div style={{ height: '70vh', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #475569' }}>
              <MapContainer
                center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [30.0444, 31.2357]}
                zoom={currentLocation ? 12 : 8}
                style={{ height: '100%', width: '100%' }}
                whenCreated={map => {
                  map.on('click', e => {
                    setFilterCenter({ lat: e.latlng.lat, lng: e.latlng.lng });
                  });
                }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {currentLocation && (
                  <Marker
                    position={[currentLocation.lat, currentLocation.lng]}
                    icon={currentLocationIcon}
                  >
                    <Popup>
                      <div style={{ minWidth: '150px', textAlign: 'center' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: '600', color: '#10b981' }}>
                          📍 Your Location
                        </h4>
                        <p style={{ margin: '0', fontSize: '0.875rem', color: '#6b7280' }}>
                          {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )}
                
                {filteredCustomers.map(customer => {
                  const canEdit = isAdmin || customer.created_by === user.id;
                  const icon = customer.created_by === user.id ? userIcon : otherIcon;
                  
                  return (
                    <Marker
                      key={customer.id}
                      position={[customer.latitude, customer.longitude]}
                      icon={icon}
                    >
                      <Popup>
                        <div style={{ minWidth: '200px' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: '600', color: '#e2e8f0' }}>
                            {customer.name}
                          </h4>
                          <div style={{ marginBottom: '10px', fontSize: '0.875rem', color: '#94a3b8' }}>
                            <div>📞 {customer.phone}</div>
                            <div>📍 {customer.address}</div>
                            <div>Status: <strong>{customer.status}</strong></div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {canEdit && (
                              <button
                                onClick={() => handleEdit(customer)}
                                style={{ ...styles.secondaryButton, fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
                              >
                                ✏️ Edit
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const url = `https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}`;
                                window.open(url, '_blank');
                              }}
                              style={{ ...styles.primaryButton, fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
                            >
                              🧭 Navigate
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>
        )}

        {currentView === 'add' && (
          <div style={styles.card}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '1.5rem' }}>
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Name *</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    placeholder="Enter customer name"
                  />
                </div>
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    style={styles.input}
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="Enter email address"
                  />
                </div>
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>Phone *</label>
                  <input
                    type="tel"
                    style={styles.input}
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    required
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>Status</label>
                  <select
                    style={styles.select}
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="lead">Lead</option>
                    <option value="prospect">Prospect</option>
                    <option value="customer">Customer</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  style={{ ...styles.input, minHeight: '60px', resize: 'vertical' }}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Enter any notes about this customer"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Address *</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  required
                  placeholder="Enter full address"
                />
              </div>
              
              <div style={styles.formGroup}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={styles.label}>
                    Location * {tempMarker ? '✅ Location selected' : '📍 Click on map to select location'}
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      requestUserLocation();
                    }}
                    style={styles.locationButton}
                  >
                    📍 Get My Location
                  </button>
                </div>
                <div style={styles.mapContainer}>
                  <MapContainer
                    center={tempMarker ? [tempMarker.lat, tempMarker.lng] : 
                           currentLocation ? [currentLocation.lat, currentLocation.lng] : 
                           [30.0444, 31.2357]}
                    zoom={tempMarker ? 15 : currentLocation ? 12 : 8}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {currentLocation && (
                      <Marker
                        position={[currentLocation.lat, currentLocation.lng]}
                        icon={currentLocationIcon}
                      >
                        <Popup>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ margin: '0 0 10px 0', fontWeight: '500', color: '#10b981' }}>📍 Your Current Location</p>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setTempMarker(currentLocation);
                              }}
                              style={{ ...styles.primaryButton, padding: '0.5rem 1rem', fontSize: '0.75rem' }}
                            >
                              Use This Location
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    
                    {customers
                      .filter(c => !editingCustomer || c.id !== editingCustomer.id)
                      .map(customer => (
                        <Marker
                          key={`existing-${customer.id}`}
                          position={[customer.latitude, customer.longitude]}
                          icon={existingIcon}
                        >
                          <Popup>
                            <div style={{ minWidth: '150px', textAlign: 'center' }}>
                              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.875rem', fontWeight: '600', color: '#64748b' }}>
                                {customer.name}
                              </h4>
                              <p style={{ margin: '0', fontSize: '0.75rem', color: '#9ca3af' }}>
                                Existing customer
                              </p>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    
                    <MapClickHandler onMapClick={handleMapClick} tempMarker={tempMarker} />
                  </MapContainer>
                </div>
                {tempMarker && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                    Selected coordinates: {tempMarker.lat.toFixed(6)}, {tempMarker.lng.toFixed(6)}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setCurrentView('list');
                  }}
                  style={styles.secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={!tempMarker}
                >
                  {editingCustomer ? 'Update Customer' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Custom Notification */}
      {notification.show && (
        <div style={{
          ...styles.notification,
          ...(notification.type === 'success' ? styles.notificationSuccess : {}),
          ...(notification.type === 'error' ? styles.notificationError : {}),
          ...(notification.type === 'warning' ? styles.notificationWarning : {})
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>
              {notification.type === 'success' && '✅'}
              {notification.type === 'error' && '❌'}
              {notification.type === 'warning' && '⚠️'}
              {notification.type === 'info' && 'ℹ️'}
            </span>
            <span style={{ flex: 1 }}>{notification.message}</span>
            
            {notification.isConfirm ? (
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                <button
                  onClick={() => {
                    notification.onConfirm?.();
                    setNotification({ show: false, message: '', type: 'info' });
                  }}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    notification.onCancel?.();
                  }}
                  style={{
                    background: '#4a5568',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setNotification({ show: false, message: '', type: 'info' })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  marginLeft: 'auto'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;