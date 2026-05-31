import { useState, lazy, Suspense } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import type { AcConfig } from "../lib/acUnits";
import { AC_UNITS } from "../lib/acUnits";
import { parseNumericState } from "../lib/format";

const AcControlPopup = lazy(() =>
  import("../components/popups/AcControlPopup").then((m) => ({ default: m.AcControlPopup })),
);

const HVAC_META: Record<string, { icon: string; color: string; label: string }> = {
  cool:      { icon: "mdi:snowflake",          color: "text-sky-400",       label: "Cool" },
  heat:      { icon: "mdi:fire",               color: "text-accent-warm",   label: "Heat" },
  heat_cool: { icon: "mdi:autorenew",          color: "text-accent",        label: "Auto" },
  fan_only:  { icon: "mdi:fan",               color: "text-text-secondary", label: "Fan" },
  dry:       { icon: "mdi:water-percent",      color: "text-cyan-400",      label: "Dry" },
  off:       { icon: "mdi:power",             color: "text-text-dim",       label: "Off" },
  unavailable: { icon: "mdi:help-circle",     color: "text-text-dim",       label: "Unavailable" },
};

const ACTION_COLOR: Record<string, string> = {
  cooling: "text-sky-400",
  heating: "text-accent-warm",
  fan:     "text-text-secondary",
  drying:  "text-cyan-400",
};

export function ClimateView() {
  const entities = useHass((s) => s.entities) as HassEntities;
  const [acPopup, setAcPopup] = useState<AcConfig | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <h1 className="text-lg font-semibold">Climate</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {AC_UNITS.map((ac) => (
          <AcCard
            key={ac.entity}
            ac={ac}
            entities={entities}
            onTap={() => setAcPopup(ac)}
          />
        ))}
      </div>

      {acPopup && (
        <Suspense fallback={null}>
          <AcControlPopup
            ac={acPopup}
            open={!!acPopup}
            onClose={() => setAcPopup(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

interface AcCardProps {
  ac: AcConfig;
  entities: HassEntities;
  onTap: () => void;
}

function AcCard({ ac, entities, onTap }: AcCardProps) {
  const entity = entities[ac.entity];
  const mode = entity?.state ?? "unavailable";
  const hvacAction = entity?.attributes?.hvac_action as string | undefined;
  const currentTemp = parseNumericState(entity?.attributes?.current_temperature as string | undefined);
  const targetTemp = parseNumericState(entity?.attributes?.temperature as string | undefined);
  // Status derived from the climate entity's mode (matches RoomCard/RoomPopup):
  // fan_only → post-shutdown cooldown ("Turning off"), any active mode → "On", off → "Off".
  const isOff = mode === "off" || mode === "unavailable";
  const isTurningOff = mode === "fan_only";
  const toggleOn = !isOff && !isTurningOff;

  const meta = HVAC_META[mode] ?? HVAC_META.unavailable;
  const activeAction = hvacAction && hvacAction !== "idle" && hvacAction !== "off" ? hvacAction : null;
  const actionColor = activeAction ? (ACTION_COLOR[activeAction] ?? meta.color) : meta.color;
  const isRunning = !!activeAction;

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onTap}
      className="flex flex-col gap-4 rounded-2xl bg-bg-card p-4 text-left transition-colors hover:bg-bg-elevated active:bg-bg-elevated"
    >
      {/* Header: name + mode icon */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium">{ac.label}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Icon icon={meta.icon} width={13} className={actionColor} />
            <span className={`text-xs capitalize ${actionColor}`}>
              {activeAction ? `${meta.label} · ${activeAction}` : meta.label}
            </span>
            {isRunning && (
              <span className={`text-[8px] leading-none animate-pulse ${actionColor}`}>●</span>
            )}
          </div>
        </div>
        <Icon icon="mdi:chevron-right" width={16} className="text-text-dim mt-0.5" />
      </div>

      {/* Temperatures */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-semibold tabular-nums leading-none">
            {currentTemp !== null ? `${currentTemp.toFixed(1)}°` : "—"}
          </div>
          <div className="text-[10px] text-text-dim mt-1">current</div>
        </div>

        <div className="text-right">
          {!isOff && targetTemp !== null && (
            <>
              <div className="text-lg font-medium tabular-nums">{targetTemp.toFixed(0)}°</div>
              <div className="text-[10px] text-text-dim">target</div>
            </>
          )}
          <div className={`text-[10px] mt-1 ${toggleOn ? "text-sky-400" : isTurningOff ? "text-accent-warm" : "text-text-dim"}`}>
            {toggleOn ? "On" : isTurningOff ? "Turning off" : "Off"}
          </div>
        </div>
      </div>
    </motion.button>
  );
}
