// Local storage with sync queue
function generateUUID() {
  // RFC4122 version 4 compliant UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class OfflineDataManager {
  constructor() {
    this.syncQueue = JSON.parse(localStorage.getItem('syncQueue') || '[]');
  }

  // Store data locally
  storeLocally(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // Get local data
  getLocal(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  // Add operation to sync queue
  addToSyncQueue(operation) {
    this.syncQueue.push({
      ...operation,
      timestamp: Date.now(),
      id: generateUUID()
    });
    localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
  }

  // Process sync queue when online
  async processSyncQueue(supabase) {
    const queue = [...this.syncQueue];
    const successful = [];

    for (const operation of queue) {
      try {
        await this.executeOperation(operation, supabase);
        successful.push(operation.id);
      } catch (error) {
        console.error('Sync operation failed:', operation, error);
      }
    }

    // Remove successful operations
    this.syncQueue = this.syncQueue.filter(op => !successful.includes(op.id));
    localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
  }

  async executeOperation(operation, supabase) {
    const { type, table, data, id } = operation;

    switch (type) {
      case 'INSERT':
        return await supabase.from(table).insert(data);
      case 'UPDATE':
        return await supabase.from(table).update(data).eq('id', id);
      case 'DELETE':
        return await supabase.from(table).delete().eq('id', id);
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }
}

export default OfflineDataManager; 