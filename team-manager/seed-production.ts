/**
 * Production seed — uses @neondatabase/serverless (HTTPS/WebSocket, port 443)
 * Run: DATABASE_URL="<neon-url>" npx tsx seed-production.ts
 */

import { neon } from '@neondatabase/serverless';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL env var is required');
  process.exit(1);
}

const sql = neon(DB_URL);

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

async function seed() {
  console.log('🚀 Seeding new members via Neon HTTP API...\n');

  // Find or create team
  const teams = await sql`SELECT id, name FROM teams LIMIT 1`;
  let teamId: number;
  let teamName: string;

  if (teams.length === 0) {
    const [newTeam] = await sql`
      INSERT INTO teams (name, description)
      VALUES ('Unified Alpha Group', 'Alpha Group main team')
      RETURNING id, name
    `;
    teamId = newTeam.id;
    teamName = newTeam.name;
    console.log(`✅ Created team "${teamName}" (ID: ${teamId})\n`);
  } else {
    teamId = teams[0].id;
    teamName = teams[0].name;
    console.log(`📋 Using team "${teamName}" (ID: ${teamId})\n`);
  }

  for (const m of NEW_MEMBERS) {
    console.log(`👤 Processing ${m.name} (${m.email})...`);

    // Upsert user
    let userId: number;
    const existing = await sql`SELECT id FROM users WHERE email = ${m.email} LIMIT 1`;
    if (existing.length > 0) {
      userId = existing[0].id;
      console.log(`   ↳ Found existing user (ID: ${userId})`);
    } else {
      const [newUser] = await sql`
        INSERT INTO users (email, name, login_method, role)
        VALUES (${m.email}, ${m.name}, 'github', 'user')
        RETURNING id
      `;
      userId = newUser.id;
      console.log(`   ↳ Created user (ID: ${userId})`);
    }

    // Upsert team_members profile
    const existingMember = await sql`SELECT id FROM team_members WHERE id = ${userId} LIMIT 1`;
    if (existingMember.length > 0) {
      console.log(`   ↳ Team member profile already exists`);
    } else {
      await sql`
        INSERT INTO team_members (id, name, email, position)
        VALUES (${userId}, ${m.name}, ${m.email}, ${m.position})
        ON CONFLICT (id) DO NOTHING
      `;
      console.log(`   ↳ Created team member profile`);
    }

    // Upsert team_members_collaborative
    const existingCollab = await sql`
      SELECT id FROM team_members_collaborative
      WHERE team_id = ${teamId} AND member_id = ${userId}
      LIMIT 1
    `;
    if (existingCollab.length > 0) {
      console.log(`   ↳ Already a member of team "${teamName}"`);
    } else {
      await sql`
        INSERT INTO team_members_collaborative (team_id, member_id, role, office_role, status)
        VALUES (${teamId}, ${userId}, ${m.role}, ${m.officeRole}, 'active')
      `;
      console.log(`   ↳ Added to team as ${m.role} / ${m.officeRole}`);
    }

    console.log(`   ✅ ${m.name} is set up\n`);
  }

  console.log('🎉 All new members have been added successfully!');
}

seed().catch((err) => {
  console.error('❌ Error:', err?.message || err);
  process.exit(1);
});
