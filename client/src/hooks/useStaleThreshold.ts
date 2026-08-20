import { useEffect, useState } from "react";

const STORAGE_KEY = "portfolio-monitor.stale-days";
const DEFAULT_STALE_DAYS = 2;

function readThreshold(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(stored) && stored >= 1 && stored <= 30 ? stored : DEFAULT_STALE_DAYS;
  } catch {
    return DEFAULT_STALE_DAYS;
  }
}

export function useStaleThreshold() {
  const [staleDays, setStaleDays] = useState(readThreshold);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(staleDays));
    } catch {}
  }, [staleDays]);

  return [staleDays, setStaleDays] as const;
}
