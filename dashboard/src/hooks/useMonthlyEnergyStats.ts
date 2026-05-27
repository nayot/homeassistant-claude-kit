import { useEffect, useState, useRef } from "react";
import { useHass } from "@hakit/core";

export interface DayStat {
  day: number;  // 1-31 (local calendar day)
  kwh: number;
}

const POLL_MS = 30 * 60 * 1000;

/**
 * Queries HA long-term statistics for daily energy consumption (kWh) for
 * the current calendar month using `recorder/statistics_during_period`.
 * Works on sensors with state_class=total_increasing + device_class=energy.
 */
export function useMonthlyEnergyStats(entityId: string): DayStat[] {
  const connection = useHass((s) => s.connection);
  const [stats, setStats] = useState<DayStat[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!connection || !entityId) return;

    let cancelled = false;

    async function load() {
      if (cancelled || !connection) return;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      try {
        const result = await connection.sendMessagePromise<
          Record<string, Array<{ start: string; change: number | null }>>
        >({
          type: "recorder/statistics_during_period",
          start_time: startOfMonth.toISOString(),
          statistic_ids: [entityId],
          period: "day",
          units: { energy: "kWh" },
          types: ["change"],
        });

        if (!cancelled) {
          const entries = result?.[entityId] ?? [];
          const dayStats: DayStat[] = entries
            .filter((e) => e.change !== null && e.change >= 0)
            .map((e) => ({
              day: new Date(e.start).getDate(),
              kwh: e.change!,
            }));
          setStats(dayStats);
        }
      } catch {
        // Statistics not available — leave empty so parent can show placeholder
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
