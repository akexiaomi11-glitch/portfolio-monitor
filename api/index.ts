import { createApiApp } from "../server/_core/app";

// Vercel serverless entrypoint. Env vars come from the Vercel project
// settings (not .env.local, which only exists locally), and every server
// module reads process.env.* lazily at request time — never at module load —
// so no dotenv/config step is needed here.
export default createApiApp();
