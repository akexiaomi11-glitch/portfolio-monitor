// Gates the whole app behind a single shared passphrase (server/_core/trpc.ts,
// server/routers.ts's passwordGate router, client/src/components/PasswordGate.tsx).
export const PASSWORD_GATE_COOKIE = "pw_gate_session";
export const PASSWORD_REQUIRED_ERR_MSG = "Password required (10003)";
