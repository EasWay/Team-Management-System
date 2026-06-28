import { config } from 'dotenv';
config();
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const tables = [
    'file_folders',
    'calendar_events',
    'video_calls',
    'resource_permissions',
    'office_access_control',
    'ip_whitelist',
    'permission_roles',
    'user_role_assignments',
    'google_drive_connections'
  ];
  
  try {
    for (const table of tables) {
      const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]);
      console.log(`Table ${table} columns:`, res.rows.map(r => r.column_name).join(', '));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
