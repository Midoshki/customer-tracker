import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';
import useOfflineCustomers from './hooks/useOfflineCustomers';
import OfflineIndicator from './components/OfflineIndicator';
import axios from 'axios';

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

// Add a distinct icon for filter center
const filterCenterIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
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
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(window.scrollY);

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

  // Map search state
  const [mapSearch, setMapSearch] = useState('');
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [addMapSearch, setAddMapSearch] = useState('');
  const [addMapSearchLoading, setAddMapSearchLoading] = useState(false);

  // Add state for suggestions
  const [mapSuggestions, setMapSuggestions] = useState([]);
  const [addMapSuggestions, setAddMapSuggestions] = useState([]);
  const [showMapSuggestions, setShowMapSuggestions] = useState(false);
  const [showAddMapSuggestions, setShowAddMapSuggestions] = useState(false);

  // Helper: get creator name from customer object
  const getCreatorName = (customer) => {
    // Check for array format first (from Supabase query)
    if (customer.user_profiles && Array.isArray(customer.user_profiles) && customer.user_profiles.length > 0) {
      return customer.user_profiles[0]?.name || 'Unknown';
    }
    // Fallback to direct object format (might be in older cached data)
    return customer.user_profiles?.name || 'Unknown';
  };

  // Helper: get unique creators for filter dropdown
  const uniqueCreators = Array.from(new Set(customers.map(getCreatorName)));

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

  // Helper: parse Google Maps link for coordinates
  function parseGoogleMapsLink(link) {
    try {
      if (!link) return null;
      
      // Format 1: @lat,lng or @lat,lng,zoom
      const atMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
      }
      
      // Format 2: ll=lat,lng or sll=lat,lng
      const llMatch = link.match(/[?&](s)?ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (llMatch) {
        return { lat: parseFloat(llMatch[2]), lng: parseFloat(llMatch[3]) };
      }
      
      // Format 3: q=lat,lng
      const qMatch = link.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
      }
      
      // Format 4: daddr=lat,lng or saddr=lat,lng (directions)
      const addrMatch = link.match(/[?&](d|s)addr=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (addrMatch) {
        return { lat: parseFloat(addrMatch[2]), lng: parseFloat(addrMatch[3]) };
      }
      
      // Format 5: any URL parameter with lat,lng pattern
      const paramMatch = link.match(/[?&]\w+=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (paramMatch) {
        return { lat: parseFloat(paramMatch[1]), lng: parseFloat(paramMatch[2]) };
      }
      
      // Format 6: any comma-separated coordinates in URL
      const coordMatch = link.match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) {
        return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
      }
    } catch (e) {
      console.error("Error parsing Maps link:", e);
    }
    return null;
  }

  // Helper: geocode address using Nominatim
  async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const res = await axios.get(url);
    if (res.data && res.data.length > 0) {
      return { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
    }
    return null;
  }
  
  // Simple function to extract useful info from Google Maps URL
  async function getPlaceDetails(mapsUrl) {
    if (!mapsUrl) return null;
    
    // Clean up URL (remove @ prefix if present)
    if (mapsUrl.startsWith('@')) {
      mapsUrl = mapsUrl.substring(1);
    }
    
    try {
      // Try direct URL geocoding with OpenStreetMap's Nominatim
      console.log("Trying Nominatim with URL:", mapsUrl);
      const response = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapsUrl)}&format=json`);
      
      if (response.data && response.data.length > 0) {
        const coords = {
          lat: parseFloat(response.data[0].lat),
          lng: parseFloat(response.data[0].lon)
        };
        console.log("Found coordinates via Nominatim:", coords);
        return coords;
      }
      
      // Try to extract and geocode any place name from the URL
      const placeName = extractPlaceNameFromUrl(mapsUrl);
      if (placeName) {
        console.log("Trying with extracted place name:", placeName);
        const nameResponse = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json`);
        if (nameResponse.data && nameResponse.data.length > 0) {
          const coords = {
            lat: parseFloat(nameResponse.data[0].lat),
            lng: parseFloat(nameResponse.data[0].lon)
          };
          console.log("Found coordinates via place name:", coords);
          return coords;
        }
      }
    } catch (error) {
      console.error("Error getting place details:", error);
    }
    
    return null;
  }

  // Helper function to extract a meaningful place name from Google Maps URL
  function extractPlaceNameFromUrl(url) {
    // Try to extract place name from URL formats like /place/PlaceName/
    const placeMatch = url.match(/\/place\/([^\/]+)/);
    if (placeMatch && placeMatch[1]) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).replace(/-/g, ' ');
    }
    
    // Try to extract location name from the URL path
    const pathParts = url.split('/');
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      // Skip common URL parts and very short segments
      if (part && 
          !part.includes('.') && 
          !part.includes('maps') && 
          !part.includes('http') && 
          !part.includes('goo.gl') && 
          part.length > 3) {
        return decodeURIComponent(part.replace(/\+/g, ' ')).replace(/-/g, ' ');
      }
    }
    
    return null;
  }

  // Detect mobile screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
        setHeaderVisible(false);
      } else {
        setHeaderVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

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
    if (filterCreatedBy && getCreatorName(customer) !== filterCreatedBy) return false;
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
      top: headerVisible ? (isOnline ? 0 : '2rem') : '-80px',
      zIndex: 1000,
      boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.4)',
      transition: 'top 0.3s cubic-bezier(0.4,0,0.2,1)'
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

  // Helper: expand Google Maps short links
  async function expandShortLink(url) {
    try {
      // Use a CORS proxy for the HEAD request if needed in production
      const response = await fetch(url, { 
        method: 'HEAD', 
        redirect: 'follow',
        mode: 'no-cors' // This helps with CORS issues in development
      });
      return response.url || url;
    } catch (error) {
      console.error("Error expanding short link:", error);
      return url;
    }
  }

  // Update map search handler to support short links
  async function handleMapSearch(search, setLoading, setInput, setCenter, showNotification) {
    if (!search.trim()) return;
    setLoading(true);
    
    try {
      let coords = null;
      let input = search.trim();
      console.log("Processing search input:", input);
      
      // Step 1: Check if input contains coordinates directly
      const coordsMatch = input.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
      if (coordsMatch) {
        console.log("Direct coordinates detected");
        coords = {
          lat: parseFloat(coordsMatch[1]),
          lng: parseFloat(coordsMatch[2])
        };
      } 
      // Step 2: Check if it's a Google Maps URL
      else if (input.includes('maps.google.') || 
               input.includes('google.com/maps') || 
               input.includes('goo.gl/maps') || 
               input.includes('maps.app.goo.gl')) {
        
        showNotification('Processing map link... this may take a moment', 'info');
        console.log("Google Maps link detected");
        
        // Try our direct extraction method first
        coords = await extractCoordinatesFromGoogleMapsLink(input);
        
        // If direct extraction fails, fall back to other methods
        if (!coords) {
          console.log("Direct extraction failed, trying Nominatim");
          coords = await getPlaceDetails(input);
          
          // If all automatic methods fail, offer manual approach
          if (!coords) {
            console.log("All automatic methods failed, offering manual option");
            
            // Extract any place name we can find
            const placeName = extractPlaceNameFromUrl(input);
            
            if (placeName) {
              // Create a user-friendly message
              const message = `Could not extract location from Google Maps link automatically.\n\nWe found a potential place name: "${placeName}"\n\nWould you like to search for this place name instead?`;
              
              // Show confirmation with the extracted place name
              setNotification({
                show: true,
                message: message,
                type: 'warning',
                isConfirm: true,
                onConfirm: async () => {
                  setNotification({ show: false });
                  setLoading(true);
                  const nameCoords = await geocodeAddress(placeName);
                  setLoading(false);
                  
                  if (nameCoords) {
                    setCenter(nameCoords);
                    setInput('');
                    showNotification(`Location found for "${placeName}"!`, 'success');
                  } else {
                    showNotification(`Could not find location for "${placeName}". Please try entering the address manually.`, 'warning');
                  }
                },
                onCancel: () => {
                  setNotification({ show: false });
                }
              });
              
              return false;
            } else {
              showNotification('Could not extract location from Google Maps link. Please paste coordinates directly or enter the address manually.', 'warning');
              return false;
            }
          }
        }
      }
      // Step 3: Treat as a regular address/place name
      else {
        console.log("Treating as regular address/place name");
        coords = await geocodeAddress(input);
      }
      
      // Handle results
      if (coords) {
        console.log("Found coordinates:", coords);
        setCenter(coords);
        setInput('');
        showNotification('Location found!', 'success');
        return true;
      } else {
        console.log("No coordinates found");
        showNotification('Location not found. Please try entering coordinates directly (e.g. "30.123, 31.456").', 'warning');
        return false;
      }
    } catch (error) {
      console.error("Search error:", error);
      showNotification('Error searching for location. Please try again or enter coordinates directly.', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Fetch suggestions from Nominatim
  async function fetchSuggestions(query) {
    if (!query) return [];
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
    const res = await axios.get(url);
    return res.data.map(item => ({
      display: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    }));
  }

  // Extract coordinates directly from a Google Maps link
  async function extractCoordinatesFromGoogleMapsLink(mapLink) {
    console.log("Attempting to extract coordinates from:", mapLink);
    
    // Remove @ prefix if present
    if (mapLink.startsWith('@')) {
      mapLink = mapLink.substring(1);
    }
    
    try {
      // First, try direct parsing from URL for obvious patterns
      
      // Check for @lat,lng format in the URL
      const atMatch = mapLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        console.log("Found coordinates in @lat,lng format");
        return {
          lat: parseFloat(atMatch[1]),
          lng: parseFloat(atMatch[2])
        };
      }
      
      // Try the ll= parameter (latitude,longitude)
      const llMatch = mapLink.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (llMatch) {
        console.log("Found coordinates in ll= parameter");
        return {
          lat: parseFloat(llMatch[1]),
          lng: parseFloat(llMatch[2])
        };
      }
      
      // Try the q= parameter when it contains coordinates
      const qMatch = mapLink.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        console.log("Found coordinates in q= parameter");
        return {
          lat: parseFloat(qMatch[1]),
          lng: parseFloat(qMatch[2])
        };
      }
      
      // If direct URL parsing doesn't work, try using a CORS proxy to access the content
      console.log("Direct URL parsing failed, trying with CORS proxy");
      
      // Use a CORS proxy (find one that works - these are examples)
      // Try multiple proxies in case some are blocked or rate-limited
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(mapLink)}`,
        `https://corsproxy.io/?${encodeURIComponent(mapLink)}`,
        `https://cors-anywhere.herokuapp.com/${mapLink}`
      ];
      
      let html = null;
      
      // Try each proxy until one works
      for (const proxyUrl of proxies) {
        try {
          console.log("Trying proxy:", proxyUrl);
          const response = await fetch(proxyUrl, { timeout: 5000 });
          if (response.ok) {
            html = await response.text();
            console.log("Got response from proxy, length:", html.length);
            break;
          }
        } catch (e) {
          console.error("Proxy attempt failed:", e);
          continue;
        }
      }
      
      if (!html) {
        console.error("All proxies failed");
        return null;
      }
      
      // Once we have the HTML, search for coordinates in common patterns
      
      // Look for initialize map with coordinates
      const initMatch = html.match(/initialize\([^)]*(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      if (initMatch) {
        console.log("Found coordinates in initialize function");
        return {
          lat: parseFloat(initMatch[1]),
          lng: parseFloat(initMatch[2])
        };
      }
      
      // Look for viewport center pattern
      const viewportMatch = html.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/);
      if (viewportMatch) {
        console.log("Found coordinates in viewport center");
        return {
          lat: parseFloat(viewportMatch[1]),
          lng: parseFloat(viewportMatch[2])
        };
      }
      
      // Look for any @lat,lng pattern in the HTML
      const htmlAtMatch = html.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (htmlAtMatch) {
        console.log("Found coordinates in @lat,lng format in HTML");
        return {
          lat: parseFloat(htmlAtMatch[1]),
          lng: parseFloat(htmlAtMatch[2])
        };
      }
      
      // Look for JSON data with coordinates
      const jsonMatches = html.match(/\[(-?\d+\.\d+),(-?\d+\.\d+)\]/g);
      if (jsonMatches && jsonMatches.length > 0) {
        // Parse the first match as it's likely to be the main coordinates
        const match = jsonMatches[0].match(/\[(-?\d+\.\d+),(-?\d+\.\d+)\]/);
        if (match) {
          console.log("Found coordinates in JSON data");
          return {
            lat: parseFloat(match[1]),
            lng: parseFloat(match[2])
          };
        }
      }
      
      console.log("Could not extract coordinates from the HTML content");
      return null;
    } catch (error) {
      console.error("Error extracting coordinates:", error);
      return null;
    }
  }

  // Helper function to extract a meaningful place name from Google Maps URL
  function extractPlaceNameFromUrl(url) {
    // Try to extract place name from URL formats like /place/PlaceName/
    const placeMatch = url.match(/\/place\/([^\/]+)/);
    if (placeMatch && placeMatch[1]) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).replace(/-/g, ' ');
    }
    
    // Try to extract location name from the URL path
    const pathParts = url.split('/');
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      // Skip common URL parts and very short segments
      if (part && 
          !part.includes('.') && 
          !part.includes('maps') && 
          !part.includes('http') && 
          !part.includes('goo.gl') && 
          part.length > 3) {
        return decodeURIComponent(part.replace(/\+/g, ' ')).replace(/-/g, ' ');
      }
    }
    
    return null;
  }

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
      <header style={{
        ...styles.header,
        top: headerVisible ? (isOnline ? 0 : '2rem') : '-80px',
        transition: 'top 0.3s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 1000
      }}>
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

        {(currentView === 'list' || currentView === 'map') && showFilters && (
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
                                Added by: {getCreatorName(customer)}
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
                            Added by: {getCreatorName(customer)}
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
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search address or paste Google Maps link..."
                value={mapSearch}
                onChange={async e => {
                  setMapSearch(e.target.value);
                  if (e.target.value && !e.target.value.includes('maps.app.goo.gl') && !e.target.value.includes('goo.gl/maps')) {
                    const suggestions = await fetchSuggestions(e.target.value);
                    setMapSuggestions(suggestions);
                    setShowMapSuggestions(true);
                  } else {
                    setMapSuggestions([]);
                    setShowMapSuggestions(false);
                  }
                }}
                style={{ ...styles.input, flex: 1 }}
                onFocus={() => setShowMapSuggestions(mapSuggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowMapSuggestions(false), 200)}
              />
              <button
                style={styles.secondaryButton}
                disabled={mapSearchLoading || !mapSearch}
                onClick={async () => {
                  await handleMapSearch(mapSearch, setMapSearchLoading, setMapSearch, setFilterCenter, showNotification);
                }}
              >
                {mapSearchLoading ? 'Searching...' : 'Go'}
              </button>
            </div>
            {showMapSuggestions && mapSuggestions.length > 0 && (
              <div style={{ position: 'absolute', background: '#232323', zIndex: 1002, width: '100%', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                {mapSuggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{ padding: '0.75rem', cursor: 'pointer', color: '#e2e8f0', borderBottom: i < mapSuggestions.length-1 ? '1px solid #3a3a3a' : 'none' }}
                    onMouseDown={() => {
                      setFilterCenter({ lat: s.lat, lng: s.lng });
                      setMapSearch(s.display);
                      setShowMapSuggestions(false);
                    }}
                  >
                    {s.display}
                  </div>
                ))}
              </div>
            )}
            <div style={{ height: '70vh', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #475569', position: 'relative', zIndex: 1 }}>
              <MapContainer
                className="custom-leaflet-map"
                center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [30.0444, 31.2357]}
                zoom={currentLocation ? 12 : 8}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <MapClickHandler 
                  onMapClick={(latlng) => setFilterCenter(latlng)} 
                  tempMarker={null}
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
                {filterCenter && (
                  <Marker position={[filterCenter.lat, filterCenter.lng]} icon={filterCenterIcon}>
                    <Popup>
                      <div style={{ textAlign: 'center' }}>
                        <b>Filter Center</b><br/>
                        {filterCenter.lat.toFixed(6)}, {filterCenter.lng.toFixed(6)}
                      </div>
                    </Popup>
                  </Marker>
                )}
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
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search address or paste Google Maps link..."
                    value={addMapSearch}
                    onChange={async e => {
                      setAddMapSearch(e.target.value);
                      if (e.target.value && !e.target.value.includes('maps.app.goo.gl') && !e.target.value.includes('goo.gl/maps')) {
                        const suggestions = await fetchSuggestions(e.target.value);
                        setAddMapSuggestions(suggestions);
                        setShowAddMapSuggestions(true);
                      } else {
                        setAddMapSuggestions([]);
                        setShowAddMapSuggestions(false);
                      }
                    }}
                    style={{ ...styles.input, flex: 1 }}
                    onFocus={() => setShowAddMapSuggestions(addMapSuggestions.length > 0)}
                    onBlur={() => setTimeout(() => setShowAddMapSuggestions(false), 200)}
                  />
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    disabled={addMapSearchLoading || !addMapSearch}
                    onClick={async () => {
                      await handleMapSearch(addMapSearch, setAddMapSearchLoading, setAddMapSearch, setTempMarker, showNotification);
                    }}
                  >
                    {addMapSearchLoading ? 'Searching...' : 'Go'}
                  </button>
                  {showAddMapSuggestions && addMapSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: '#232323', zIndex: 1002, width: '100%', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', pointerEvents: 'auto' }}>
                      {addMapSuggestions.map((s, i) => (
                        <div
                          key={i}
                          style={{ padding: '0.75rem', cursor: 'pointer', color: '#e2e8f0', borderBottom: i < addMapSuggestions.length-1 ? '1px solid #3a3a3a' : 'none' }}
                          onMouseDown={() => {
                            setTempMarker({ lat: s.lat, lng: s.lng });
                            setAddMapSearch(s.display);
                            setShowAddMapSuggestions(false);
                          }}
                        >
                          {s.display}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div style={styles.mapContainer}>
                  <MapContainer
                    center={tempMarker ? [tempMarker.lat, tempMarker.lng] : currentLocation ? [currentLocation.lat, currentLocation.lng] : [30.0444, 31.2357]}
                    zoom={tempMarker ? 15 : currentLocation ? 12 : 8}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    <MapClickHandler onMapClick={handleMapClick} tempMarker={tempMarker} />
                    
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
                    
                    {tempMarker && (
                      <Marker position={[tempMarker.lat, tempMarker.lng]} icon={filterCenterIcon}>
                        <Popup>
                          <div style={{ textAlign: 'center' }}>
                            <b>Selected Location</b><br/>
                            {tempMarker.lat.toFixed(6)}, {tempMarker.lng.toFixed(6)}
                          </div>
                        </Popup>
                      </Marker>
                    )}
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