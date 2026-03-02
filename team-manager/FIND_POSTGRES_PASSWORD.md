# PostgreSQL Password Issue

## The Problem

The password `Essel@12345` is not working with your PostgreSQL database. Both the plain and URL-encoded versions are failing authentication.

## How to Find Your Correct PostgreSQL Password

### Option 1: Check DBeaver Connection

1. Open DBeaver
2. Find your PostgreSQL connection in the left panel
3. Right-click on it → "Edit Connection"
4. Look at the password field (it might be hidden with dots)
5. Click "Show password" or copy it

### Option 2: Reset PostgreSQL Password

If you don't remember the password, you can reset it:

#### On Windows:

1. **Open Command Prompt as Administrator**

2. **Connect to PostgreSQL**:
   ```cmd
   psql -U postgres
   ```
   (If this asks for a password and you don't know it, continue to step 3)

3. **If you can't connect, edit pg_hba.conf**:
   - Find PostgreSQL installation folder (usually `C:\Program Files\PostgreSQL\<version>\data`)
   - Open `pg_hba.conf` in Notepad as Administrator
   - Find the line that says:
     ```
     host    all             all             127.0.0.1/32            scram-sha-256
     ```
   - Change `scram-sha-256` to `trust`:
     ```
     host    all             all             127.0.0.1/32            trust
     ```
   - Save the file
   - Restart PostgreSQL service:
     ```cmd
     net stop postgresql-x64-<version>
     net start postgresql-x64-<version>
     ```

4. **Now connect without password**:
   ```cmd
   psql -U postgres
   ```

5. **Reset the password**:
   ```sql
   ALTER USER postgres WITH PASSWORD 'YourNewPassword';
   ```

6. **Revert pg_hba.conf back to `scram-sha-256`** and restart PostgreSQL

### Option 3: Use DBeaver to Test Connection

1. Open DBeaver
2. Click "Database" → "New Database Connection"
3. Select PostgreSQL
4. Enter:
   - Host: localhost
   - Port: 5432
   - Database: postgres
   - Username: postgres
   - Password: (try different passwords)
5. Click "Test Connection"
6. Keep trying until you find the right password

## Common Default Passwords

Try these common PostgreSQL passwords:
- `postgres`
- `admin`
- `password`
- `root`
- (empty password)
- `Essel@12345`
- `Essel12345`

## Once You Find the Correct Password

Tell me the password and I'll update the connection string properly!

If the password has special characters, I'll URL-encode them correctly:
- `@` becomes `%40`
- `#` becomes `%23`
- `$` becomes `%24`
- `&` becomes `%26`
- etc.

## Quick Test

You can also test the connection in DBeaver:
1. Open DBeaver
2. Try to connect to your PostgreSQL
3. If it works, that's your correct password!
4. Tell me what it is and I'll fix the connection string
