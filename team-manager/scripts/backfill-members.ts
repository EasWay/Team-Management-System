import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
import * as schema from '../drizzle/schema';
import { notInArray } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function backfill() {
    const _pool = new Pool({
        host: 'localhost',
        port: 5433,
        database: 'team_manager_db',
        user: 'postgres',
        password: 'postgres',
        ssl: false,
    });
    const db = drizzle(_pool, { schema });

    console.log("Connected to DB, finding missing team members...");

    const existingTeamMembers = await db.select({ id: schema.teamMembers.id }).from(schema.teamMembers);
    const existingIds = existingTeamMembers.map(tm => tm.id);

    let usersWithoutMembers;
    if (existingIds.length > 0) {
        usersWithoutMembers = await db.select().from(schema.users).where(notInArray(schema.users.id, existingIds));
    } else {
        usersWithoutMembers = await db.select().from(schema.users);
    }

    console.log(`Found ${usersWithoutMembers.length} users missing team Members.`);

    for (const user of usersWithoutMembers) {
        console.log(`Creating TeamMember for user ${user.id} (${user.email})`);
        try {
            if (existingIds.length === 0 && user.id > 1) {
                // Sync sequence later if needed
            }

            await db.insert(schema.teamMembers).values({
                id: user.id,
                name: user.name || user.email?.split('@')[0] || 'Unknown User',
                email: user.email,
                position: 'Member',
            });
            console.log(`Success inserting TeamMember for ${user.id}`);
        } catch (err) {
            console.error(`Failed to create TeamMember for ${user.id}`, err);
        }
    }

    await _pool.end();
}

backfill().catch(console.error);
