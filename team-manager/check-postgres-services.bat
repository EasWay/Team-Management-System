@echo off
echo === Checking PostgreSQL Services ===
echo.

echo Checking for PostgreSQL services...
sc query | findstr /i postgresql

echo.
echo === Checking which ports are listening ===
netstat -an | findstr :5432

echo.
echo === Checking PostgreSQL processes ===
tasklist | findstr /i postgres

echo.
echo Press any key to continue...
pause