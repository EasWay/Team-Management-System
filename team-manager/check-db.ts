import 'dotenv/config';
import { getDb } from './server/db';
import { users, teams, teamMembers, teamMembersCollaborative } from './drizzle/schema';
import { sql } from 'drizzle-orm';

async function run() {
  const db = await getDb();
  if (!db) { console.error('no db'); return; }

  const allUsers = await db.select().from(users).orderBy(users.id);
  console.log('USERS:', allUsers.length);
  allUsers.forEach(u => console.log(`  - ${u.id}: ${u.email} (${u.name})`));

  const allMembers = await db.select().from(teamMembers).orderBy(teamMembers.id);
  console.log('\nTEAM MEMBERS:', allMembers.length);
  allMembers.forEach(u => console.log(`  - ${u.id}: ${u.email} (${u.name})`));
  
  const allTeams = await db.select().from(teams);
  console.log('\nTEAMS:', allTeams.length);
  allTeams.forEach(t => console.log(`  - ${t.id}: ${t.name} (createdBy: ${t.createdBy})`));

  const teamMemCols = await db.select().from(teamMembersCollaborative);
  console.log('\nTEAM MEMBERS COLLABORATIVE:', teamMemCols.length);
  teamMemCols.forEach(t => console.log(`  - Team: ${t.teamId}, Member: ${t.memberId}, Role: ${t.role}`));

  process.exit(0);
}
run().catch(console.error);
