import { Icon } from "@iconify/react";
import { useMonthlyEnergyStats } from "../../hooks/useMonthlyEnergyStats";
import type { EnergyConfig } from "../../lib/entities";

interface MonthlyEnergyCardProps {
  config: EnergyConfig;
}

export function MonthlyEnergyCard({ config }: MonthlyEnergyCardProps) {
  const stats = useMonthlyEnergyStats(config.loadEnergy);

  const now = new Date();
  const todayDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const totalKwh = stats.reduce((s, d) => s + d.kwh, 0);
  const daysWithData = stats.length;
  const avgKwh = daysWithData > 0 ? totalKwh / daysWithData : null;
  const projectedKwh = avgKwh !== null ? avgKwh * daysInMonth : null;

  // Build a full grid of days 1..daysInMonth
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const statMap = new Map(stats.map((s) => [s.day, s.kwh]));
  const maxKwh = stats.length > 0 ? Math.max(...stats.map((s) => s.kwh)) : 1;

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-text-secondary">This Month</h2>
        <span className="text-xs text-text-dim">{monthLabel}</span>
      </div>

      {/* Total */}
      <div className="flex items-baseline gap-2 mb-4">
        <Icon icon="mdi:lightning-bolt" width={20} className="text-accent-warm mb-0.5" />
        <span className="text-3xl font-semibold tabular-nums">
          {totalKwh.toFixed(1)}{" "}
          <span className="text-base font-normal text-text-secondary">kWh</span>
        </span>
      </div>

      {/* Bar chart */}
      {stats.length > 0 ? (
        <BarChart
          allDays={allDays}
          statMap={statMap}
          maxKwh={maxKwh}
          todayDay={todayDay}
        />
      ) : (
        <div className="h-24 flex items-center justify-center text-xs text-text-dim">
          Loading monthly data…
        </div>
      )}

      {/* Footer stats */}
      {avgKwh !== null && (
        <div className="mt-3 flex justify-between text-xs text-text-dim">
          <span>{avgKwh.toFixed(1)} kWh / day avg</span>
          {projectedKwh !== null && (
            <span>~{Math.round(projectedKwh)} kWh projected</span>
          )}
        </div>
      )}
    </div>
  );
}

interface BarChartProps {
  allDays: number[];
  statMap: Map<number, number>;
  maxKwh: number;
  todayDay: number;
}

function BarChart({ allDays, statMap, maxKwh, todayDay }: BarChartProps) {
  // Which day labels to show: 1, multiples of 5, and today
  const showLabel = new Set<number>([1, todayDay]);
  for (let d = 5; d <= allDays.length; d += 5) showLabel.add(d);

  return (
    <div>
      {/* Bars */}
      <div className="flex items-end gap-[1.5px]" style={{ height: 80 }}>
        {allDays.map((day) => {
          const kwh = statMap.get(day) ?? 0;
          const heightPct = maxKwh > 0 ? (kwh / maxKwh) * 100 : 0;
          const isToday = day === todayDay;
          const isFuture = day > todayDay;

          return (
            <div
              key={day}
              className="flex flex-1 flex-col items-center justify-end"
              style={{ height: "100%" }}
            >
              {kwh > 0 && (
                <div
                  className={
                    isToday
                      ? "w-full rounded-t-[2px] bg-accent"
                      : "w-full rounded-t-[2px] bg-accent-warm/75"
                  }
                  style={{ height: `${heightPct}%` }}
                />
              )}
              {kwh === 0 && !isFuture && (
                /* past day with zero data — show thin placeholder */
                <div className="w-full rounded-t-[2px] bg-white/5" style={{ height: 2 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div className="flex mt-1 gap-[1.5px]">
        {allDays.map((day) => (
          <div key={day} className="flex-1 text-center">
            {showLabel.has(day) && (
              <span
                className={`text-[8px] leading-none ${
                  day === todayDay ? "text-accent font-medium" : "text-text-dim"
                }`}
              >
                {day}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
