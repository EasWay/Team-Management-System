import "dotenv/config";
import { getDb } from "./server/db";
import { users, teams, teamMembersCollaborative } from "./drizzle/schema";

async function addAllUsersToAllTeams() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }
  
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  
  if (allUsers.length === 0 || allTeams.length === 0) {
    console.log("No users or teams found.");
    process.exit(0);
  }
  
  let added = 0;
  for (const user of allUsers) {
    for (const team of allTeams) {
      try {
        await db.insert(teamMembersCollaborative).values({
          teamId: team.id,
          memberId: user.id,
          role: 'developer',
          status: 'active'
        }).onConflictDoNothing();
        added++;
      } catch (err) {
        console.error(`Error adding user ${user.email} to team ${team.name}:`, err);
      }
    }
  }
  
  console.log(`Finished adding users to teams. Insert attempts: ${added}`);
  process.exit(0);
}

addAllUsersToAllTeams();
