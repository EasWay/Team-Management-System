# PostgreSQL Connection Troubleshooting

## Current Situation

The password `Essel@12345` is failing authentication, even though you say it's correct. This means there's likely a PostgreSQL configuration issue.

## Step-by-Step Diagnosis

### Step 1: Verify PostgreSQL is Running

Open Command Prompt and run:
```cmd
sc query postgresql-x64-16
```
(Replace `16` with your PostgreSQL version number)

You should see `STATE: 4 RUNNING`

If not running, start it:
```cmd
net start postgresql-x64-16
```

### Step 2: Test Connection in DBeaver

1. Open DBeaver
2. Try to connect to your PostgreSQL database
3. **Does it work?**
   - ✅ YES → The password works in DBeaver but not in Node.js (see Step 3)
   - ❌ NO → The password is actually wrong (see Step 4)

### Step 3: If DBeaver Works But Node.js Doesn't

This means PostgreSQL authentication method might be different for different connection types.

**Check pg_hba.conf:**

1. Find your PostgreSQL data directory (usually `C:\Program Files\PostgreSQL\16\data`)
2. Open `pg_hba.conf` in Notepad (as Administrator)
3. Look for lines like:
   ```
   # IPv4 local connections:
   host    all             all             127.0.0.1/32            scram-sha-256
   ```

4. Change `scram-sha-256` to `md5`:
   ```
   host    all             all             127.0.0.1/32            md5
   ```

5. Save the file
6. Restart PostgreSQL:
   ```cmd
   net stop postgresql-x64-16
   net start postgresql-x64-16
   ```

### Step 4: If DBeaver Also Doesn't Work

The password is incorrect. Reset it:

1. **Edit pg_hba.conf** (as Administrator):
   - Change authentication method to `trust`:
     ```
     host    all             all             127.0.0.1/32            trust
     ```
   - Save and restart PostgreSQL

2. **Connect without password**:
   ```cmd
   psql -U postgres -d postgres
   ```

3. **Reset the password**:
   ```sql
   ALTER USER postgres WITH PASSWORD 'Essel@12345';
   ```

4. **Revert pg_hba.conf** back to `md5` or `scram-sha-256`

5. **Restart PostgreSQL**

### Step 5: Alternative - Use a Simpler Password

If special characters are causing issues, change to a simpler password:

```sql
ALTER USER postgres WITH PASSWORD 'postgres123';
```

Then I'll update the app to use `postgres123` instead.

## Quick Fix: Use SQLite Instead

If PostgreSQL is too problematic right now, we can switch back to SQLite temporarily:

1. Change `.env`:
   ```env
   DATABASE_URL=file:./local.db
   ```

2. Change `drizzle.config.ts` dialect to `"sqlite"`

3. Revert `server/db.ts` to use `better-sqlite3`

4. Run: `npm run db:push`

Your app will work immediately with SQLite, and you can fix PostgreSQL later.

## What Should We Do?

Choose one:

**Option A**: Fix PostgreSQL authentication (follow steps above)

**Option B**: Use a simpler PostgreSQL password (no special characters)

**Option C**: Switch back to SQLite for now (fastest solution)

Let me know which option you prefer!
