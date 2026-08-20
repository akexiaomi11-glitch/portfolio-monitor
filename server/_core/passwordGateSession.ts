import { SignJWT, jwtVerify } from "jose";

const GATE_CLAIM = "pwGate";

// Read lazily (at call time, not module load) since this app boots as ESM:
// index.ts's dotenv config() call only runs after its whole import graph —
// including this module — has already evaluated, so a top-level `const`
// read of process.env here would always capture "" (see server/_core/env.ts
// for the ENV object this same pitfall affects).
function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

export async function createGateToken(): Promise<string> {
  return new SignJWT({ [GATE_CLAIM]: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(getSecret());
}

export async function verifyGateToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload[GATE_CLAIM] === true;
  } catch {
    return false;
  }
}
