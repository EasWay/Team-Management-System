import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authService } from "./auth";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Extract token from Authorization header
    const authHeader = opts.req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);
    
    if (token) {
      const payload = await authService.verifyToken(token);
      
      if (payload && payload.type === 'access') {
        // Fetch user from database
        const db = await getDb();
        if (db) {
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, Number(payload.userId)))
            .limit(1);
          
          user = dbUser || null;
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    console.error('Authentication error:', error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
