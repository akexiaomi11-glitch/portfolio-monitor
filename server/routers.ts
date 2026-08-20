import { PASSWORD_GATE_COOKIE } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { listStockPriceHistory, recordStockPriceHistory } from "./db";
import { getAppCookieOptions } from "./_core/cookies";
import { hashAppPassword, verifyAppPassword } from "./_core/appPassword";
import { updateAppPasswordHash } from "./_core/envLocalFile";
import { createGateToken, verifyGateToken } from "./_core/passwordGateSession";
import { isBlocked, recordFailure, recordSuccess } from "./_core/loginThrottle";
import { gatedProcedure, publicProcedure, router } from "./_core/trpc";
import { fetchPortfolioSnapshot } from "./portfolio";
import { fetchBondSnapshot } from "./bonds";
import { fetchProvidentFundSnapshot } from "./providentFund";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const GATE_COOKIE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function requestKey(req: { ip?: string; socket: { remoteAddress?: string } }): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export const appRouter = router({
  passwordGate: router({
    status: publicProcedure.query(async ({ ctx }) => {
      const cookies = parseCookieHeader(ctx.req.headers.cookie ?? "");
      const unlocked = await verifyGateToken(cookies[PASSWORD_GATE_COOKIE]);
      return { unlocked };
    }),
    unlock: publicProcedure
      .input(z.object({ password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const key = requestKey(ctx.req);
        if (isBlocked(key)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "ลองผิดหลายครั้งเกินไป โปรดรออีก 15 นาที" });
        }

        // Read lazily (at call time): see the comment in passwordGateSession.ts
        // for why a top-level ENV.* read would always be empty in this app.
        const appPasswordHash = process.env.APP_PASSWORD_HASH ?? "";
        const isValid = appPasswordHash ? await verifyAppPassword(input.password, appPasswordHash) : false;
        if (!isValid) {
          recordFailure(key);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "รหัสผ่านไม่ถูกต้อง" });
        }

        recordSuccess(key);
        const token = await createGateToken();
        const cookieOptions = getAppCookieOptions(ctx.req);
        ctx.res.cookie(PASSWORD_GATE_COOKIE, token, { ...cookieOptions, maxAge: GATE_COOKIE_MAX_AGE_MS });
        return { success: true } as const;
      }),
    lock: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getAppCookieOptions(ctx.req);
      ctx.res.clearCookie(PASSWORD_GATE_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    changePassword: gatedProcedure
      .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }))
      .mutation(async ({ ctx, input }) => {
        const key = requestKey(ctx.req);
        if (isBlocked(key)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "ลองผิดหลายครั้งเกินไป โปรดรออีก 15 นาที" });
        }

        const currentHash = process.env.APP_PASSWORD_HASH ?? "";
        const isCurrentValid = currentHash ? await verifyAppPassword(input.currentPassword, currentHash) : false;
        if (!isCurrentValid) {
          recordFailure(key);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
        }

        recordSuccess(key);
        const newHash = await hashAppPassword(input.newPassword);
        updateAppPasswordHash(newHash);
        return { success: true } as const;
      }),
  }),
  portfolio: router({
    snapshot: gatedProcedure
      .input(z.object({ forceRefresh: z.boolean() }).optional())
      .query(async ({ input }) => {
        const snapshot = await fetchPortfolioSnapshot(input?.forceRefresh ?? false);
        await recordStockPriceHistory(snapshot.holdings);
        return snapshot;
      }),
    history: gatedProcedure.query(() => listStockPriceHistory()),
  }),
  bonds: router({
    snapshot: gatedProcedure
      .input(z.object({ forceRefresh: z.boolean() }).optional())
      .query(({ input }) => fetchBondSnapshot(input?.forceRefresh ?? false)),
  }),
  providentFund: router({
    snapshot: gatedProcedure
      .input(z.object({ forceRefresh: z.boolean() }).optional())
      .query(({ input }) => fetchProvidentFundSnapshot(input?.forceRefresh ?? false)),
  }),
});

export type AppRouter = typeof appRouter;
