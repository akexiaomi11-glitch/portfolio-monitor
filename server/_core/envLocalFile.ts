import { readFileSync, writeFileSync } from "fs";
import path from "path";

const ENV_LOCAL_PATH = path.resolve(process.cwd(), ".env.local");

// Persists the new hash to .env.local (so it survives a restart) and updates
// process.env immediately (so it takes effect without one).
export function updateAppPasswordHash(newHash: string): void {
  let content = "";
  try {
    content = readFileSync(ENV_LOCAL_PATH, "utf8");
  } catch {
    content = "";
  }

  const line = `APP_PASSWORD_HASH=${newHash}`;
  const nextContent = /^APP_PASSWORD_HASH=.*$/m.test(content)
    ? content.replace(/^APP_PASSWORD_HASH=.*$/m, line)
    : (content.length > 0 ? content.replace(/\n?$/, "\n") : "") + line + "\n";

  writeFileSync(ENV_LOCAL_PATH, nextContent, "utf8");
  process.env.APP_PASSWORD_HASH = newHash;
}
