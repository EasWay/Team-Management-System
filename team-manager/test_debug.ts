import axios from "axios";

async function testDebug() {
    try {
        const response = await axios.get("http://localhost:3000/api/trpc/team.debug?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("Error calling debug endpoint:", error.message);
    }
}

testDebug();
