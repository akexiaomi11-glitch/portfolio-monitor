// server/_core/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var PASSWORD_GATE_COOKIE = "pw_gate_session";
var PASSWORD_REQUIRED_ERR_MSG = "Password required (10003)";

// server/routers.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// drizzle/schema.ts
import { bigint, decimal, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
var assetPriceHistory = pgTable("assetPriceHistory", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  assetName: varchar("assetName", { length: 160 }).notNull(),
  assetType: text("assetType", { enum: ["stock_or_fund"] }).notNull().default("stock_or_fund"),
  currentValue: decimal("currentValue", { precision: 20, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 20, scale: 2 }).notNull(),
  pnl: decimal("pnl", { precision: 20, scale: 2 }).notNull(),
  pnlPercent: decimal("pnlPercent", { precision: 12, scale: 4 }).notNull(),
  dailyChangePercent: decimal("dailyChangePercent", { precision: 12, scale: 4 }).notNull(),
  sourceDate: timestamp("sourceDate", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recordedAt", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("asset_price_history_asset_date_unique").on(table.assetName, table.sourceDate)
]);

// shared/assetHistory.ts
function dayKey(date) {
  return date.toISOString().slice(0, 10);
}
function stockHistoryKey(assetName, sourceDate) {
  return `${assetName}::${dayKey(sourceDate)}`;
}
function shouldInsertStockHistory(assetName, sourceDate, existingKeys) {
  const key = stockHistoryKey(assetName, sourceDate);
  if (existingKeys.has(key)) return false;
  existingKeys.add(key);
  return true;
}
function buildStockHistoryRecords(holdings) {
  const grouped = /* @__PURE__ */ new Map();
  for (const holding of holdings) {
    if (!holding.sourceDate) continue;
    const key = stockHistoryKey(holding.name, holding.sourceDate);
    const existing = grouped.get(key);
    const weightedDailyChange = holding.dailyChangePercent * holding.currentValue;
    if (existing) {
      existing.currentValue += holding.currentValue;
      existing.cost += holding.cost;
      existing.pnl += holding.pnl;
      existing.weightedDailyChange += weightedDailyChange;
      continue;
    }
    grouped.set(key, {
      assetName: holding.name,
      currentValue: holding.currentValue,
      cost: holding.cost,
      pnl: holding.pnl,
      pnlPercent: 0,
      dailyChangePercent: 0,
      weightedDailyChange,
      sourceDate: holding.sourceDate
    });
  }
  return Array.from(grouped.values()).map(({ weightedDailyChange, ...record }) => ({
    ...record,
    pnlPercent: record.cost === 0 ? 0 : record.pnl / record.cost * 100,
    dailyChangePercent: record.currentValue === 0 ? 0 : weightedDailyChange / record.currentValue
  }));
}

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, { prepare: false });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function recordStockPriceHistory(holdings) {
  const db = await getDb();
  if (!db) return;
  const records = buildStockHistoryRecords(holdings);
  if (records.length === 0) return;
  const seenRecords = /* @__PURE__ */ new Set();
  for (const record of records) {
    const existing = await db.select({ id: assetPriceHistory.id }).from(assetPriceHistory).where(and(eq(assetPriceHistory.assetName, record.assetName), eq(assetPriceHistory.sourceDate, record.sourceDate))).limit(1);
    if (existing.length > 0) {
      shouldInsertStockHistory(record.assetName, record.sourceDate, seenRecords);
      continue;
    }
    if (!shouldInsertStockHistory(record.assetName, record.sourceDate, seenRecords)) continue;
    await db.insert(assetPriceHistory).values({
      assetName: record.assetName,
      assetType: "stock_or_fund",
      currentValue: record.currentValue.toFixed(2),
      cost: record.cost.toFixed(2),
      pnl: record.pnl.toFixed(2),
      pnlPercent: record.pnlPercent.toFixed(4),
      dailyChangePercent: record.dailyChangePercent.toFixed(4),
      sourceDate: record.sourceDate
    });
  }
}
async function listStockPriceHistory() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assetPriceHistory).orderBy(asc(assetPriceHistory.assetName), asc(assetPriceHistory.sourceDate));
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getAppCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req)
  };
}

