import pg from 'pg';
import { ENV } from './server/_core/env';

const pool = new pg.Pool({ connectionString: ENV.DATABASE_URL });

async function check() {
  const res = await pool.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      rc.delete_rule AS on_delete
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'team_members';
  `);
  console.table(res.rows);
  pool.end();
}
check();
