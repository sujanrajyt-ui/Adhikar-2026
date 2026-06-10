// Migrate old party names (Party A, Party B, etc.) to new MUN-style names
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const MAP = {
  'Party A': 'Rashtriya Yuva Pragati Manch (A)',
  'Party B': 'Yuva Drishti Party (B)',
  'Party C': 'Next Gen Leaders (C)',
  'Party D': 'Catalyst Party (D)',
  'Party E': 'Navpeedhi Bharat Party (E)',
};

const COMM_MAP = {
  'Committee A': 'EDUCATION',
  'Committee B': 'FINANCE',
  'Committee C': 'HOME AFFAIRS',
  'Committee D': 'HEALTH',
  'Committee E': 'JUSTICE',
};

async function migrate() {
  if (!process.env.DATABASE_URL) {
    // JSON file mode
    const db = require('./db');
    const all = await db.getAll();
    let changed = 0;
    for (const r of all) {
      const updates = {};
      if (MAP[r.assigned_party]) { updates.assigned_party = MAP[r.assigned_party]; }
      if (COMM_MAP[r.assigned_committee]) { updates.assigned_committee = COMM_MAP[r.assigned_committee]; }
      if (Object.keys(updates).length) {
        await db.update(r.id, updates);
        changed++;
      }
    }
    console.log(`Updated ${changed} delegates in JSON file`);
    return;
  }

  // PostgreSQL mode
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query('SELECT id, assigned_party, assigned_committee FROM registrations');
    let changed = 0;
    for (const row of res.rows) {
      const updates = [];
      const vals = [row.id];
      let idx = 2;
      if (MAP[row.assigned_party]) {
        updates.push(`"assigned_party" = $${idx++}`);
        vals.push(MAP[row.assigned_party]);
      }
      if (COMM_MAP[row.assigned_committee]) {
        updates.push(`"assigned_committee" = $${idx++}`);
        vals.push(COMM_MAP[row.assigned_committee]);
      }
      if (updates.length) {
        updates.push(`"updated_at" = NOW()`);
        const q = `UPDATE registrations SET ${updates.join(', ')} WHERE id = $1`;
        await pool.query(q, vals);
        changed++;
      }
    }
    console.log(`Updated ${changed} delegates in PostgreSQL`);
  } finally {
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
