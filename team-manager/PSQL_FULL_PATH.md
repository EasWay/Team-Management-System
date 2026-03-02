# Use Full Path to psql

Since `psql` is not in your PATH, use the full path:

## For PostgreSQL 18:
```cmd
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432
```

## For PostgreSQL 13:
```cmd
"C:\Program Files\PostgreSQL\13\bin\psql.exe" -U postgres -h localhost -p 5432
```

## Alternative: Use DBeaver Instead

Since psql is not working, let's use DBeaver to reset the password:

### Step 1: Test Connection in DBeaver

1. **Open DBeaver**
2. **Create New Connection**:
   - Database: PostgreSQL
   - Host: localhost
   - Port: 5432
   - Database: postgres
   - Username: postgres
   - Password: (try these one by one)
     - `Essel@12345`
     - `postgres`
     - `admin`
     - `password`
     - (leave empty)

3. **Click "Test Connection"** for each password

### Step 2: If One Works

Tell me which password works in DBeaver, and I'll update the app configuration.

### Step 3: If None Work

We'll need to reset via pg_hba.conf trust method, but use DBeaver instead of psql.

---

## Quick Alternative: Switch to SQLite

If PostgreSQL is too complicated, I can switch you to SQLite in 2 minutes:

1. I'll update the config files
2. You run `npm run db:push`
3. Your app works immediately

**What would you prefer?**
- A) Try the full psql path above
- B) Test passwords in DBeaver
- C) Switch to SQLite (fastest)