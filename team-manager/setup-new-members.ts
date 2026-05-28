/**
 * Setup New Members Script
 *
 * Adds Exceltrine, Daniel, and Godsway to the system.
 * Run with: npx tsx team-manager/setup-new-members.ts
 * (from the repo root) or: npx tsx setup-new-members.ts (from team-manager/)
 */

import { getDb } from './server/db';
import { users, teamMembers, teamMembersCollaborative, teams } from './drizzle/schema';
import { eq, and } from 'drizzle-orm';

const NEW_MEMBERS = [
  {
    name: 'Abena Ntewusu Exceltrine',
    email: 'exceltrineabenantewusu@gmail.com',
    position: 'Project Manager',
    officeRole: 'project_manager',
    role: 'developer',
  },
  {
    name: 'Daniel Mensah',
    email: 'christosmensah@gmail.com',
    position: 'Systems Architect',
    officeRole: 'systems_architect',
    role: 'developer',
  },
  {
    name: 'Godsway Ganyo',
    email: 'yawinno22@gmail.com',
    position: 'AI Engineer',
    officeRole: 'ai_engineer',
    role: 'developer',
  },
];

async function setupNewMembers() {
  console.log('🚀 Setting up new members for Unified Alpha Group...\n');

  const db = await getDb();
  if (!db) {
    console.error('❌ Database not available. Check your DB connection.');
    process.exit(1);
  }

  // Find the first available team, or create a default one
  let [team] = await db.select().from(teams).limit(1);
  if (!team) {
    console.log('⚠️  No teams found. Creating "Unified Alpha Group" team...');
    const [newTeam] = await db
      .insert(teams)
      .values({ name: 'Unified Alpha Group', description: 'Alpha Group main team' })
      .returning();
    team = newTeam;
    console.log(`✅ Created team (ID: ${team.id})\n`);
  }

  console.log(`📋 Using team: "${team.name}" (ID: ${team.id})\n`);

  for (const memberData of NEW_MEMBERS) {
    console.log(`👤 Processing ${memberData.name} (${memberData.email})...`);

    // 1. Upsert users record
    let userId: number;
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, memberData.email))
      .limit(1);

    if (existingUser) {
      userId = existingUser.id;
      console.log(`   ↳ Found existing user (ID: ${userId})`);
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          email: memberData.email,
          name: memberData.name,
          loginMethod: 'github',
          role: 'user',
        })
        .returning();
      userId = newUser.id;
      console.log(`   ↳ Created user (ID: ${userId})`);
    }

    // 2. Upsert teamMembers profile (ID must match userId)
    const [existingMember] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, userId))
      .limit(1);

    if (existingMember) {
      console.log(`   ↳ Team member profile already exists`);
    } else {
      await db
        .insert(teamMembers)
        .values({
          id: userId,
          name: memberData.name,
          email: memberData.email,
          position: memberData.position,
        })
        .onConflictDoNothing({ target: teamMembers.id });
      console.log(`   ↳ Created team member profile`);
    }

    // 3. Upsert teamMembersCollaborative (link to team with role)
    const [existingCollab] = await db
      .select()
      .from(teamMembersCollaborative)
      .where(
        and(
          eq(teamMembersCollaborative.teamId, team.id),
          eq(teamMembersCollaborative.memberId, userId)
        )
      )
      .limit(1);

    if (existingCollab) {
      console.log(`   ↳ Already a member of team "${team.name}"`);
    } else {
      await db.insert(teamMembersCollaborative).values({
        teamId: team.id,
        memberId: userId,
        role: memberData.role,
        officeRole: memberData.officeRole,
        status: 'active',
      });
      console.log(`   ↳ Added to team as ${memberData.role} / ${memberData.officeRole}`);
    }

    console.log(`   ✅ ${memberData.name} is set up\n`);
  }

  console.log('🎉 All new members have been added successfully!');
  console.log('\nThey can log in using their GitHub accounts linked to the above emails.');
  process.exit(0);
}

setupNewMembers().catch((err) => {
  console.error('❌ Error setting up members:', err);
  process.exit(1);
});
