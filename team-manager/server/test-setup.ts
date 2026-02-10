import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

// Initialize test database
export function setupTestDatabase() {
  const dbPath = process.env.DATABASE_URL || './dev.db';
  
  try {
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite);
    
    // Run migrations
    const migrationsFolder = path.join(process.cwd(), 'drizzle');
    migrate(db, { migrationsFolder });
    
    console.log('[Test Setup] Database initialized successfully');
    sqlite.close();
  } catch (error) {
    console.error('[Test Setup] Failed to initialize database:', error);
    throw error;
  }
}

// Run setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestDatabase();
}
