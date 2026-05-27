import { useEffect, useState, useRef } from "react";
import { useHass } from "@hakit/core";

export interface MonthStat {
  month: number;  // 1-12
  kwh: number;
}

const POLL_MS = 60 * 60 * 1000;

/**
 * Queries HA long-term statistics for monthly energy consumption (kWh) for
 * the current calendar year using `recorder/statistics_during_period`.
 */
export function useYearlyEnergyStats(entityId: string): MonthStat[] {
  const connection = useHass((s) => s.connection);
  const [stats, setStats] = useState<MonthStat[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!connection || !entityId) return;

    let cancelled = false;

    async function load() {
      if (cancelled || !connection) return;

      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      try {
        const result = await connection.sendMessagePromise<
          Record<string, Array<{ start: string; change: number | null }>>
        >({
          type: "recorder/statistics_during_period",
          start_time: startOfYear.toISOString(),
          statistic_ids: [entityId],
          period: "month",
          units: { energy: "kWh" },
          types: ["change"],
        });

        if (!cancelled) {
          const entries = result?.[entityId] ?? [];
          const monthStats: MonthStat[] = entries
            .filter((e) => e.change !== null && e.change >= 0)
            .map((e) => ({
              month: new Date(e.start).getMonth() + 1,
              kwh: e.change!,
            }));
          setStats(monthStats);
        }
      } catch {
        // Statistics not available
      }

      if (!cancelled) {
        timerRef.current = setTimeout(load, POLL_MS);
      }
    }

    load();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [connection, entityId]);

  return stats;
}
