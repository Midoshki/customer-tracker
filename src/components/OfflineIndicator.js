// Offline indicator component
const OfflineIndicator = ({ isOnline }) => {
  if (isOnline) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#dc2626',
      color: 'white',
      padding: '0.5rem',
      textAlign: 'center',
      fontSize: '0.875rem',
      zIndex: 9999,
      fontWeight: '500'
    }}>
      🚫 You're offline. Changes will be synced when connection is restored.
    </div>
  );
};

export default OfflineIndicator; 