const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_FILE = path.join(__dirname, 'data.json');
const PARTIES_FILE = path.join(__dirname, 'parties.json');
const JUDGES_FILE = path.join(__dirname, 'judges.json');
const CRITERIA_FILE = path.join(__dirname, 'criteria.json');
const SCORES_FILE = path.join(__dirname, 'scores.json');
const AWARDS_FILE = path.join(__dirname, 'awards.json');
const LEADERSHIP_FILE = path.join(__dirname, 'leadership.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const LOG_FILE = path.join(__dirname, '..', 'scores_log.csv');
const COALITION_LOCK_FILE = path.join(__dirname, 'coalition_lock.json');



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
      // Ensure new columns exist for existing tables
      await client.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255);`);
      await client.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(50);`);
      await client.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS portfolio VARCHAR(255);`);
      await client.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS assigned_party VARCHAR(255);`);
      await client.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS assigned_committee VARCHAR(255);`);
      await client.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS elected_role VARCHAR(255);`);
      await client.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS assigned_constituency VARCHAR(255);`);

      // Parties & Committees table
      await client.query(`
        CREATE TABLE IF NOT EXISTS parties (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          side VARCHAR(50),
          description TEXT,
          created_at VARCHAR(100) NOT NULL
        );
      `);
      // Judges table
      await client.query(`
        CREATE TABLE IF NOT EXISTS judges (
          id VARCHAR(50) PRIMARY KEY,
          password VARCHAR(255) NOT NULL,
          created_at VARCHAR(100) NOT NULL
        );
      `);

      // Scoring Criteria table
      await client.query(`
        CREATE TABLE IF NOT EXISTS scoring_criteria (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          max_points INTEGER DEFAULT 10,
          description TEXT,
          created_at VARCHAR(100) NOT NULL
        );
      `);

      // Scores table
      await client.query(`
        CREATE TABLE IF NOT EXISTS scores (
          delegate_id VARCHAR(50) NOT NULL,
          judge_id VARCHAR(50) NOT NULL,
          criteria_id VARCHAR(50) NOT NULL,
          score INTEGER NOT NULL,
          updated_at VARCHAR(100) NOT NULL,
          PRIMARY KEY (delegate_id, judge_id, criteria_id)
        );
      `);

      // Awards table
      await client.query(`
        CREATE TABLE IF NOT EXISTS awards (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          criteria_ids TEXT NOT NULL,
          requires_side VARCHAR(50),
          created_at VARCHAR(100) NOT NULL
        );
      `);
      await client.query(`ALTER TABLE awards ADD COLUMN IF NOT EXISTS requires_side VARCHAR(50);`);
      await client.query(`ALTER TABLE awards ADD COLUMN IF NOT EXISTS requires_role VARCHAR(255);`);

      // Leadership table
      await client.query(`
        CREATE TABLE IF NOT EXISTS leadership (
          role VARCHAR(50) PRIMARY KEY,
          delegate_id VARCHAR(50) NOT NULL
        );
      `);

      // Sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          created_at VARCHAR(100) NOT NULL
        );
      `);

      // Add session_id to scores table
      await client.query(`ALTER TABLE scores ADD COLUMN IF NOT EXISTS session_id VARCHAR(50) DEFAULT 'general'`);

      // If scores table exists with old PK, migrate to include session_id
      try {
        await client.query(`
          ALTER TABLE scores DROP CONSTRAINT scores_pkey CASCADE
        `);
        await client.query(`
          ALTER TABLE scores ADD PRIMARY KEY (delegate_id, judge_id, criteria_id, session_id)
        `);
      } catch (e) {
        // PK might already be updated or table doesn't have data yet
      }

      console.log("[Database] PostgreSQL table and columns verified.");
    } catch (err) {
      console.error("[Database] Error initializing PostgreSQL:", err);
    } finally {
      client.release();
    }
  } else {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
    if (!fs.existsSync(PARTIES_FILE)) {
      fs.writeFileSync(PARTIES_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
    if (!fs.existsSync(JUDGES_FILE)) {
      fs.writeFileSync(JUDGES_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
    if (!fs.existsSync(CRITERIA_FILE)) {
      fs.writeFileSync(CRITERIA_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
    if (!fs.existsSync(SCORES_FILE)) {
      fs.writeFileSync(SCORES_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
    if (!fs.existsSync(AWARDS_FILE)) {
      fs.writeFileSync(AWARDS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
    if (!fs.existsSync(LEADERSHIP_FILE)) {
      fs.writeFileSync(LEADERSHIP_FILE, JSON.stringify({ ministers: {} }, null, 2), 'utf-8');
    }
    if (!fs.existsSync(SESSIONS_FILE)) {
      const now = new Date().toISOString();
      const defaultSessions = [
        { id: 'QH', name: 'Question Hour (QH)', created_at: now },
        { id: 'ZH', name: 'Zero Hour (ZH)', created_at: now },
        { id: 'MR', name: 'Ministry Reports (MR)', created_at: now },
        { id: 'BP', name: 'Bill Presentations (BP)', created_at: now },
        { id: 'SS', name: 'Surprise Session (SS)', created_at: now }
      ];
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(defaultSessions, null, 2), 'utf-8');
    }
    if (!fs.existsSync(COALITION_LOCK_FILE)) {
      fs.writeFileSync(COALITION_LOCK_FILE, JSON.stringify({ locked: false }), 'utf-8');
    }
  }

  // Coalition lock file for both modes
  if (!fs.existsSync(COALITION_LOCK_FILE)) {
    fs.writeFileSync(COALITION_LOCK_FILE, JSON.stringify({ locked: false }), 'utf-8');
  }

  // Always ensure safety log exists (Safety First)
  if (!fs.existsSync(LOG_FILE)) {
    const header = "Timestamp,Delegate ID,Judge ID,Criteria ID,Score\n";
    fs.writeFileSync(LOG_FILE, header, 'utf-8');
  }
}



init();



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
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

// Log a score entry to a separate CSV for safety
function appendToLog(entry) {
  try {
    const isNew = !fs.existsSync(LOG_FILE);
    const header = "Timestamp,Delegate ID,Judge ID,Criteria ID,Score,Session ID\n";
    const line = `${new Date().toISOString()},${entry.delegate_id},${entry.judge_id},${entry.criteria_id},${entry.score},${entry.session_id || ''}\n`;

    if (isNew) {
      fs.writeFileSync(LOG_FILE, header + line, 'utf-8');
    } else {
      fs.appendFileSync(LOG_FILE, line, 'utf-8');
    }
  } catch (err) {
    console.error("Error appending to scores log:", err);
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

async function getAllScores() {
  if (isPg) {
    const res = await pool.query(`SELECT * FROM scores ORDER BY updated_at DESC`);
    return res.rows;
  } else {
    try {
      const data = fs.readFileSync(SCORES_FILE, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
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
      parent_name: fields.parent_name || '',
      parent_phone: fields.parent_phone || '',
      year: fields.year,
      college: fields.college,
      role_preference: fields.role_preference || 'No Preference',
      notes: fields.notes || '',
      status: 'pending', // pending, payment_claimed, verified, rejected
      uropay_order_id: fields.uropay_order_id || null,
      utr: null,
      created_at: now,
      updated_at: now,
      portfolio: fields.portfolio || ''
    };

    if (isPg) {
      await pool.query(`
        INSERT INTO registrations (id, name, email, phone, parent_name, parent_phone, year, college, role_preference, notes, status, uropay_order_id, utr, created_at, updated_at, portfolio)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        registration.id,
        registration.name,
        registration.email,
        registration.phone,
        registration.parent_name,
        registration.parent_phone,
        registration.year,
        registration.college,
        registration.role_preference,
        registration.notes,
        registration.status,
        registration.uropay_order_id,
        registration.utr,
        registration.created_at,
        registration.updated_at,
        registration.portfolio
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
  },

  // ============ Parties & Committees ============

  async getParties() {
    if (isPg) {
      const res = await pool.query('SELECT * FROM parties ORDER BY type, side, name');
      return res.rows;
    } else {
      const raw = fs.existsSync(PARTIES_FILE) ? fs.readFileSync(PARTIES_FILE, 'utf-8') : '[]';
      return JSON.parse(raw).sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  async createParty({ name, type, side, description, id: givenId }) {
    const id = givenId || 'P-' + Date.now().toString(36).toUpperCase();
    const now = new Date().toISOString();
    const entry = { id, name, type, side: side || null, description: description || '', created_at: now };
    if (isPg) {
      await pool.query(
        'INSERT INTO parties (id, name, type, side, description, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, name, type, side || null, description || '', now]
      );
    } else {
      const list = JSON.parse(fs.existsSync(PARTIES_FILE) ? fs.readFileSync(PARTIES_FILE, 'utf-8') : '[]');
      list.push(entry);
      fs.writeFileSync(PARTIES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    }
    return entry;
  },

  async deleteParty(id) {
    if (isPg) {
      const res = await pool.query('DELETE FROM parties WHERE id = $1', [id]);
      return (res.rowCount || 0) > 0;
    } else {
      const list = JSON.parse(fs.existsSync(PARTIES_FILE) ? fs.readFileSync(PARTIES_FILE, 'utf-8') : '[]');
      const filtered = list.filter(p => p.id !== id);
      if (filtered.length === list.length) return false;
      fs.writeFileSync(PARTIES_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
      return true;
    }
  },

  async setCoalition(rulingIds) {
    if (isPg) {
      await pool.query("UPDATE parties SET side = 'opposition' WHERE type = 'party'");
      if (rulingIds.length > 0) {
        const placeholders = rulingIds.map((_, i) => `$${i + 1}`).join(',');
        await pool.query(`UPDATE parties SET side = 'ruling' WHERE id IN (${placeholders})`, rulingIds);
      }
    } else {
      const list = JSON.parse(fs.existsSync(PARTIES_FILE) ? fs.readFileSync(PARTIES_FILE, 'utf-8') : '[]');
      list.forEach(p => {
        if (p.type === 'party') p.side = rulingIds.includes(p.id) ? 'ruling' : 'opposition';
      });
      fs.writeFileSync(PARTIES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    }
    return { success: true };
  },

  async renameParty(id, newName) {
    if (isPg) {
      const oldRes = await pool.query('SELECT name FROM parties WHERE id = $1', [id]);
      if (oldRes.rows.length === 0) return null;
      const oldName = oldRes.rows[0].name;
      await pool.query('UPDATE parties SET name = $1 WHERE id = $2', [newName, id]);
      await pool.query('UPDATE registrations SET assigned_party = $1 WHERE assigned_party = $2', [newName, oldName]);
      return { id, name: newName };
    } else {
      const list = JSON.parse(fs.existsSync(PARTIES_FILE) ? fs.readFileSync(PARTIES_FILE, 'utf-8') : '[]');
      const party = list.find(p => p.id === id);
      if (!party) return null;
      const oldName = party.name;
      party.name = newName;
      fs.writeFileSync(PARTIES_FILE, JSON.stringify(list, null, 2), 'utf-8');
      const regs = readData();
      let changed = 0;
      regs.forEach(r => {
        if (r.assigned_party === oldName) {
          r.assigned_party = newName;
          changed++;
        }
      });
      if (changed > 0) writeData(regs);
      return { id, name: newName, updated_delegates: changed };
    }
  },

  // ============ Judges ============

  async getJudges() {
    if (isPg) {
      const res = await pool.query('SELECT id, created_at FROM judges ORDER BY created_at');
      return res.rows;
    } else {
      const raw = fs.existsSync(JUDGES_FILE) ? fs.readFileSync(JUDGES_FILE, 'utf-8') : '[]';
      return JSON.parse(raw).map(j => ({ id: j.id, created_at: j.created_at }));
    }
  },

  async createJudge({ id, password }) {
    const now = new Date().toISOString();
    if (isPg) {
      await pool.query('INSERT INTO judges (id, password, created_at) VALUES ($1,$2,$3)', [id, password, now]);
    } else {
      const list = JSON.parse(fs.existsSync(JUDGES_FILE) ? fs.readFileSync(JUDGES_FILE, 'utf-8') : '[]');
      list.push({ id, password, created_at: now });
      fs.writeFileSync(JUDGES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    }
    return { id, created_at: now };
  },

  async deleteJudge(id) {
    if (isPg) {
      const res = await pool.query('DELETE FROM judges WHERE id = $1', [id]);
      return (res.rowCount || 0) > 0;
    } else {
      const list = JSON.parse(fs.existsSync(JUDGES_FILE) ? fs.readFileSync(JUDGES_FILE, 'utf-8') : '[]');
      const filtered = list.filter(j => j.id !== id);
      if (filtered.length === list.length) return false;
      fs.writeFileSync(JUDGES_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
      return true;
    }
  },

  async verifyJudge(id, password) {
    if (isPg) {
      const res = await pool.query('SELECT * FROM judges WHERE id = $1 AND password = $2', [id, password]);
      return res.rows[0] || null;
    } else {
      const list = JSON.parse(fs.existsSync(JUDGES_FILE) ? fs.readFileSync(JUDGES_FILE, 'utf-8') : '[]');
      return list.find(j => j.id === id && j.password === password) || null;
    }
  },

  // ============ Scoring Criteria ============

  async getCriteria() {
    if (isPg) {
      const res = await pool.query('SELECT * FROM scoring_criteria ORDER BY created_at');
      return res.rows;
    } else {
      const raw = fs.existsSync(CRITERIA_FILE) ? fs.readFileSync(CRITERIA_FILE, 'utf-8') : '[]';
      return JSON.parse(raw);
    }
  },

  async createCriteria(data) {
    const id = data.id || ('C-' + Date.now().toString(36).toUpperCase());
    const { name, max_points, description } = data;
    const now = new Date().toISOString();
    const entry = { id, name, max_points: parseInt(max_points, 10), description: description || '', created_at: now };
    if (isPg) {
      await pool.query(
        'INSERT INTO scoring_criteria (id, name, max_points, description, created_at) VALUES ($1,$2,$3,$4,$5)',
        [id, name, entry.max_points, description || '', now]
      );
    } else {
      const list = JSON.parse(fs.existsSync(CRITERIA_FILE) ? fs.readFileSync(CRITERIA_FILE, 'utf-8') : '[]');
      list.push(entry);
      fs.writeFileSync(CRITERIA_FILE, JSON.stringify(list, null, 2), 'utf-8');
    }
    return entry;
  },

  async deleteCriteria(id) {
    if (isPg) {
      const res = await pool.query('DELETE FROM scoring_criteria WHERE id = $1', [id]);
      return (res.rowCount || 0) > 0;
    } else {
      const list = JSON.parse(fs.existsSync(CRITERIA_FILE) ? fs.readFileSync(CRITERIA_FILE, 'utf-8') : '[]');
      const filtered = list.filter(c => c.id !== id);
      if (filtered.length === list.length) return false;
      fs.writeFileSync(CRITERIA_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
      return true;
    }
  },

  // ============ Scores ============

  async getScoresForJudge(judgeId, sessionId) {
    if (isPg) {
      if (sessionId) {
        const res = await pool.query('SELECT * FROM scores WHERE judge_id = $1 AND session_id = $2', [judgeId, sessionId]);
        return res.rows;
      }
      const res = await pool.query('SELECT * FROM scores WHERE judge_id = $1', [judgeId]);
      return res.rows;
    } else {
      const list = JSON.parse(fs.existsSync(SCORES_FILE) ? fs.readFileSync(SCORES_FILE, 'utf-8') : '[]');
      let filtered = list.filter(s => s.judge_id === judgeId);
      if (sessionId) filtered = filtered.filter(s => s.session_id === sessionId);
      return filtered;
    }
  },

  async submitScore({ delegate_id, judge_id, criteria_id, score, session_id }) {
    const now = new Date().toISOString();
    const sid = session_id || 'general';
    if (isPg) {
      await pool.query(`
        INSERT INTO scores (delegate_id, judge_id, criteria_id, score, updated_at, session_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (delegate_id, judge_id, criteria_id, session_id)
        DO UPDATE SET score = EXCLUDED.score, updated_at = EXCLUDED.updated_at
      `, [delegate_id, judge_id, criteria_id, score, now, sid]);
    } else {
      const list = JSON.parse(fs.existsSync(SCORES_FILE) ? fs.readFileSync(SCORES_FILE, 'utf-8') : '[]');
      const idx = list.findIndex(s => s.delegate_id === delegate_id && s.judge_id === judge_id && s.criteria_id === criteria_id && s.session_id === sid);
      if (idx > -1) {
        list[idx] = { ...list[idx], score, updated_at: now };
      } else {
        list.push({ delegate_id, judge_id, criteria_id, score, updated_at: now, session_id: sid });
      }
      fs.writeFileSync(SCORES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    }

    // Always append to safety log
    appendToLog({ delegate_id, judge_id, criteria_id, score, session_id: sid });

    return { delegate_id, judge_id, criteria_id, score, session_id: sid, updated_at: now };
  },


  async getAllScores() {
    if (isPg) {
      const res = await pool.query('SELECT * FROM scores ORDER BY updated_at DESC');
      return res.rows;
    } else {
      return JSON.parse(fs.existsSync(SCORES_FILE) ? fs.readFileSync(SCORES_FILE, 'utf-8') : '[]');
    }
  },

  async setElectedRole(id, role) {
    if (isPg) {
      await pool.query('UPDATE registrations SET elected_role = $1 WHERE id = $2', [role, id]);
    } else {
      const list = readData();
      const idx = list.findIndex(r => r.id === id);
      if (idx > -1) {
        list[idx].elected_role = role;
        writeData(list);
      }
    }
    return true;
  },

  // ============ Awards ============
  async getAwards() {
    if (isPg) {
      const res = await pool.query('SELECT * FROM awards ORDER BY created_at ASC');
      if (res.rowCount === 0) {
        const defaults = [
          { id: 'awd_general', name: 'General Championship Award', criteria_ids: [], requires_role: '', requires_side: '' },
          { id: 'awd_speaker', name: 'Best Student Speaker', criteria_ids: [], requires_role: 'Speaker, Deputy Speaker, Secretary General, Marshal', requires_side: '' },
          { id: 'awd_debater', name: 'Exceptional Debater', criteria_ids: [], requires_role: '', requires_side: '' },
          { id: 'awd_ruling', name: 'Asset of the Ruling Government', criteria_ids: [], requires_role: 'Prime Minister, Deputy Prime Minister, Minister, Leader of the House', requires_side: 'ruling' },
          { id: 'awd_opposition', name: 'Asset of the Opposition', criteria_ids: [], requires_role: 'Leader of Opposition, Deputy Leader of Opposition, Whip', requires_side: 'opposition' },
          { id: 'awd_leader', name: 'Best Leader of the House', criteria_ids: [], requires_role: 'Prime Minister, Deputy Prime Minister, Leader of the House, Leader of Opposition', requires_side: '' },
          { id: 'awd_minister', name: 'Best Minister', criteria_ids: [], requires_role: 'Minister', requires_side: '' },
          { id: 'awd_creative', name: 'Most Creative Mind', criteria_ids: [], requires_role: '', requires_side: '' },
          { id: 'awd_orator', name: 'Best Orator', criteria_ids: [], requires_role: '', requires_side: '' },
          { id: 'awd_policy', name: 'Distinguished Policy Advocate', criteria_ids: [], requires_role: '', requires_side: '' },
          { id: 'awd_presence', name: 'Most Impactful Presence', criteria_ids: [], requires_role: '', requires_side: '' }
        ];
        for (const a of defaults) {
          await pool.query(
            `INSERT INTO awards (id, name, criteria_ids, requires_side, requires_role, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
            [a.id, a.name, JSON.stringify(a.criteria_ids), a.requires_side || null, a.requires_role, new Date().toISOString()]
          );
        }
        const seeded = await pool.query('SELECT * FROM awards ORDER BY created_at ASC');
        return seeded.rows.map(r => ({
          ...r,
          criteria_ids: typeof r.criteria_ids === 'string' ? JSON.parse(r.criteria_ids) : r.criteria_ids
        }));
      }
      return res.rows.map(r => ({
        ...r,
        criteria_ids: typeof r.criteria_ids === 'string' ? JSON.parse(r.criteria_ids) : r.criteria_ids
      }));
    } else {
      try {
        const data = fs.readFileSync(AWARDS_FILE, 'utf8');
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
  },

  async updateAward(id, data) {
    if (isPg) {
      await pool.query(`
        UPDATE awards 
        SET requires_role = $1, requires_side = $2, name = $3, criteria_ids = $4
        WHERE id = $5
      `, [data.requires_role, data.requires_side, data.name, JSON.stringify(data.criteria_ids), id]);
    } else {
      const list = JSON.parse(fs.readFileSync(AWARDS_FILE, 'utf8'));
      const idx = list.findIndex(a => a.id === id);
      if (idx > -1) {
        list[idx] = { ...list[idx], ...data };
        fs.writeFileSync(AWARDS_FILE, JSON.stringify(list, null, 2), 'utf8');
      }
    }
  },

  async createAward(data) {
    const id = data.id || ('awd_' + Math.random().toString(36).substr(2, 9));
    const { name, criteria_ids, requires_side, requires_role } = data;
    const now = new Date().toISOString();
    if (isPg) {
      await pool.query(`
        INSERT INTO awards (id, name, criteria_ids, requires_side, requires_role, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [id, name, JSON.stringify(criteria_ids), requires_side || null, requires_role || "", now]);
    } else {
      const list = JSON.parse(fs.existsSync(AWARDS_FILE) ? fs.readFileSync(AWARDS_FILE, 'utf-8') : '[]');
      const entry = { id, name, criteria_ids, requires_side: requires_side || null, requires_role: requires_role || "", created_at: now };
      list.push(entry);
      fs.writeFileSync(AWARDS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    }
    return { id, name, criteria_ids, requires_side: requires_side || null, requires_role: requires_role || "", created_at: now };
  },

  async deleteAward(id) {
    if (isPg) {
      const res = await pool.query('DELETE FROM awards WHERE id = $1', [id]);
      return res.rowCount > 0;
    } else {
      const list = JSON.parse(fs.existsSync(AWARDS_FILE) ? fs.readFileSync(AWARDS_FILE, 'utf-8') : '[]');
      const filtered = list.filter(a => a.id !== id);
      if (filtered.length === list.length) return false;
      fs.writeFileSync(AWARDS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
      return true;
    }
  },

  // ============ Sessions ============

  async getSessions() {
    if (isPg) {
      const res = await pool.query('SELECT * FROM sessions ORDER BY created_at ASC');
      return res.rows;
    } else {
      const raw = fs.existsSync(SESSIONS_FILE) ? fs.readFileSync(SESSIONS_FILE, 'utf-8') : '[]';
      return JSON.parse(raw);
    }
  },

  async createSession(data) {
    const id = data.id || ('session_' + Date.now().toString(36).toUpperCase());
    const { name } = data;
    const now = new Date().toISOString();
    const entry = { id, name, created_at: now };
    if (isPg) {
      await pool.query(
        'INSERT INTO sessions (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
        [id, name, now]
      );
    } else {
      const list = JSON.parse(fs.existsSync(SESSIONS_FILE) ? fs.readFileSync(SESSIONS_FILE, 'utf-8') : '[]');
      const existing = list.findIndex(s => s.id === id);
      if (existing > -1) {
        list[existing] = { ...list[existing], name };
      } else {
        list.push(entry);
      }
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    }
    return entry;
  },

  async deleteSession(id) {
    if (isPg) {
      const res = await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
      return (res.rowCount || 0) > 0;
    } else {
      const list = JSON.parse(fs.existsSync(SESSIONS_FILE) ? fs.readFileSync(SESSIONS_FILE, 'utf-8') : '[]');
      const filtered = list.filter(s => s.id !== id);
      if (filtered.length === list.length) return false;
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
      return true;
    }
  },

  // ============ Leadership ============

  async getLeadership() {
    if (isPg) {
      const res = await pool.query('SELECT * FROM leadership');
      const data = { ministers: {} };
      res.rows.forEach(r => {
        if (r.role.startsWith('minister_')) data.ministers[r.role] = r.delegate_id;
        else data[r.role] = r.delegate_id;
      });
      return data;
    } else {
      const raw = fs.existsSync(LEADERSHIP_FILE) ? fs.readFileSync(LEADERSHIP_FILE, 'utf-8') : '{}';
      return JSON.parse(raw);
    }
  },

  async setLeadership(data) {
    const { pm, dpm, lop, dep_lop, ministers } = data;
    if (isPg) {
      await pool.query('DELETE FROM leadership');
      const inserts = [];
      if (pm) inserts.push(pool.query('INSERT INTO leadership (role, delegate_id) VALUES ($1,$2)', ['pm', pm]));
      if (dpm) inserts.push(pool.query('INSERT INTO leadership (role, delegate_id) VALUES ($1,$2)', ['dpm', dpm]));
      if (lop) inserts.push(pool.query('INSERT INTO leadership (role, delegate_id) VALUES ($1,$2)', ['lop', lop]));
      if (dep_lop) inserts.push(pool.query('INSERT INTO leadership (role, delegate_id) VALUES ($1,$2)', ['dep_lop', dep_lop]));
      if (ministers) {
        for (const [key, val] of Object.entries(ministers)) {
          if (val) inserts.push(pool.query('INSERT INTO leadership (role, delegate_id) VALUES ($1,$2)', [`minister_${key}`, val]));
        }
      }
      await Promise.all(inserts);
    } else {
      const entry = { pm: pm || '', dpm: dpm || '', lop: lop || '', dep_lop: dep_lop || '', ministers: ministers || {} };
      fs.writeFileSync(LEADERSHIP_FILE, JSON.stringify(entry, null, 2), 'utf-8');
    }
    return { success: true };
  },

  // ============ Coalition Lock ============

  async getCoalitionLock() {
    try {
      const raw = fs.readFileSync(COALITION_LOCK_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { locked: false };
    }
  },

  async setCoalitionLock(locked) {
    fs.writeFileSync(COALITION_LOCK_FILE, JSON.stringify({ locked }), 'utf-8');
    return { locked };
  },

  async resetCoalition() {
    if (isPg) {
      await pool.query("UPDATE parties SET side = NULL WHERE type = 'party'");
    } else {
      const list = JSON.parse(fs.existsSync(PARTIES_FILE) ? fs.readFileSync(PARTIES_FILE, 'utf-8') : '[]');
      list.forEach(p => { if (p.type === 'party') p.side = null; });
      fs.writeFileSync(PARTIES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    }
    fs.writeFileSync(COALITION_LOCK_FILE, JSON.stringify({ locked: false }), 'utf-8');
    return { success: true };
  }
};


