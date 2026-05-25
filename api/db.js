const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_FILE = path.join(__dirname, 'data.json');

// Connect to pg if DATABASE_URL is set in environment
const isPg = !!process.env.DATABASE_URL;
let pool = null;

if (isPg) {
  console.log("[Database] Using PostgreSQL Database Client");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for secure serverless connections
  });
} else {
  console.log("[Database] Using Local JSON File Client");
}

// Initialize database schema or file
async function init() {
  if (isPg) {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS registrations (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          year VARCHAR(50) NOT NULL,
          college VARCHAR(255) NOT NULL,
          role_preference VARCHAR(255),
          notes TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          utr VARCHAR(50),
          uropay_order_id VARCHAR(255),
          created_at VARCHAR(100) NOT NULL,
          updated_at VARCHAR(100) NOT NULL
        );
      `);
      console.log("[Database] PostgreSQL table initialized.");
    } catch (err) {
      console.error("[Database] Error initializing PostgreSQL:", err);
    } finally {
      client.release();
    }
  } else {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  }
}

// Helper to read registrations from file
function readData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
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
async function generateRegistrationId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = 'ADK-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Guarantee uniqueness
  let exists = false;
  if (isPg) {
    const res = await pool.query('SELECT 1 FROM registrations WHERE id = $1', [code]);
    exists = res.rowCount > 0;
  } else {
    const existing = readData();
    exists = existing.some(r => r.id === code);
  }
  
  if (exists) {
    return generateRegistrationId();
  }
  return code;
}

module.exports = {
  init,

  // Get all registrations (sorted by created_at descending)
  async getAll() {
    if (isPg) {
      const res = await pool.query('SELECT * FROM registrations ORDER BY created_at DESC');
      return res.rows;
    } else {
      const list = readData();
      return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  // Find registration by ID
  async getById(id) {
    if (isPg) {
      const res = await pool.query('SELECT * FROM registrations WHERE id = $1', [id]);
      return res.rows[0] || null;
    } else {
      const list = readData();
      return list.find(r => r.id === id) || null;
    }
  },

  // Find registration by UroPay Order ID
  async getByOrderId(orderId) {
    if (isPg) {
      const res = await pool.query('SELECT * FROM registrations WHERE uropay_order_id = $1', [orderId]);
      return res.rows[0] || null;
    } else {
      const list = readData();
      return list.find(r => r.uropay_order_id === orderId) || null;
    }
  },

  // Find registration by UTR / Reference Number
  async getByUtr(utr) {
    if (!utr) return null;
    if (isPg) {
      const res = await pool.query('SELECT * FROM registrations WHERE utr = $1', [utr]);
      return res.rows[0] || null;
    } else {
      const list = readData();
      return list.find(r => r.utr === utr) || null;
    }
  },

  // Create a new registration
  async create(fields) {
    const now = new Date().toISOString();
    const id = await generateRegistrationId();
    
    const registration = {
      id,
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

    if (isPg) {
      await pool.query(`
        INSERT INTO registrations (id, name, email, phone, year, college, role_preference, notes, status, uropay_order_id, utr, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        registration.id,
        registration.name,
        registration.email,
        registration.phone,
        registration.year,
        registration.college,
        registration.role_preference,
        registration.notes,
        registration.status,
        registration.uropay_order_id,
        registration.utr,
        registration.created_at,
        registration.updated_at
      ]);
    } else {
      const list = readData();
      list.push(registration);
      writeData(list);
    }
    return registration;
  },

  // Update an existing registration
  async update(id, updates) {
    const now = new Date().toISOString();
    
    if (isPg) {
      const keys = Object.keys(updates);
      if (keys.length === 0) return null;
      
      const setClauses = keys.map((key, index) => `"${key}" = $${index + 2}`);
      setClauses.push(`"updated_at" = $${keys.length + 2}`);
      
      const queryText = `
        UPDATE registrations
        SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING *
      `;
      
      const values = [id, ...keys.map(k => updates[k]), now];
      const res = await pool.query(queryText, values);
      return res.rows[0] || null;
    } else {
      const list = readData();
      const index = list.findIndex(r => r.id === id);
      if (index === -1) return null;
 
      const updated = {
        ...list[index],
        ...updates,
        updated_at: now
      };

      list[index] = updated;
      writeData(list);
      return updated;
    }
  },

  // Delete a registration
  async delete(id) {
    if (isPg) {
      const res = await pool.query('DELETE FROM registrations WHERE id = $1', [id]);
      return (res.rowCount || 0) > 0;
    } else {
      const list = readData();
      const filtered = list.filter(r => r.id !== id);
      if (list.length === filtered.length) return false;
      writeData(filtered);
      return true;
    }
  },

  // Get statistics
  async getStats() {
    if (isPg) {
      const stats = {
        total: 0,
        pending: 0,
        payment_claimed: 0,
        verified: 0,
        rejected: 0
      };
      
      const res = await pool.query('SELECT status, COUNT(*) as count FROM registrations GROUP BY status');
      let total = 0;
      res.rows.forEach(row => {
        const count = parseInt(row.count, 10);
        if (stats[row.status] !== undefined) {
          stats[row.status] = count;
        }
        total += count;
      });
      stats.total = total;
      return stats;
    } else {
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
  }
};
