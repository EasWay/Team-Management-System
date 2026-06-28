import { config } from 'dotenv';
config();
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await pool.query('UPDATE non_existent_table SET a = 1');
  } catch (err) {
    console.error("Error updating non-existent table:", err.message);
  }
  
  try {
    await pool.query('UPDATE users SET non_existent_column = 1');
  } catch (err) {
    console.error("Error updating non-existent column:", err.message);
  }
  
  await pool.end();
}
main();
