// Test PostgreSQL connection
import pkg from 'pg';
const { Pool } = pkg;

async function testConnection() {
  console.log('=== PostgreSQL Connection Test ===\n');
  console.log('Testing connection with individual parameters...');
  
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'Essel@12345',
  });
  
  try {
    const client = await pool.connect();
    console.log('✅ Connection successful!');
    
    const result = await client.query('SELECT version()');
    console.log('PostgreSQL version:', result.rows[0].version);
    
    // Check if team-manager_db exists
    const dbCheck = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'team-manager_db'"
    );
    
    if (dbCheck.rows.length > 0) {
      console.log('✅ Database "team-manager_db" exists');
    } else {
      console.log('❌ Database "team-manager_db" does NOT exist');
      console.log('   You need to create it in DBeaver!');
    }
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Connection test passed!');
    console.log('Your password is correct: Essel@12345');
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('\nPossible issues:');
    console.log('1. PostgreSQL is not running');
    console.log('2. Password is incorrect');
    console.log('3. User "postgres" does not exist');
    console.log('4. PostgreSQL is not listening on localhost:5432');
    await pool.end();
  }
  
  console.log('\n=== Test Complete ===');
}

testConnection().catch(console.error);
