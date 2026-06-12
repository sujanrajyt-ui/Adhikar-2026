// Run: node api/migrate_parties.js
// Normalizes all delegate assigned_party values and cleans up duplicate party entries
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const PARTIES_FILE = path.join(__dirname, 'parties.json');

const PARTY_NAME_MAP = {
  'A': 'Rashtriya Yuva Pragati Manch (A)',
  'B': 'Yuva Drishti Party (B)',
  'C': 'New Gen Leaders (C)',
  'D': 'Catalyst Party (D)',
  'E': 'Navpeedhi Bharat Party (E)',
  'Party A': 'Rashtriya Yuva Pragati Manch (A)',
  'Party B': 'Yuva Drishti Party (B)',
  'Party C': 'New Gen Leaders (C)',
  'Party D': 'Catalyst Party (D)',
  'Party E': 'Navpeedhi Bharat Party (E)',
  'Next Gen Leaders (C)': 'New Gen Leaders (C)',
};

const SHORT_IDS = new Set(['party_a', 'party_b', 'party_c', 'party_d', 'party_e']);
const SHORT_NAMES = new Set(['Party A', 'Party B', 'Party C', 'Party D', 'Party E', 'A', 'B', 'C', 'D', 'E', 'Next Gen Leaders (C)']);

// --- Fix parties.json ---
if (fs.existsSync(PARTIES_FILE)) {
  let parties = JSON.parse(fs.readFileSync(PARTIES_FILE, 'utf-8'));
  const before = parties.length;

  // Map party names to full names
  parties.forEach(p => {
    const mapped = PARTY_NAME_MAP[p.name];
    if (mapped) p.name = mapped;
  });

  // Remove duplicates (keep the entry that has proper name matching a known full name)
  const seen = new Set();
  parties = parties.filter(p => {
    if (p.type !== 'party') return true;
    const full = PARTY_NAME_MAP[p.name] || p.name;
    if (seen.has(full)) return false;
    seen.add(full);
    return true;
  });

  // Also remove any short-name parties that weren't caught (e.g. if duplicates removed the wrong one)
  // Keep only parties whose names match the canonical full names
  const fullNames = new Set(Object.values(PARTY_NAME_MAP));
  const filtered = parties.filter(p => p.type !== 'party' || fullNames.has(p.name));

  if (filtered.length !== before) {
    fs.writeFileSync(PARTIES_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    console.log(`Parties: ${before} → ${filtered.length} (removed ${before - filtered.length} duplicates)`);
  } else {
    console.log('Parties: no changes needed');
  }
}

// --- Fix data.json (delegate assigned_party) ---
if (fs.existsSync(DATA_FILE)) {
  let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  let changed = 0;

  data.forEach(r => {
    if (r.assigned_party && PARTY_NAME_MAP[r.assigned_party]) {
      const mapped = PARTY_NAME_MAP[r.assigned_party];
      if (mapped !== r.assigned_party) {
        console.log(`  Delegate "${r.name}": "${r.assigned_party}" → "${mapped}"`);
        r.assigned_party = mapped;
        changed++;
      }
    }
  });

  if (changed > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Delegates: ${changed} updated`);
  } else {
    console.log('Delegates: no changes needed');
  }
}

console.log('Done. Restart the server and refresh.');
