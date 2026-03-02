import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: "localhost",
    port: 5433, // PostgreSQL 13 is running on port 5433
    user: "postgres",
    password: "postgres",
    database: "team_manager_db", // Updated to match created database name
    ssl: false, // Disable SSL for local development
  },
});
