import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getMemberRoleInTeam, type TeamRole } from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  console.log(`[TRPC] 🚀 ${type} ${path} - Start`);
  const result = await next();
  const durationMs = Date.now() - start;
  if (result.ok) {
    console.log(`[TRPC] ✅ ${type} ${path} - Success in ${durationMs}ms`);
  } else {
    console.error(`[TRPC] ❌ ${type} ${path} - Failed in ${durationMs}ms`, result.error);
  }
  return result;
});

export const router = t.router;
export const publicProcedure = t.procedure.use(loggerMiddleware);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requireTeamMembership = t.middleware(async ({ ctx, next, getRawInput }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  const raw = await getRawInput();
  const teamId = Number((raw as any)?.teamId);
  if (!teamId || Number.isNaN(teamId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "teamId is required" });
  }

  const teamRole = await getMemberRoleInTeam(teamId, ctx.user.id);
  if (!teamRole) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this team" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      teamId,
      teamRole: teamRole as TeamRole,
    },
  });
});

/** Like protectedProcedure, but also requires the caller to be an active member of `input.teamId`. */
export const teamProcedure = protectedProcedure.use(requireTeamMembership);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
