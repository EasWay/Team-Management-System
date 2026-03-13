import { getDb } from "./server/db";
import { teamMembers } from "./drizzle/schema";
import { isNotNull } from "drizzle-orm";

async function check() {
    try {
        const db = await getDb();
        if (!db) {
            console.error("No DB");
            process.exit(1);
        }
        const membersWithPics = await db.select().from(teamMembers).where(isNotNull(teamMembers.pictureFileName));
        console.log(`Found ${membersWithPics.length} members with pictures.`);
        membersWithPics.forEach(m => {
            console.log(`- ID: ${m.id}, Name: ${m.name}, Picture: ${m.pictureFileName}`);
        });
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

check();
