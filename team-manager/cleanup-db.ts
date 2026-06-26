import 'dotenv/config';
import { getDb } from './server/db.ts';
import { users, teams, teamMembers, teamMembersCollaborative } from './drizzle/schema.ts';
import { like, or } from 'drizzle-orm';

async function run() {
  console.log('Connecting to DB...');
  const db = await getDb();
  if (!db) { console.error('no db'); return; }

  console.log('Finding test users...');
  const testUsers = await db.select().from(users).where(
    or(
      like(users.email, '%@realtimeint.test'),
      like(users.email, '%@realtime.test'),
      like(users.email, '%@test.com'),
      like(users.email, '%@example.com')
    )
  );

  console.log('Found', testUsers.length, 'test users.');
  for (const u of testUsers) {
    console.log(`Deleting user ${u.id}: ${u.email}`);
    await db.delete(users).where(like(users.email, u.email));
  }

  console.log('Finding test teams...');
  const testTeams = await db.select().from(teams).where(
    or(
      like(teams.name, '%Test Team%'),
      like(teams.name, 'Team 1'),
      like(teams.name, 'Team 2')
    )
  );
  
  console.log('Found', testTeams.length, 'test teams.');
  for (const t of testTeams) {
    console.log(`Deleting team ${t.id}: ${t.name}`);
    await db.delete(teams).where(like(teams.name, t.name));
  }
  
  console.log('Done cleaning up.');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
