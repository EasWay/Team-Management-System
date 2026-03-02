# Remove PostgreSQL 13

## Step 1: Stop PostgreSQL 13 Service

Open Command Prompt **as Administrator**:
```cmd
net stop postgresql-x64-13
```

## Step 2: Disable PostgreSQL 13 Service

```cmd
sc config postgresql-x64-13 start= disabled
```

## Step 3: Uninstall PostgreSQL 13

### Option A: Using Control Panel
1. Press `Win + R`, type `appwiz.cpl`, press Enter
2. Find "PostgreSQL 13" in the list
3. Right-click → "Uninstall"
4. Follow the uninstall wizard

### Option B: Using Settings
1. Press `Win + I` to open Settings
2. Go to "Apps"
3. Search for "PostgreSQL 13"
4. Click on it → "Uninstall"

## Step 4: Clean Up Remaining Files (Optional)

After uninstalling, you can delete the leftover folder:
```
C:\Program Files\PostgreSQL\13
```

## Step 5: Restart PostgreSQL 18

```cmd
net stop postgresql-x64-18
net start postgresql-x64-18
```

## Step 6: Verify Only PostgreSQL 18 is Running

```cmd
sc query | findstr postgresql
```

You should only see `postgresql-x64-18` now.

## Step 7: Test Connection

```cmd
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432
```

---

## Alternative: Just Stop PostgreSQL 13 (Faster)

If you don't want to uninstall, just stop and disable it:

```cmd
net stop postgresql-x64-13
sc config postgresql-x64-13 start= disabled
```

This will keep PostgreSQL 13 installed but not running.

---

## After Removing PostgreSQL 13

1. **Edit PostgreSQL 18's pg_hba.conf** (if you haven't already):
   - File: `C:\Program Files\PostgreSQL\18\data\pg_hba.conf`
   - Change `md5` to `trust` for local connections
   - Save and restart PostgreSQL 18

2. **Connect and reset password**:
   ```cmd
   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432
   ```
   
3. **Reset password**:
   ```sql
   ALTER USER postgres WITH PASSWORD 'Essel@12345';
   \q
   ```

4. **Change pg_hba.conf back to `md5`** and restart

Let me know which approach you want to take!