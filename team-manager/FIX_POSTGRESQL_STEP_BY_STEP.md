# Fix PostgreSQL Authentication - Step by Step

## Step 1: Find Your PostgreSQL Installation

Open File Explorer and navigate to:
```
C:\Program Files\PostgreSQL
```

You should see a folder with a version number (like `16`, `15`, `14`, etc.)

**What version do you see?** (Remember this number)

## Step 2: Find the Data Directory

Navigate to:
```
C:\Program Files\PostgreSQL\[YOUR_VERSION]\data
```

For example: `C:\Program Files\PostgreSQL\16\data`

You should see a file called `pg_hba.conf`

## Step 3: Edit pg_hba.conf

1. **Right-click on `pg_hba.conf`**
2. **Select "Open with" → "Notepad"**
3. **If it says "Access Denied":**
   - Right-click on Notepad in Start Menu
   - Select "Run as administrator"
   - Then File → Open → Navigate to `pg_hba.conf`

## Step 4: Find and Change the Authentication Method

In the file, look for a section that says:
```
# IPv4 local connections:
host    all             all             127.0.0.1/32            scram-sha-256
```

**Change `scram-sha-256` to `md5`:**
```
# IPv4 local connections:
host    all             all             127.0.0.1/32            md5
```

**Also check for this line:**
```
host    all             all             ::1/128                 scram-sha-256
```

**Change it to:**
```
host    all             all             ::1/128                 md5
```

**Save the file** (Ctrl+S)

## Step 5: Restart PostgreSQL Service

Open Command Prompt **as Administrator**:

1. Press `Win + X`
2. Select "Command Prompt (Admin)" or "Windows PowerShell (Admin)"

Run these commands (replace `16` with your PostgreSQL version):

```cmd
net stop postgresql-x64-16
net start postgresql-x64-16
```

You should see:
```
The postgresql-x64-16 service was stopped successfully.
The postgresql-x64-16 service was started successfully.
```

## Step 6: Test the Connection

In your project terminal, run:
```bash
node test-pg-connection.js
```

You should now see:
```
✅ Connection successful!
```

## Step 7: Create the Database (if needed)

If the test says the database doesn't exist:

1. Open DBeaver
2. Connect to PostgreSQL (localhost:5432, user: postgres, password: Essel@12345)
3. Right-click "Databases"
4. Select "Create New Database"
5. Name: `team-manager_db`
6. Click OK

## Step 8: Run Migrations

```bash
npm run db:push
```

## Step 9: Restart Your App

```bash
npm run dev
```

## Step 10: Test Login

Go to http://localhost:3000 and sign in with GitHub!

---

## Troubleshooting

### "Access Denied" when editing pg_hba.conf
→ Open Notepad as Administrator first, then open the file

### "Service name invalid"
→ Check the exact service name:
```cmd
sc query | findstr postgresql
```
Use the exact name shown

### Still getting password errors
→ Try changing the password to something simpler:
```cmd
psql -U postgres
ALTER USER postgres WITH PASSWORD 'postgres123';
```
Then tell me and I'll update the config

### Can't find PostgreSQL folder
→ Try these locations:
- `C:\Program Files\PostgreSQL\`
- `C:\PostgreSQL\`
- `C:\Program Files (x86)\PostgreSQL\`

---

## What to Do Now

1. Follow steps 1-5 to edit pg_hba.conf and restart PostgreSQL
2. Run `node test-pg-connection.js` to verify
3. Let me know if it works or if you get any errors!
