import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { assetPriceHistory } from "../drizzle/schema";
import { buildStockHistoryRecords, shouldInsertStockHistory } from "../shared/assetHistory";
import type { Holding } from "./portfolio";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // prepare: false is required for Supabase's pooled (pgbouncer) connection.
      const client = postgres(process.env.DATABASE_URL, { prepare: false });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function recordStockPriceHistory(holdings: Holding[]) {
  const db = await getDb();
  if (!db) return;

  const records = buildStockHistoryRecords(holdings);
  if (records.length === 0) return;

  const seenRecords = new Set<string>();

  for (const record of records) {
    const existing = await db
      .select({ id: assetPriceHistory.id })
      .from(assetPriceHistory)
      .where(and(eq(assetPriceHistory.assetName, record.assetName), eq(assetPriceHistory.sourceDate, record.sourceDate)))
      .limit(1);

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
      sourceDate: record.sourceDate,
    });
  }
}

export async function listStockPriceHistory() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(assetPriceHistory).orderBy(asc(assetPriceHistory.assetName), asc(assetPriceHistory.sourceDate));
}

// TODO: add feature queries here as your schema grows.
