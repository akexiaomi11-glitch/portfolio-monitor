import { PASSWORD_GATE_COOKIE, PASSWORD_REQUIRED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { verifyGateToken } from "./passwordGateSession";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requirePasswordGate = t.middleware(async opts => {
  const { ctx, next } = opts;

  const cookies = parseCookieHeader(ctx.req.headers.cookie ?? "");
  const unlocked = await verifyGateToken(cookies[PASSWORD_GATE_COOKIE]);
  if (!unlocked) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: PASSWORD_REQUIRED_ERR_MSG });
  }

  return next({ ctx });
});

// Data procedures use this instead of publicProcedure once the app-wide
// password gate is enabled, so the API itself is protected — not just the UI.
export const gatedProcedure = t.procedure.use(requirePasswordGate);
