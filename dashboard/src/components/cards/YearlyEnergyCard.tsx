import { Icon } from "@iconify/react";
import { useYearlyEnergyStats } from "../../hooks/useYearlyEnergyStats";
import type { EnergyConfig } from "../../lib/entities";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface YearlyEnergyCardProps {
  config: EnergyConfig;
}

export function YearlyEnergyCard({ config }: YearlyEnergyCardProps) {
  const stats = useYearlyEnergyStats(config.loadEnergy);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const year = now.getFullYear();

  const statMap = new Map(stats.map((s) => [s.month, s.kwh]));
  const totalKwh = stats.reduce((s, m) => s + m.kwh, 0);
  const maxKwh = stats.length > 0 ? Math.max(...stats.map((s) => s.kwh)) : 1;
  const monthsWithData = stats.length;
  const avgKwh = monthsWithData > 0 ? totalKwh / monthsWithData : null;

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-text-secondary">This Year</h2>
        <span className="text-xs text-text-dim">{year}</span>
      </div>

      {/* Total */}
      <div className="flex items-baseline gap-2 mb-4">
        <Icon icon="mdi:lightning-bolt" width={20} className="text-accent-warm mb-0.5" />
        <span className="text-3xl font-semibold tabular-nums">
          {totalKwh.toFixed(0)}{" "}
          <span className="text-base font-normal text-text-secondary">kWh</span>
        </span>
      </div>

      {/* Bar chart */}
      {stats.length > 0 ? (
        <MonthBarChart
          allMonths={ALL_MONTHS}
          statMap={statMap}
          maxKwh={maxKwh}
          currentMonth={currentMonth}
        />
      ) : (
        <div className="h-24 flex items-center justify-center text-xs text-text-dim">
          Loading yearly data…
        </div>
      )}

      {/* Footer */}
      {avgKwh !== null && (
        <div className="mt-3 flex justify-between text-xs text-text-dim">
          <span>{avgKwh.toFixed(0)} kWh / month avg</span>
          <span>~{Math.round(avgKwh * 12)} kWh / year est.</span>
        </div>
      )}
    </div>
  );
}

interface MonthBarChartProps {
  allMonths: number[];
  statMap: Map<number, number>;
  maxKwh: number;
  currentMonth: number;
}

function MonthBarChart({ allMonths, statMap, maxKwh, currentMonth }: MonthBarChartProps) {
  return (
    <div>
      {/* Bars */}
      <div className="flex items-end gap-[3px]" style={{ height: 80 }}>
        {allMonths.map((month) => {
          const kwh = statMap.get(month) ?? 0;
          const heightPct = maxKwh > 0 ? (kwh / maxKwh) * 100 : 0;
          const isCurrent = month === currentMonth;
          const isFuture = month > currentMonth;

          return (
            <div
              key={month}
              className="flex flex-1 flex-col items-center justify-end"
              style={{ height: "100%" }}
            >
              {kwh > 0 && (
                <div
                  className={
                    isCurrent
                      ? "w-full rounded-t-[2px] bg-accent"
                      : "w-full rounded-t-[2px] bg-accent-warm/75"
                  }
                  style={{ height: `${heightPct}%` }}
                />
              )}
              {kwh === 0 && !isFuture && (
                <div className="w-full rounded-t-[2px] bg-white/5" style={{ height: 2 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Month labels */}
      <div className="flex mt-1.5 gap-[3px]">
        {allMonths.map((month) => (
          <div key={month} className="flex-1 text-center">
            <span
              className={`text-[8px] leading-none ${
                month === currentMonth ? "text-accent font-medium" : "text-text-dim"
              }`}
            >
              {MONTH_LABELS[month - 1]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
