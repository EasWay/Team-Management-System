# PostgreSQL Migration Guide

## What I've Changed

✅ Updated `.env` with PostgreSQL connection string
✅ Updated `drizzle.config.ts` to use PostgreSQL dialect
✅ Updated `server/db.ts` to use `pg` driver instead of `better-sqlite3`
✅ Fixed transaction handling for PostgreSQL

## Your PostgreSQL Credentials

- **Host**: localhost
- **Port**: 5432
- **Database**: team-manager_db
- **Username**: postgres
- **Password**: Essel@12345

## Next Steps

### Step 1: Install PostgreSQL Driver

Run this command in your terminal:

```bash
npm install pg @types/node
```

### Step 2: Create the Database

Make sure PostgreSQL is running, then create the database. You can do this in DBeaver or using psql:

**Option A: Using DBeaver**
1. Open DBeaver
2. Connect to your PostgreSQL server (localhost:5432)
3. Right-click on "Databases"
4. Select "Create New Database"
5. Name it: `team-manager_db`
6. Click "OK"

**Option B: Using psql command line**
```bash
psql -U postgres
CREATE DATABASE team_manager_db;
\q
```

### Step 3: Generate and Run Migrations

```bash
# Generate migration files from your schema
npm run db:push
```

This will:
1. Read your Drizzle schema from `drizzle/schema.ts`
2. Generate SQL migration files
3. Apply them to your PostgreSQL database

### Step 4: Restart the Server

```bash
# Stop the current server (Ctrl+C)
# Then start it again:
npm run dev
```

### Step 5: Test the Connection

When the server starts, you should see:
```
[Database] Connected to PostgreSQL successfully
```

Then try logging in at http://localhost:3000

## Verification in DBeaver

After running migrations, you should see these tables in DBeaver:

- users
- teams
- team_members
- team_invitations
- tasks
- documents
- repositories
- activities
- departments
- department_assignments
- oauth_tokens
- audit_logs

## Connection String Format

The connection string in your `.env` file:
```
postgresql://username:password@host:port/database
```

Your actual connection:
```
postgresql://postgres:Essel@12345@localhost:5432/team-manager_db
```

## Troubleshooting

### Error: "database does not exist"
- Create the database in DBeaver or using psql
- Make sure the database name matches: `team-manager_db`

### Error: "password authentication failed"
- Verify your PostgreSQL password is correct
- Check if PostgreSQL is running

### Error: "connection refused"
- Make sure PostgreSQL is running on port 5432
- Check if the port is correct in your connection string

### Error: "pg module not found"
- Run: `npm install pg @types/node`
- Restart the server

## Benefits of PostgreSQL

✅ Better performance for production
✅ Supports concurrent connections
✅ Better data integrity with ACID compliance
✅ Can monitor with DBeaver
✅ Easier to scale
✅ Better for team collaboration

## Rollback to SQLite (if needed)

If you want to go back to SQLite:

1. Change `.env`:
   ```env
   DATABASE_URL=file:./local.db
   ```

2. Change `drizzle.config.ts` dialect to `"sqlite"`

3. Revert `server/db.ts` to use `better-sqlite3`

4. Run: `npm run db:push`
