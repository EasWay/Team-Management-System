import "dotenv/config";
import { getDb } from "./server/db";
import { users, teams, teamMembersCollaborative } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function fixExcel() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }
  
  const email = 'exceltrineabenantewusu@gmail.com';
  console.log(`Looking up user: ${email}`);
  
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error("User not found!");
    process.exit(1);
  }
  
  console.log(`User found: ID ${user.id}`);
  
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  if (allTeams.length === 0) {
    console.log("No teams found.");
    process.exit(0);
  }
  
  let added = 0;
  for (const team of allTeams) {
    console.log(`Adding to team: ${team.name} (ID: ${team.id})`);
    try {
      await db.insert(teamMembersCollaborative).values({
        teamId: team.id,
        memberId: user.id,
        role: 'developer',
        status: 'active'
      }).onConflictDoNothing();
      added++;
    } catch (err) {
      console.error(`Error adding to team ${team.name}:`, err);
    }
  }
  
  console.log(`Finished adding user to teams. Insert attempts: ${added}`);
  process.exit(0);
}

fixExcel();
