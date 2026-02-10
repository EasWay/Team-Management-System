import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dbPath = process.env.DATABASE_URL || './dev.db';
console.log(`Creating database at: ${dbPath}`);

const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

console.log('Running migrations...');
migrate(db, { migrationsFolder: './drizzle' });

console.log('✅ Database created and migrations applied successfully!');
sqlite.close();
