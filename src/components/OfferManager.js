import React, { useState, useEffect } from 'react';

const OfferManager = ({ selectedCustomer, onBack, styles, isMobile }) => {
  const [catalog, setCatalog] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [language, setLanguage] = useState('Arabic');
  const [showAddItem, setShowAddItem] = useState(false);

  // Initialize customer name when selectedCustomer changes
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerName(selectedCustomer.name || '');
    }
  }, [selectedCustomer]);

  // Load catalog from localStorage or use default
  useEffect(() => {
    const savedCatalog = localStorage.getItem('priceCatalog');
    if (savedCatalog) {
      setCatalog(JSON.parse(savedCatalog));
    } else {
      // Default catalog from Python app
      const defaultCatalog = [
        { english: 'Zumex speed pro self-service podium', arabic: 'ماكينة برتقال', default_price: 70000 },
        { english: 'Zumex speed S+ plus', arabic: 'ماكينة برتقال بلاس', default_price: 80000 },
        { english: 'Speed pomegranate', arabic: 'ماكينة رمان', default_price: 140000 },
        { english: 'Front cover', arabic: 'الوش الأمامي بالجنابين', default_price: 12000 },
        { english: 'Blade holder', arabic: 'السكينة', default_price: 5000 },
        { english: 'Ejectors', arabic: 'الجنبين الخاصين بقشر البرتقال', default_price: 3500 }
      ];
      setCatalog(defaultCatalog);
      localStorage.setItem('priceCatalog', JSON.stringify(defaultCatalog));
    }
  }, []);

  const saveCatalog = (newCatalog) => {
    setCatalog(newCatalog);
    localStorage.setItem('priceCatalog', JSON.stringify(newCatalog));
  };

  const addToCatalog = (item) => {
    const newCatalog = [...catalog, item];
    saveCatalog(newCatalog);
  };

  const removeFromCatalog = (index) => {
    const newCatalog = catalog.filter((_, i) => i !== index);
    saveCatalog(newCatalog);
  };

  const addItemToOffer = (catalogItem) => {
    const newItem = {
      item: catalogItem,
      quantity: 1,
      price: catalogItem.default_price || 0
    };
    setSelectedItems([...selectedItems, newItem]);
  };

  const removeItemFromOffer = (index) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const updateItemQuantity = (index, quantity) => {
    const updated = [...selectedItems];
    updated[index].quantity = parseInt(quantity) || 1;
    setSelectedItems(updated);
  };

  const updateItemPrice = (index, price) => {
    const updated = [...selectedItems];
    updated[index].price = parseFloat(price) || 0;
    setSelectedItems(updated);
  };

  const generateOffer = () => {
    if (selectedItems.length === 0) {
      alert('Please add items to the offer first!');
      return;
    }

    // For now, just create a simple text representation
    // Later we can implement proper PDF generation
    const offerText = generateOfferText();
    
    // Create downloadable file
    const blob = new Blob([offerText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price_offer_${customerName}_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateOfferText = () => {
    const currentDate = new Date().toLocaleDateString('en-GB');
    let text = '';
    
    if (language === 'Arabic') {
      text = `عرض سعر\n\n`;
      text += `العميل: ${customerName}\n`;
      text += `التاريخ: ${currentDate}\n\n`;
      text += `الأصناف:\n`;
      text += `${'='.repeat(50)}\n`;
      text += `الرقم | الصنف | الكمية | السعر\n`;
      text += `${'='.repeat(50)}\n`;
      
      selectedItems.forEach((item, index) => {
        text += `${index + 1} | ${item.item.arabic} | ${item.quantity} | ${item.price.toLocaleString()}\n`;
      });
    } else {
      text = `Price Offer\n\n`;
      text += `Customer: ${customerName}\n`;
      text += `Date: ${currentDate}\n\n`;
      text += `Items:\n`;
      text += `${'='.repeat(50)}\n`;
      text += `# | Item | Qty | Price\n`;
      text += `${'='.repeat(50)}\n`;
      
      selectedItems.forEach((item, index) => {
        text += `${index + 1} | ${item.item.english} | ${item.quantity} | ${item.price.toLocaleString()}\n`;
      });
    }
    
    const total = selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    text += `${'='.repeat(50)}\n`;
    text += language === 'Arabic' ? `الإجمالي: ${total.toLocaleString()}\n` : `Total: ${total.toLocaleString()}\n`;
    
    return text;
  };

  const AddItemForm = () => {
    const [newItem, setNewItem] = useState({ english: '', arabic: '', default_price: 0 });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (newItem.english.trim() && newItem.arabic.trim()) {
        addToCatalog(newItem);
        setNewItem({ english: '', arabic: '', default_price: 0 });
        setShowAddItem(false);
      }
    };

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '2rem',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '100%',
          border: '1px solid #3a3a3a'
        }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: '1.5rem' }}>Add New Item to Catalog</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#e2e8f0', marginBottom: '0.5rem' }}>
                English Name:
              </label>
              <input
                type="text"
                value={newItem.english}
                onChange={(e) => setNewItem({ ...newItem, english: e.target.value })}
                style={styles.input}
                required
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#e2e8f0', marginBottom: '0.5rem' }}>
                Arabic Name:
              </label>
              <input
                type="text"
                value={newItem.arabic}
                onChange={(e) => setNewItem({ ...newItem, arabic: e.target.value })}
                style={{ ...styles.input, textAlign: 'right' }}
                required
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: '#e2e8f0', marginBottom: '0.5rem' }}>
                Default Price:
              </label>
              <input
                type="number"
                value={newItem.default_price}
                onChange={(e) => setNewItem({ ...newItem, default_price: parseFloat(e.target.value) || 0 })}
                style={styles.input}
                min="0"
                step="0.01"
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowAddItem(false)}
                style={styles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={styles.primaryButton}
              >
                Add Item
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button onClick={onBack} style={styles.secondaryButton}>
          ← Back
        </button>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#e2e8f0', margin: 0 }}>
          Price Offer Generator
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2rem' }}>
        {/* Offer Details */}
        <div>
          <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>Offer Details</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: '0.5rem' }}>
              Customer Name:
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={styles.input}
              placeholder="Enter customer name..."
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: '0.5rem' }}>
              Language:
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={styles.input}
            >
              <option value="Arabic">Arabic</option>
              <option value="English">English</option>
            </select>
          </div>

          <h4 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>Selected Items</h4>
          
          {selectedItems.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No items selected</p>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              {selectedItems.map((item, index) => (
                <div key={index} style={{
                  backgroundColor: '#232323',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '0.5rem',
                  border: '1px solid #3a3a3a'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e2e8f0', fontWeight: '600' }}>
                        {language === 'Arabic' ? item.item.arabic : item.item.english}
                      </div>
                    </div>
                    <button
                      onClick={() => removeItemFromOffer(index)}
                      style={{
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem' }}>Qty:</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(index, e.target.value)}
                        style={{
                          ...styles.input,
                          width: '80px',
                          fontSize: '0.875rem',
                          padding: '0.5rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem' }}>Price:</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateItemPrice(index, e.target.value)}
                        style={{
                          ...styles.input,
                          width: '120px',
                          fontSize: '0.875rem',
                          padding: '0.5rem'
                        }}
                      />
                    </div>
                    <div style={{ color: '#e67e22', fontWeight: '600' }}>
                      Total: {(item.quantity * item.price).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              
              <div style={{
                textAlign: 'right',
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#232323',
                borderRadius: '8px',
                border: '1px solid #3a3a3a'
              }}>
                <div style={{ color: '#e67e22', fontSize: '1.25rem', fontWeight: '700' }}>
                  Grand Total: {selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={generateOffer}
            style={{
              ...styles.primaryButton,
              width: '100%',
              marginTop: '1rem'
            }}
            disabled={selectedItems.length === 0}
          >
            🚀 Generate Offer
          </button>
        </div>

        {/* Catalog Management */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#e2e8f0', margin: 0 }}>Item Catalog</h3>
            <button
              onClick={() => setShowAddItem(true)}
              style={styles.primaryButton}
            >
              + Add Item
            </button>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {catalog.map((item, index) => (
              <div key={index} style={{
                backgroundColor: '#232323',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                border: '1px solid #3a3a3a'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e2e8f0', fontWeight: '600', marginBottom: '0.25rem' }}>
                      {item.english}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'right' }}>
                      {item.arabic}
                    </div>
                    <div style={{ color: '#e67e22', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      Default Price: {item.default_price?.toLocaleString() || 'Not set'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => addItemToOffer(item)}
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Add to Offer
                  </button>
                  <button
                    onClick={() => removeFromCatalog(index)}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddItem && <AddItemForm />}
    </div>
  );
};

export default OfferManager;