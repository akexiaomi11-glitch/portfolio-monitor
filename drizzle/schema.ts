import { bigint, decimal, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const assetPriceHistory = pgTable("assetPriceHistory", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  assetName: varchar("assetName", { length: 160 }).notNull(),
  assetType: text("assetType", { enum: ["stock_or_fund"] }).notNull().default("stock_or_fund"),
  currentValue: decimal("currentValue", { precision: 20, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 20, scale: 2 }).notNull(),
  pnl: decimal("pnl", { precision: 20, scale: 2 }).notNull(),
  pnlPercent: decimal("pnlPercent", { precision: 12, scale: 4 }).notNull(),
  dailyChangePercent: decimal("dailyChangePercent", { precision: 12, scale: 4 }).notNull(),
  sourceDate: timestamp("sourceDate", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recordedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("asset_price_history_asset_date_unique").on(table.assetName, table.sourceDate),
]);

export type AssetPriceHistory = typeof assetPriceHistory.$inferSelect;
export type InsertAssetPriceHistory = typeof assetPriceHistory.$inferInsert;
