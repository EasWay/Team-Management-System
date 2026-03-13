import { getDb, getTeamMembers } from "./server/db";

async function check() {
    try {
        const members = await getTeamMembers();
        console.log("Team Members in DB:");
        members.forEach(m => {
            console.log(`- ID: ${m.id}, Name: ${m.name}, Picture: ${m.pictureFileName}`);
        });
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

check();