// server/_core/appPassword.ts
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
var scrypt = promisify(scryptCallback);
var KEY_LENGTH = 64;
async function hashAppPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}
async function verifyAppPassword(password, stored) {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  const storedBuffer = Buffer.from(hashHex, "hex");
  if (storedBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(derivedKey, storedBuffer);
}

// server/_core/envLocalFile.ts
import { readFileSync, writeFileSync } from "fs";
import path from "path";
var ENV_LOCAL_PATH = path.resolve(process.cwd(), ".env.local");
function updateAppPasswordHash(newHash) {
  let content = "";
  try {
    content = readFileSync(ENV_LOCAL_PATH, "utf8");
  } catch {
    content = "";
  }
  const line = `APP_PASSWORD_HASH=${newHash}`;
  const nextContent = /^APP_PASSWORD_HASH=.*$/m.test(content) ? content.replace(/^APP_PASSWORD_HASH=.*$/m, line) : (content.length > 0 ? content.replace(/\n?$/, "\n") : "") + line + "\n";
  writeFileSync(ENV_LOCAL_PATH, nextContent, "utf8");
  process.env.APP_PASSWORD_HASH = newHash;
}

// server/_core/passwordGateSession.ts
import { SignJWT, jwtVerify } from "jose";
var GATE_CLAIM = "pwGate";
function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}
async function createGateToken() {
  return new SignJWT({ [GATE_CLAIM]: true }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("180d").sign(getSecret());
}
async function verifyGateToken(token) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload[GATE_CLAIM] === true;
  } catch {
    return false;
  }
}

// server/_core/loginThrottle.ts
var MAX_ATTEMPTS = 5;
var BLOCK_MS = 15 * 6e4;
var attempts = /* @__PURE__ */ new Map();
function isBlocked(key) {
  const entry = attempts.get(key);
  return entry !== void 0 && entry.blockedUntil > Date.now();
}
function recordFailure(key) {
  const entry = attempts.get(key) ?? { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_MS;
    entry.count = 0;
  }
  attempts.set(key, entry);
}
function recordSuccess(key) {
  attempts.delete(key);
}

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requirePasswordGate = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const cookies = parseCookieHeader(ctx.req.headers.cookie ?? "");
  const unlocked = await verifyGateToken(cookies[PASSWORD_GATE_COOKIE]);
  if (!unlocked) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: PASSWORD_REQUIRED_ERR_MSG });
  }
  return next({ ctx });
});
var gatedProcedure = t.procedure.use(requirePasswordGate);

