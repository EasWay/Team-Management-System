const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const users = await client.query('SELECT * FROM users ORDER BY id');
  console.log('USERS:', users.rows.length);
  users.rows.forEach(u => console.log(`  - ${u.id}: ${u.email} (${u.name}) - ${u.created_at}`));

  const teams = await client.query('SELECT * FROM teams ORDER BY id');
  console.log('\nTEAMS:', teams.rows.length);
  teams.rows.forEach(t => console.log(`  - ${t.id}: ${t.name} (createdBy: ${t.created_by})`));

  const teamMembers = await client.query('SELECT * FROM team_members ORDER BY id');
  console.log('\nTEAM MEMBERS:', teamMembers.rows.length);
  teamMembers.rows.forEach(u => console.log(`  - ${u.id}: ${u.email} (${u.name})`));

  const teamMemCols = await client.query('SELECT * FROM team_members_collaborative');
  console.log('\nTEAM MEMBERS COLLABORATIVE:', teamMemCols.rows.length);
  teamMemCols.rows.forEach(t => console.log(`  - Team: ${t.team_id}, Member: ${t.member_id}, Role: ${t.role}`));

  await client.end();
}
run().catch(console.error);
