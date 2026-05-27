import { useMemo } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { toWatts, formatPower } from "../../lib/format";
import { useHistory } from "../../hooks/useHistory";
import { Sparkline } from "../charts/Sparkline";
import type { ContextConfig } from "../../lib/entities";

interface EnergyCardProps {
  config: ContextConfig;
}

export function EnergyCard({ config }: EnergyCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const loadE = entities[config.loadPower];
  const loadW = toWatts(loadE?.state, loadE?.attributes?.unit_of_measurement as string) ?? 0;

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const loadHistory = useHistory(config.loadPower, startOfToday);

  if (!config.loadPower) return null;

  const minW = loadHistory.length > 0 ? Math.min(...loadHistory.map((p) => p.value)) : null;
  const maxW = loadHistory.length > 0 ? Math.max(...loadHistory.map((p) => p.value)) : null;

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-text-secondary">Energy</h2>
        <span className="flex items-center gap-1.5 text-xs text-text-dim">
          <Icon icon="mdi:clock-outline" width={12} />
          Today
        </span>
      </div>

      {/* Current load */}
      <div className="flex items-baseline gap-2 mb-3">
        <Icon icon="mdi:home-lightning-bolt" width={20} className="text-accent-warm mb-0.5" />
        <span className="text-2xl font-semibold tabular-nums">{formatPower(loadW)}</span>
        <span className="text-xs text-text-dim">now</span>
      </div>

      {/* Sparkline */}
      {loadHistory.length > 1 ? (
        <>
          <Sparkline
            data={loadHistory}
            color="var(--color-accent-warm)"
            height={48}
          />
          {minW !== null && maxW !== null && (
            <div className="flex justify-between mt-1.5 text-[10px] tabular-nums text-text-dim">
              <span>{formatPower(minW)} min</span>
              <span>{formatPower(maxW)} peak</span>
            </div>
          )}
        </>
      ) : (
        <div className="h-12 flex items-center justify-center text-xs text-text-dim">
          Loading history…
        </div>
      )}
    </div>
  );
}
