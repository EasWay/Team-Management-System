import { config } from 'dotenv';
config();
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const res = await pool.query('UPDATE users SET role = $1 RETURNING id, email, name, role', ['admin']);
    console.log(`Updated ${res.rowCount} users to admin.`);
    for (const row of res.rows) {
      console.log(`- ID: ${row.id}, Name: ${row.name}, Email: ${row.email}, Role: '${row.role}'`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
