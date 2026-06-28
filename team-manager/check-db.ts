import pg from "pg";
const { Pool } = pg;
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
});

async function check() {
  try {
    const res = await pool.query(`SELECT id, email, name, role FROM users;`);
    for (const r of res.rows) {
      console.log(`- ${r.email} | ${r.name} | ${r.role}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