// server/googleSheets.ts
import { SignJWT as SignJWT2, importPKCS8 } from "jose";
var GOOGLE_SHEET_ID = "1vAYHTnFarZgwoiH1HlqsEnIBYjgQl7QvcbJ5pfU7iG8";
var GOOGLE_SHEET_VIEW_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit`;
async function getGoogleAccessToken() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw) {
    throw new Error("\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E1A\u0E31\u0E0D\u0E0A\u0E35 Google Service Account");
  }
  const privateKey = await importPKCS8(privateKeyRaw.replace(/\\n/g, "\n"), "RS256");
  const assertion = await new SignJWT2({ scope: "https://www.googleapis.com/auth/spreadsheets.readonly" }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(clientEmail).setSubject(clientEmail).setAudience("https://oauth2.googleapis.com/token").setIssuedAt().setExpirationTime("1h").sign(privateKey);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!tokenResponse.ok) {
    throw new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19\u0E01\u0E31\u0E1A Google \u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49");
  }
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}
async function fetchSheetValues(range) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E32\u0E01 Google Sheets \u0E44\u0E14\u0E49\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49");
  }
  const data = await response.json();
  return data.values ?? [];
}
function escapeCsvCell(value) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
function rowsToCsv(rows) {
  return rows.map((row) => row.map((cell) => escapeCsvCell(cell ?? "")).join(",")).join("\n");
}

// server/portfolio.ts
var GOOGLE_SHEET_RANGE = "Stock";
var LARGE_DAILY_CHANGE_THRESHOLD = 1;
var snapshotCache = null;
var SNAPSHOT_CACHE_TTL_MS = 3e5;
function parseCsvLine(line) {
  const values = [];
  let value = "";
  let isInsideQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];
    if (character === '"') {
      if (isInsideQuotes && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else {
        isInsideQuotes = !isInsideQuotes;
      }
    } else if (character === "," && !isInsideQuotes) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}
function parseNumber(value) {
  if (!value) return null;
  const cleaned = value.replace(/[,%฿\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
function parseSheetDate(value) {
  if (!value) return null;
  const normalizedValue = value.trim();
  const dateMatch = normalizedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const thaiDateMatch = normalizedValue.match(/^(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})$/);
  if (!dateMatch && !thaiDateMatch) return null;
  const thaiMonthIndexes = {
    "\u0E21.\u0E04.": 0,
    "\u0E01.\u0E1E.": 1,
    "\u0E21\u0E35.\u0E04.": 2,
    "\u0E40\u0E21.\u0E22.": 3,
    "\u0E1E.\u0E04.": 4,
    "\u0E21\u0E34.\u0E22.": 5,
    "\u0E01.\u0E04.": 6,
    "\u0E2A.\u0E04.": 7,
    "\u0E01.\u0E22.": 8,
    "\u0E15.\u0E04.": 9,
    "\u0E1E.\u0E22.": 10,
    "\u0E18.\u0E04.": 11
  };
  const dayString = dateMatch?.[1] ?? thaiDateMatch?.[1];
  const monthString = dateMatch?.[2];
  const thaiMonthString = thaiDateMatch?.[2];
  const yearString = dateMatch?.[3] ?? thaiDateMatch?.[3];
  const day = Number(dayString);
  const month = monthString ? Number(monthString) : (thaiMonthIndexes[thaiMonthString ?? ""] ?? -1) + 1;
  let year = Number(yearString);
  if (year > 2400) year -= 543;
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
    return null;
  }
  return parsedDate;
}
function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function businessDaysSince(updatedAt, referenceDate) {
  const start = startOfUtcDay(updatedAt);
  const end = startOfUtcDay(referenceDate);
  if (start >= end) return 0;
  let count = 0;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
function isStale(updatedAt, referenceDate) {
  return updatedAt === null || businessDaysSince(updatedAt, referenceDate) > 2;
}
function parsePortfolioCsv(csv, referenceDate = /* @__PURE__ */ new Date()) {
  const rows = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((row) => row.trim().length > 0).map(parseCsvLine);
  if (rows.length < 2) return [];
  const header = rows[0].map((cell) => cell.trim());
  const indexFor = (label) => header.findIndex((cell) => cell === label);
  const nameIndex = 0;
  const valueIndex = indexFor("\u0E21\u0E39\u0E25\u0E04\u0E48\u0E32\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19");
  const pnlIndex = indexFor("P&L");
  const pnlPercentIndex = indexFor("%P&L");
  const dailyChangeIndex = indexFor("%Chg");
  const updatedIndex = indexFor("\u0E27\u0E31\u0E19\u0E2D\u0E31\u0E1E\u0E40\u0E14\u0E1E");
  const statusIndex = indexFor("Status");
  if ([valueIndex, pnlIndex, pnlPercentIndex, dailyChangeIndex, updatedIndex, statusIndex].some((index) => index < 0)) {
    throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E04\u0E2D\u0E25\u0E31\u0E21\u0E19\u0E4C\u0E2B\u0E25\u0E31\u0E01\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E43\u0E19\u0E0A\u0E35\u0E15 Stock");
  }
  const holdings = rows.slice(1).flatMap((row, rowIndex) => {
    const name = row[nameIndex]?.trim();
    const currentValue = parseNumber(row[valueIndex]);
    const pnl = parseNumber(row[pnlIndex]);
    const pnlPercent = parseNumber(row[pnlPercentIndex]);
    const dailyChangePercent = parseNumber(row[dailyChangeIndex]);
    const status = row[statusIndex]?.trim().toLowerCase();
    if (!name || status !== "active" || currentValue === null || pnl === null || pnlPercent === null || dailyChangePercent === null) {
      return [];
    }
    const parsedDate = parseSheetDate(row[updatedIndex]);
    const businessDaysOld = parsedDate ? businessDaysSince(parsedDate, referenceDate) : null;
    const negativePnl = pnl < 0;
    const largeDailyChange = Math.abs(dailyChangePercent) >= LARGE_DAILY_CHANGE_THRESHOLD;
    const stale = isStale(parsedDate, referenceDate);
    const attentionReasons = [
      ...negativePnl ? ["\u0E1C\u0E25\u0E15\u0E2D\u0E1A\u0E41\u0E17\u0E19\u0E15\u0E34\u0E14\u0E25\u0E1A"] : [],
      ...largeDailyChange ? ["\u0E04\u0E27\u0E32\u0E21\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E23\u0E32\u0E22\u0E27\u0E31\u0E19\u0E2A\u0E39\u0E07"] : [],
      ...stale ? [parsedDate ? "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E01\u0E34\u0E19 2 \u0E27\u0E31\u0E19\u0E17\u0E33\u0E01\u0E32\u0E23" : "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15"] : []
    ];
    return [
      {
        id: `${name}-${rowIndex}`,
        name,
        status: "Active",
        currentValue,
        cost: currentValue - pnl,
        pnl,
        pnlPercent,
        dailyChangePercent,
        updatedDate: row[updatedIndex]?.trim() || null,
        sourceDate: parsedDate,
        businessDaysOld,
        isStale: stale,
        isNegativePnl: negativePnl,
        hasLargeDailyChange: largeDailyChange,
        attentionReasons
      }
    ];
  });
  return holdings.sort((left, right) => {
    const leftNeedsAttention = left.attentionReasons.length > 0 ? 1 : 0;
    const rightNeedsAttention = right.attentionReasons.length > 0 ? 1 : 0;
    if (leftNeedsAttention !== rightNeedsAttention) return rightNeedsAttention - leftNeedsAttention;
    return right.currentValue - left.currentValue;
  });
}
function buildPortfolioSnapshot(csv, referenceDate = /* @__PURE__ */ new Date()) {
  const holdings = parsePortfolioCsv(csv, referenceDate);
  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + holding.cost, 0);
  const totalPnl = holdings.reduce((sum, holding) => sum + holding.pnl, 0);
  return {
    holdings,
    summary: {
      totalValue,
      totalCost,
      totalPnl,
      totalPnlPercent: totalCost === 0 ? 0 : totalPnl / totalCost * 100,
      positiveCount: holdings.filter((holding) => holding.pnl >= 0).length,
      negativeCount: holdings.filter((holding) => holding.isNegativePnl).length,
      largeMoveCount: holdings.filter((holding) => holding.hasLargeDailyChange).length,
      staleCount: holdings.filter((holding) => holding.isStale).length
    },
    syncedAt: referenceDate,
    source: {
      sheetName: "Stock",
      url: GOOGLE_SHEET_VIEW_URL
    }
  };
}
async function fetchPortfolioSnapshot(forceRefresh = false) {
  if (!forceRefresh && snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.snapshot;
  }
  const values = await fetchSheetValues(GOOGLE_SHEET_RANGE);
  const snapshot = buildPortfolioSnapshot(rowsToCsv(values));
  snapshotCache = {
    snapshot,
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS
  };
  return snapshot;
}

// server/bonds.ts
var GOOGLE_SHEET_BOND_RANGE = "Bond";
var THAI_MONTH_ORDER = ["\u0E21.\u0E04.", "\u0E01.\u0E1E.", "\u0E21\u0E35.\u0E04.", "\u0E40\u0E21.\u0E22.", "\u0E1E.\u0E04.", "\u0E21\u0E34.\u0E22.", "\u0E01.\u0E04.", "\u0E2A.\u0E04.", "\u0E01.\u0E22.", "\u0E15.\u0E04.", "\u0E1E.\u0E22.", "\u0E18.\u0E04."];
var UPCOMING_PAYMENT_MONTHS_AHEAD = 6;
function parseNumber2(value) {
  if (!value) return null;
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
function parseBuddhistDate(value) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]) - 543;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}
function splitMaturityCell(value) {
  if (!value) return { date: null, note: null };
  const trimmed = value.trim();
  const noteMatch = trimmed.match(/\(([^)]+)\)\s*$/);
  const note = noteMatch ? noteMatch[1] : null;
  return { date: parseBuddhistDate(trimmed), note };
}
function buildMonthColumns(yearRow, monthRow) {
  const columns = [];
  let currentYear = null;
  for (let columnIndex = 0; columnIndex < monthRow.length; columnIndex += 1) {
    const monthLabel = monthRow[columnIndex]?.trim();
    const monthIndex = THAI_MONTH_ORDER.indexOf(monthLabel ?? "");
    if (monthIndex === -1) continue;
    const yearLabel = yearRow[columnIndex]?.trim();
    if (yearLabel) currentYear = Number(yearLabel) - 543;
    if (currentYear === null) continue;
    columns.push({ columnIndex, year: currentYear, month: monthIndex + 1 });
  }
  return columns;
}
function parseBondRows(rows, referenceDate = /* @__PURE__ */ new Date()) {
  if (rows.length < 3) return [];
  const monthColumns = buildMonthColumns(rows[0] ?? [], rows[1] ?? []);
  const bonds = rows.slice(2).flatMap((row, rowIndex) => {
    const name = row[2]?.trim();
    if (!name) return [];
    const principalOutstanding = parseNumber2(row[7]);
    const principalMatured = parseNumber2(row[8]);
    const { date: maturityDate, note: maturityNote } = splitMaturityCell(row[0]);
    const isMatured = principalMatured !== null || maturityDate !== null && maturityDate <= referenceDate;
    const referenceYear = referenceDate.getUTCFullYear();
    const referenceMonth = referenceDate.getUTCMonth() + 1;
    const monthly = monthColumns.map((column) => {
      const isFuture = column.year > referenceYear || column.year === referenceYear && column.month > referenceMonth;
      if (isFuture) return { year: column.year, month: column.month, status: "not-due", amount: null };
      const raw = row[column.columnIndex]?.trim();
      if (!raw) return { year: column.year, month: column.month, status: "not-due", amount: null };
      if (raw === "-") return { year: column.year, month: column.month, status: "missed", amount: null };
      return { year: column.year, month: column.month, status: "received", amount: parseNumber2(raw) };
    });
    const hasMissedPayment = monthly.some((entry) => entry.status === "missed");
    return [
      {
        id: `${name}-${rowIndex}`,
        name,
        principal: principalOutstanding ?? principalMatured,
        isMatured,
        interestRatePercent: parseNumber2(row[3]),
        paymentPerInstallment: parseNumber2(row[4]),
        depositAccount: row[5]?.trim() || null,
        interestDay: row[6]?.trim() || null,
        purchaseDate: parseBuddhistDate(row[1]),
        maturityDate,
        maturityNote,
        totalInterestReceived: parseNumber2(row[9]),
        monthly,
        hasMissedPayment
      }
    ];
  });
  return bonds;
}
function absoluteMonthIndex(year, month) {
  return year * 12 + (month - 1);
}
function computeUpcomingPayments(bonds, referenceDate = /* @__PURE__ */ new Date(), monthsAhead = UPCOMING_PAYMENT_MONTHS_AHEAD) {
  const currentIdx = absoluteMonthIndex(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1);
  const windowEndIdx = currentIdx + monthsAhead - 1;
  const upcoming = [];
  for (const bond of bonds) {
    if (bond.isMatured) continue;
    const received = bond.monthly.filter((entry) => entry.status === "received").map((entry) => ({ idx: absoluteMonthIndex(entry.year, entry.month), amount: entry.amount })).sort((left, right) => left.idx - right.idx);
    if (received.length < 2) continue;
    const last = received[received.length - 1];
    const secondLast = received[received.length - 2];
    const interval = last.idx - secondLast.idx;
    if (interval <= 0) continue;
    const recentAmounts = received.slice(-3).map((entry) => entry.amount).filter((amount) => amount !== null);
    const averageAmount = recentAmounts.length > 0 ? recentAmounts.reduce((sum, amount) => sum + amount, 0) / recentAmounts.length : null;
    const estimatedAmount = bond.paymentPerInstallment ?? averageAmount;
    for (let projectedIdx = last.idx + interval; projectedIdx <= windowEndIdx; projectedIdx += interval) {
      if (projectedIdx < currentIdx) continue;
      upcoming.push({
        bondId: bond.id,
        bondName: bond.name,
        year: Math.floor(projectedIdx / 12),
        month: projectedIdx % 12 + 1,
        estimatedAmount
      });
    }
  }
  return upcoming.sort((left, right) => absoluteMonthIndex(left.year, left.month) - absoluteMonthIndex(right.year, right.month) || left.bondName.localeCompare(right.bondName));
}
function buildBondSnapshot(rows, referenceDate = /* @__PURE__ */ new Date()) {
  const bonds = parseBondRows(rows, referenceDate);
  const yearlyTotals = /* @__PURE__ */ new Map();
  const monthlyTotals = /* @__PURE__ */ new Map();
  for (const bond of bonds) {
    for (const entry of bond.monthly) {
      if (entry.status !== "received" || entry.amount === null) continue;
      yearlyTotals.set(entry.year, (yearlyTotals.get(entry.year) ?? 0) + entry.amount);
      const key = `${entry.year}-${entry.month}`;
      const existing = monthlyTotals.get(key);
      if (existing) {
        existing.total += entry.amount;
      } else {
        monthlyTotals.set(key, { year: entry.year, month: entry.month, total: entry.amount });
      }
    }
  }
  return {
    bonds,
    summary: {
      totalPrincipal: bonds.reduce((sum, bond) => sum + (bond.principal ?? 0), 0),
      totalInterestReceived: bonds.reduce((sum, bond) => sum + (bond.totalInterestReceived ?? 0), 0),
      activeCount: bonds.filter((bond) => !bond.isMatured).length,
      maturedCount: bonds.filter((bond) => bond.isMatured).length,
      missedPaymentCount: bonds.filter((bond) => bond.hasMissedPayment).length
    },
    yearly: Array.from(yearlyTotals.entries(), ([year, total]) => ({ year, total })).sort((left, right) => left.year - right.year),
    monthly: Array.from(monthlyTotals.values()).sort((left, right) => left.year - right.year || left.month - right.month),
    upcomingPayments: computeUpcomingPayments(bonds, referenceDate),
    syncedAt: referenceDate
  };
}
var snapshotCache2 = null;
var SNAPSHOT_CACHE_TTL_MS2 = 3e5;
async function fetchBondSnapshot(forceRefresh = false) {
  if (!forceRefresh && snapshotCache2 && snapshotCache2.expiresAt > Date.now()) {
    return snapshotCache2.snapshot;
  }
  const values = await fetchSheetValues(GOOGLE_SHEET_BOND_RANGE);
  const snapshot = buildBondSnapshot(values);
  snapshotCache2 = {
    snapshot,
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS2
  };
  return snapshot;
}

// server/providentFund.ts
var GOOGLE_SHEET_PVF_MONTHLY_RANGE = "PVF_Monthly";
var GOOGLE_SHEET_PVF_WEEKLY_RANGE = "PVF_Weekly";
var THAI_FULL_MONTHS = {
  "\u0E21\u0E01\u0E23\u0E32\u0E04\u0E21": 1,
  "\u0E01\u0E38\u0E21\u0E20\u0E32\u0E1E\u0E31\u0E19\u0E18\u0E4C": 2,
  "\u0E21\u0E35\u0E19\u0E32\u0E04\u0E21": 3,
  "\u0E40\u0E21\u0E29\u0E32\u0E22\u0E19": 4,
  "\u0E1E\u0E24\u0E29\u0E20\u0E32\u0E04\u0E21": 5,
  "\u0E21\u0E34\u0E16\u0E38\u0E19\u0E32\u0E22\u0E19": 6,
  "\u0E01\u0E23\u0E01\u0E0E\u0E32\u0E04\u0E21": 7,
  "\u0E01\u0E23\u0E01\u0E0F\u0E32\u0E04\u0E21": 7,
  // sheet has this misspelling for July
  "\u0E2A\u0E34\u0E07\u0E2B\u0E32\u0E04\u0E21": 8,
  "\u0E01\u0E31\u0E19\u0E22\u0E32\u0E22\u0E19": 9,
  "\u0E15\u0E38\u0E25\u0E32\u0E04\u0E21": 10,
  "\u0E1E\u0E24\u0E28\u0E08\u0E34\u0E01\u0E32\u0E22\u0E19": 11,
  "\u0E18\u0E31\u0E19\u0E27\u0E32\u0E04\u0E21": 12
};
function parseNumber3(value) {
  if (!value) return null;
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
function parseThaiMonthLabel(value) {
  if (!value) return null;
  const match = value.trim().match(/^([ก-๙]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = THAI_FULL_MONTHS[match[1]];
  if (!month) return null;
  const year = Number(match[2]) - 543;
  return new Date(Date.UTC(year, month - 1, 1));
}
function parseThaiShortDate(value) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]) - 543;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}
function parseMonthlyRows(rows) {
  if (rows.length < 2) return [];
  const points = rows.slice(1).flatMap((row) => {
    const monthDate = parseThaiMonthLabel(row[0]);
    const memberContribution = parseNumber3(row[1]);
    const memberReturn = parseNumber3(row[2]);
    const employerContribution = parseNumber3(row[3]);
    const employerReturn = parseNumber3(row[4]);
    const total = parseNumber3(row[5]);
    if (!monthDate || memberContribution === null || memberReturn === null || employerContribution === null || employerReturn === null || total === null) {
      return [];
    }
    return [
      {
        label: row[0].trim(),
        monthDate,
        memberContribution,
        memberReturn,
        employerContribution,
        employerReturn,
        capital: memberContribution + employerContribution,
        pnl: memberReturn + employerReturn,
        total
      }
    ];
  });
  return points.sort((left, right) => left.monthDate.getTime() - right.monthDate.getTime());
}
function parseWeeklyRows(rows) {
  if (rows.length < 2) return [];
  const points = rows.slice(1).flatMap((row) => {
    const asOfDate = parseThaiShortDate(row[0]);
    const fundName = row[1]?.trim();
    const value = parseNumber3(row[2]);
    if (!asOfDate || !fundName || value === null) return [];
    const memberUnits = parseNumber3(row[5]);
    const employerUnits = parseNumber3(row[6]);
    return [
      {
        asOfDate,
        fundName,
        value,
        nav: parseNumber3(row[3]),
        cumulativeReturnPercent: parseNumber3(row[4]),
        memberUnits,
        employerUnits,
        units: memberUnits !== null && employerUnits !== null ? memberUnits + employerUnits : null
      }
    ];
  });
  return points.sort((left, right) => left.asOfDate.getTime() - right.asOfDate.getTime());
}
function buildProvidentFundSnapshot(monthlyRows, weeklyRows) {
  const monthly = parseMonthlyRows(monthlyRows);
  const weekly = parseWeeklyRows(weeklyRows);
  const latestWeekly = weekly.length > 0 ? weekly[weekly.length - 1] : null;
  const latestMonth = monthly.length > 0 ? monthly[monthly.length - 1] : null;
  if (!latestWeekly && !latestMonth) {
    return { latest: null, monthly, weekly, syncedAt: /* @__PURE__ */ new Date() };
  }
  const asOfDate = latestWeekly?.asOfDate ?? latestMonth.monthDate;
  const value = latestWeekly?.value ?? latestMonth.total;
  const capitalMonth = [...monthly].reverse().find((month) => month.monthDate <= asOfDate) ?? latestMonth;
  const capital = capitalMonth?.capital ?? 0;
  const lifetimePnl = value - capital;
  const lifetimePnlPercent = capital > 0 ? lifetimePnl / capital * 100 : null;
  const currentYear = asOfDate.getUTCFullYear();
  const priorYearEnd = [...monthly].reverse().find((month) => month.monthDate.getUTCFullYear() < currentYear);
  const ytdPnl = (capitalMonth?.pnl ?? lifetimePnl) - (priorYearEnd?.pnl ?? 0);
  return {
    latest: {
      asOfDate,
      fundName: latestWeekly?.fundName ?? "Provident Fund",
      value,
      nav: latestWeekly?.nav ?? null,
      memberUnits: latestWeekly?.memberUnits ?? null,
      employerUnits: latestWeekly?.employerUnits ?? null,
      units: latestWeekly?.units ?? null,
      cumulativeReturnPercent: latestWeekly?.cumulativeReturnPercent ?? null,
      capital,
      lifetimePnl,
      lifetimePnlPercent,
      ytdPnl
    },
    monthly,
    weekly,
    syncedAt: /* @__PURE__ */ new Date()
  };
}
var snapshotCache3 = null;
var SNAPSHOT_CACHE_TTL_MS3 = 3e5;
async function fetchProvidentFundSnapshot(forceRefresh = false) {
  if (!forceRefresh && snapshotCache3 && snapshotCache3.expiresAt > Date.now()) {
    return snapshotCache3.snapshot;
  }
  const [monthlyRows, weeklyRows] = await Promise.all([
    fetchSheetValues(GOOGLE_SHEET_PVF_MONTHLY_RANGE),
    fetchSheetValues(GOOGLE_SHEET_PVF_WEEKLY_RANGE)
  ]);
  const snapshot = buildProvidentFundSnapshot(monthlyRows, weeklyRows);
  snapshotCache3 = { snapshot, expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS3 };
  return snapshot;
}

// server/routers.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
import { z } from "zod";
var GATE_COOKIE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1e3;
function requestKey(req) {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}
var appRouter = router({
  passwordGate: router({
    status: publicProcedure.query(async ({ ctx }) => {
      const cookies = parseCookieHeader2(ctx.req.headers.cookie ?? "");
      const unlocked = await verifyGateToken(cookies[PASSWORD_GATE_COOKIE]);
      return { unlocked };
    }),
    unlock: publicProcedure.input(z.object({ password: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const key = requestKey(ctx.req);
      if (isBlocked(key)) {
        throw new TRPCError2({ code: "TOO_MANY_REQUESTS", message: "\u0E25\u0E2D\u0E07\u0E1C\u0E34\u0E14\u0E2B\u0E25\u0E32\u0E22\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B \u0E42\u0E1B\u0E23\u0E14\u0E23\u0E2D\u0E2D\u0E35\u0E01 15 \u0E19\u0E32\u0E17\u0E35" });
      }
      const appPasswordHash = process.env.APP_PASSWORD_HASH ?? "";
      const isValid = appPasswordHash ? await verifyAppPassword(input.password, appPasswordHash) : false;
      if (!isValid) {
        recordFailure(key);
        throw new TRPCError2({ code: "UNAUTHORIZED", message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
      }
      recordSuccess(key);
      const token = await createGateToken();
      const cookieOptions = getAppCookieOptions(ctx.req);
      ctx.res.cookie(PASSWORD_GATE_COOKIE, token, { ...cookieOptions, maxAge: GATE_COOKIE_MAX_AGE_MS });
      return { success: true };
    }),
    lock: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getAppCookieOptions(ctx.req);
      ctx.res.clearCookie(PASSWORD_GATE_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    changePassword: gatedProcedure.input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })).mutation(async ({ ctx, input }) => {
      const key = requestKey(ctx.req);
      if (isBlocked(key)) {
        throw new TRPCError2({ code: "TOO_MANY_REQUESTS", message: "\u0E25\u0E2D\u0E07\u0E1C\u0E34\u0E14\u0E2B\u0E25\u0E32\u0E22\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B \u0E42\u0E1B\u0E23\u0E14\u0E23\u0E2D\u0E2D\u0E35\u0E01 15 \u0E19\u0E32\u0E17\u0E35" });
      }
      const currentHash = process.env.APP_PASSWORD_HASH ?? "";
      const isCurrentValid = currentHash ? await verifyAppPassword(input.currentPassword, currentHash) : false;
      if (!isCurrentValid) {
        recordFailure(key);
        throw new TRPCError2({ code: "UNAUTHORIZED", message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
      }
      recordSuccess(key);
      const newHash = await hashAppPassword(input.newPassword);
      updateAppPasswordHash(newHash);
      return { success: true };
    })
  }),
  portfolio: router({
    snapshot: gatedProcedure.input(z.object({ forceRefresh: z.boolean() }).optional()).query(async ({ input }) => {
      const snapshot = await fetchPortfolioSnapshot(input?.forceRefresh ?? false);
      await recordStockPriceHistory(snapshot.holdings);
      return snapshot;
    }),
    history: gatedProcedure.query(() => listStockPriceHistory())
  }),
  bonds: router({
    snapshot: gatedProcedure.input(z.object({ forceRefresh: z.boolean() }).optional()).query(({ input }) => fetchBondSnapshot(input?.forceRefresh ?? false))
  }),
  providentFund: router({
    snapshot: gatedProcedure.input(z.object({ forceRefresh: z.boolean() }).optional()).query(({ input }) => fetchProvidentFundSnapshot(input?.forceRefresh ?? false))
  })
});

// server/_core/context.ts
async function createContext(opts) {
  return {
    req: opts.req,
    res: opts.res
  };
}

// server/_core/app.ts
function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// server/_core/vercelEntry.ts
var vercelEntry_default = createApiApp();
export {
  vercelEntry_default as default
};
