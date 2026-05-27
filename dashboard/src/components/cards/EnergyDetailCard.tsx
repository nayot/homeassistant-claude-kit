import { useMemo } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { toWatts, formatPower, parseNumericState } from "../../lib/format";
import { useHistory } from "../../hooks/useHistory";
import { Sparkline } from "../charts/Sparkline";
import type { EnergyConfig } from "../../lib/entities";

interface EnergyDetailCardProps {
  config: EnergyConfig;
}

export function EnergyDetailCard({ config }: EnergyDetailCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const loadE = entities[config.loadPower];
  const loadW = toWatts(loadE?.state, loadE?.attributes?.unit_of_measurement as string) ?? 0;

  const currentKwh = parseNumericState(entities[config.loadEnergy]?.state);
  const voltage     = parseNumericState(entities[config.loadVoltage]?.state);
  const currentA    = parseNumericState(entities[config.loadCurrent]?.state);
  const powerFactor = parseNumericState(entities[config.loadPowerFactor]?.state);
  const frequency   = parseNumericState(entities[config.loadFrequency]?.state);

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const powerHistory  = useHistory(config.loadPower, startOfToday);
  const energyHistory = useHistory(config.loadEnergy, startOfToday);

  const minW = powerHistory.length > 0 ? Math.min(...powerHistory.map((p) => p.value)) : null;
  const maxW = powerHistory.length > 0 ? Math.max(...powerHistory.map((p) => p.value)) : null;

  const todayKwh = useMemo(() => {
    if (currentKwh === null || energyHistory.length === 0) return null;
    const startKwh = energyHistory[0].value;
    const delta = currentKwh - startKwh;
    return delta >= 0 ? delta : null;
  }, [currentKwh, energyHistory]);

  const hasStats = voltage !== null || currentA !== null || powerFactor !== null || frequency !== null;

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-text-secondary">Power</h2>
        <span className="flex items-center gap-1.5 text-xs text-text-dim">
          <Icon icon="mdi:clock-outline" width={12} />
          Today
        </span>
      </div>

      {/* Current load */}
      <div className="flex items-baseline gap-2 mb-3">
        <Icon icon="mdi:home-lightning-bolt" width={22} className="text-accent-warm mb-0.5" />
        <span className="text-3xl font-semibold tabular-nums">{formatPower(loadW)}</span>
        <span className="text-xs text-text-dim">now</span>
      </div>

      {/* 24 h power sparkline */}
      {powerHistory.length > 1 ? (
        <>
          <Sparkline data={powerHistory} color="var(--color-accent-warm)" height={56} />
          {minW !== null && maxW !== null && (
            <div className="flex justify-between mt-1.5 text-[10px] tabular-nums text-text-dim">
              <span>{formatPower(minW)} min</span>
              <span>{formatPower(maxW)} peak</span>
            </div>
          )}
        </>
      ) : (
        <div className="h-14 flex items-center justify-center text-xs text-text-dim">
          Loading history…
        </div>
      )}

      {/* Today's kWh */}
      {todayKwh !== null && (
        <>
          <div className="my-3 h-px bg-white/5" />
          <div className="flex items-baseline gap-2">
            <Icon icon="mdi:lightning-bolt" width={16} className="text-accent-warm mb-0.5" />
            <span className="text-xl font-semibold tabular-nums">{todayKwh.toFixed(2)} kWh</span>
            <span className="text-xs text-text-dim">used today</span>
          </div>
        </>
      )}

      {/* Electrical stats */}
      {hasStats && (
        <>
          <div className="my-3 h-px bg-white/5" />
          <div className="grid grid-cols-4 gap-2 text-center">
            {voltage !== null && (
              <StatTile label="Voltage" value={`${Math.round(voltage)} V`} icon="mdi:sine-wave" />
            )}
            {currentA !== null && (
              <StatTile label="Current" value={`${currentA.toFixed(1)} A`} icon="mdi:current-ac" />
            )}
            {powerFactor !== null && (
              <StatTile label="P. Factor" value={powerFactor.toFixed(2)} icon="mdi:angle-acute" />
            )}
            {frequency !== null && (
              <StatTile label="Freq" value={`${frequency.toFixed(1)} Hz`} icon="mdi:waves" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-bg-elevated/40 px-2 py-2">
      <Icon icon={icon} width={14} className="text-text-dim" />
      <span className="text-[10px] font-medium tabular-nums text-text-primary leading-none">{value}</span>
      <span className="text-[9px] text-text-dim leading-none">{label}</span>
    </div>
  );
}
