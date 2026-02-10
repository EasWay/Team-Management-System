import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_URL || './dev.db';

try {
  console.log(`[Init] Creating database at: ${dbPath}`);
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  
  // Run migrations
  const migrationsFolder = path.join(__dirname, 'drizzle');
  console.log(`[Init] Running migrations from: ${migrationsFolder}`);
  migrate(db, { migrationsFolder });
  
  console.log('[Init] ✅ Database initialized successfully');
  sqlite.close();
  process.exit(0);
} catch (error) {
  console.error('[Init] ❌ Failed to initialize database:', error);
  process.exit(1);
}
