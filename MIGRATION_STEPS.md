# 🔄 Database Migration Steps - Add Office Role

## Current Status
✅ Schema updated in `drizzle/schema.ts` (added `officeRole` column)
✅ Migration file generated: `drizzle/0011_slimy_phalanx.sql`
✅ Frontend components created (OfficeRoleDropdown)
✅ Backend API created (updateOfficeRole mutation)
❌ Migration NOT yet applied to database

---

## What We Need to Do

We need to apply the migration to add the `office_role` column to your database **without losing any existing data**.

---

## Step 1: Check Your Database Connection

### Option A: You're using a LOCAL PostgreSQL database

1. **Check if PostgreSQL is running:**
   ```bash
   # Open Command Prompt or PowerShell
   psql --version
   ```

2. **Find your database connection details:**
   - Host: `localhost`
   - Port: Usually `5432` or `5433`
   - Database name: `team_manager_db`
   - Username: Usually `postgres`
   - Password: Your PostgreSQL password

3. **Create a `.env` file** in `team-manager` folder:
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/team_manager_db
   ```

### Option B: You're using a CLOUD database (Neon, Supabase, etc.)

1. **Get your connection string** from your cloud provider
2. **Create a `.env` file** in `team-manager` folder:
   ```env
   DATABASE_URL=postgresql://user:password@host.region.provider.com/database?sslmode=require
   ```

---

## Step 2: Apply the Migration

Once you have the `.env` file set up:

```bash
cd team-manager
pnpm drizzle-kit migrate
```

This will:
- Connect to your database
- Add the `office_role` column to `team_members_collaborative` table
- **Keep all existing data intact** (the column is nullable)

---

## Step 3: Verify the Migration

After the migration runs successfully, verify it worked:

```bash
# Connect to your database
psql -U postgres -d team_manager_db

# Check the table structure
\d team_members_collaborative

# You should see the new column:
# office_role | text |
```

---

## Step 4: Start the Application

```bash
cd team-manager
pnpm dev
```

The app will now have the office assignment feature!

---

## Alternative: Manual SQL Migration

If the automatic migration doesn't work, you can run the SQL manually:

1. **Connect to your database** using pgAdmin, DBeaver, or psql
2. **Run this SQL:**

```sql
-- Add office_role column (safe - won't lose data)
ALTER TABLE team_members_collaborative 
ADD COLUMN IF NOT EXISTS office_role TEXT;

-- Add check constraint for valid values
ALTER TABLE team_members_collaborative
ADD CONSTRAINT chk_office_role_valid 
CHECK (
  office_role IS NULL OR 
  office_role IN (
    'project_manager',
    'lead_researcher', 
    'systems_architect',
    'backend_engineer',
    'fullstack_engineer',
    'ai_engineer',
    'qa_tester',
    'designer'
  )
);
```

3. **Verify it worked:**
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'team_members_collaborative' 
AND column_name = 'office_role';
```

---

## Troubleshooting

### Error: "ECONNREFUSED"
- PostgreSQL is not running
- Check connection details in `.env`
- Try: `pg_ctl start` or start PostgreSQL service

### Error: "password authentication failed"
- Wrong password in `.env`
- Reset PostgreSQL password if needed

### Error: "database does not exist"
- Create the database first:
  ```sql
  CREATE DATABASE team_manager_db;
  ```

### Error: "column already exists"
- Migration already ran successfully!
- Just start the app: `pnpm dev`

---

## What Happens After Migration?

1. **No data is lost** - existing team members remain unchanged
2. **New column is NULL** - you'll assign offices through the UI
3. **UI is ready** - go to Team Members page to assign offices
4. **Workflow works** - folders will route based on office assignments

---

## Next Steps After Migration

1. ✅ Start the app: `pnpm dev`
2. ✅ Log in as admin
3. ✅ Go to your team's "Team Members" page
4. ✅ Click "Assign Office" dropdown for each member
5. ✅ Select their office role (e.g., Office #202 - Backend Engineer)
6. ✅ Test the workflow in "My Office" page

---

## Need Help?

**Tell me:**
1. Are you using a local PostgreSQL or cloud database?
2. Do you have a `.env` file? What's in it? (hide passwords)
3. Is PostgreSQL running?
4. What error do you see when running `pnpm drizzle-kit migrate`?

I'll help you get it working! 🚀
