# Reset PostgreSQL Password

Since the password authentication is failing, let's reset it properly.

## Method 1: Reset via pg_hba.conf (Recommended)

### Step 1: Edit pg_hba.conf for Version 18

1. **Open Notepad as Administrator**
   - Right-click Start Menu → Search "Notepad"
   - Right-click Notepad → "Run as administrator"

2. **Open pg_hba.conf**
   - File → Open
   - Navigate to: `C:\Program Files\PostgreSQL\18\data\pg_hba.conf`

3. **Find this line:**
   ```
   host    all             all             127.0.0.1/32            md5
   ```

4. **Change `md5` to `trust`:**
   ```
   host    all             all             127.0.0.1/32            trust
   ```

5. **Also change this line if it exists:**
   ```
   host    all             all             ::1/128                 md5
   ```
   **To:**
   ```
   host    all             all             ::1/128                 trust
   ```

6. **Save the file** (Ctrl+S)

### Step 2: Restart PostgreSQL 18

Open Command Prompt **as Administrator**:
```cmd
net stop postgresql-x64-18
net start postgresql-x64-18
```

### Step 3: Connect Without Password and Reset

Open Command Prompt (regular, not admin) and run:
```cmd
psql -U postgres -h localhost -p 5432
```

This should connect without asking for a password.

### Step 4: Reset the Password

In the psql prompt, run:
```sql
ALTER USER postgres WITH PASSWORD 'Essel@12345';
\q
```

### Step 5: Revert pg_hba.conf Back to md5

1. **Open pg_hba.conf again as Administrator**
2. **Change `trust` back to `md5`:**
   ```
   host    all             all             127.0.0.1/32            md5
   host    all             all             ::1/128                 md5
   ```
3. **Save the file**

### Step 6: Restart PostgreSQL Again

```cmd
net stop postgresql-x64-18
net start postgresql-x64-18
```

### Step 7: Test the Connection

```bash
node test-pg-connection.js
```

---

## Method 2: Use DBeaver to Find the Correct Password

1. **Open DBeaver**
2. **Try to connect to PostgreSQL**:
   - Host: localhost
   - Port: 5432
   - Database: postgres
   - Username: postgres
   - Password: (try different passwords)

3. **Try these passwords:**
   - `Essel@12345`
   - `postgres`
   - `admin`
   - `password`
   - (empty password)

4. **If one works in DBeaver, tell me which one!**

---

## Method 3: Check if Version 13 is the Active One

Maybe version 13 is responding on port 5432, not version 18.

**Try editing version 13's pg_hba.conf:**
`C:\Program Files\PostgreSQL\13\data\pg_hba.conf`

Follow the same steps but for version 13.

---

## What Should We Do?

**Option A**: Follow Method 1 (reset password via trust authentication)
**Option B**: Try Method 2 (find correct password in DBeaver)
**Option C**: Switch to SQLite (fastest solution)

Which would you prefer to try first?