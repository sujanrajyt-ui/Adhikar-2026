const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function sync() {
    const AWARDS_FILE = path.join(__dirname, 'api', 'awards.json');
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.log("No DATABASE_URL found. Skipping PG sync (Local JSON mode).");
        return;
    }

    console.log("Syncing awards from JSON to PG...");
    const awards = JSON.parse(fs.readFileSync(AWARDS_FILE, 'utf8'));
    const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

    try {
        for (const a of awards) {
            console.log(`Syncing award: ${a.name}...`);
            await pool.query(`
                INSERT INTO awards (id, name, criteria_ids, requires_side, requires_role, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    criteria_ids = EXCLUDED.criteria_ids,
                    requires_side = EXCLUDED.requires_side,
                    requires_role = EXCLUDED.requires_role
            `, [
                a.id,
                a.name,
                JSON.stringify(a.criteria_ids),
                a.requires_side || null,
                a.requires_role || null,
                a.created_at || new Date().toISOString()
            ]);
        }
        console.log("Sync Complete!");
    } catch (err) {
        console.error("Sync Failed:", err);
    } finally {
        await pool.end();
    }
}

sync();
