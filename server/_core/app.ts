import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";

// Builds the API-only Express app (tRPC + body parsing, no static/Vite
// serving). Shared by the local dev/traditional server entry
// (server/_core/index.ts) and the Vercel serverless entry (api/index.ts) —
// Vercel serves the built frontend from its CDN separately, so this app only
// ever needs to handle /api/* requests there.
export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  return app;
}
