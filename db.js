const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

// Initialize database file
function init() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Helper to read registrations from file
function readData() {
  try {
    init();
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading database file:", err);
    return [];
  }
}

// Helper to write registrations to file safely
function writeData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error("Error writing database file:", err);
    return false;
  }
}

// Generate a random, clean 8-character Registration ID (e.g. ADK-A9B8C)
function generateRegistrationId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = 'ADK-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Guarantee uniqueness
  const existing = readData();
  if (existing.some(r => r.id === code)) {
    return generateRegistrationId();
  }
  return code;
}

module.exports = {
  init,

  // Get all registrations (sorted by created_at descending)
  getAll() {
    const list = readData();
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  // Find registration by ID
  getById(id) {
    const list = readData();
    return list.find(r => r.id === id) || null;
  },

  // Find registration by UroPay Order ID
  getByOrderId(orderId) {
    const list = readData();
    return list.find(r => r.uropay_order_id === orderId) || null;
  },

  // Find registration by UTR / Reference Number
  getByUtr(utr) {
    const list = readData();
    if (!utr) return null;
    return list.find(r => r.utr === utr) || null;
  },

  // Create a new registration
  create(fields) {
    const list = readData();
    const now = new Date().toISOString();
    
    const registration = {
      id: generateRegistrationId(),
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
      year: fields.year,
      college: fields.college,
      role_preference: fields.role_preference || 'No Preference',
      notes: fields.notes || '',
      status: 'pending', // pending, payment_claimed, verified, rejected
      uropay_order_id: fields.uropay_order_id || null,
      utr: null,
      created_at: now,
      updated_at: now
    };

    list.push(registration);
    writeData(list);
    return registration;
  },

  // Update an existing registration
  update(id, updates) {
    const list = readData();
    const index = list.findIndex(r => r.id === id);
    if (index === -1) return null;

    const updated = {
      ...list[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    list[index] = updated;
    writeData(list);
    return updated;
  },

  // Delete a registration
  delete(id) {
    const list = readData();
    const filtered = list.filter(r => r.id !== id);
    if (list.length === filtered.length) return false;
    writeData(filtered);
    return true;
  },

  // Get statistics
  getStats() {
    const list = readData();
    const stats = {
      total: list.length,
      pending: 0,
      payment_claimed: 0,
      verified: 0,
      rejected: 0
    };
    
    list.forEach(r => {
      if (stats[r.status] !== undefined) {
        stats[r.status]++;
      }
    });

    return stats;
  }
};
