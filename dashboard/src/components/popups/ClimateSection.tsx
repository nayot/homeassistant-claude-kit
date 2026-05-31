import { lazy, Suspense, useState } from "react";
import { useHass } from "@hakit/core";
import { callService } from "home-assistant-js-websocket";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import type { RoomConfig } from "../../lib/areas";
import type { AcConfig } from "../../lib/acUnits";
import { parseNumericState } from "../../lib/format";
import { useControlCommit } from "../../lib/useControlCommit";
import { Section } from "./RoomPopupShared";

const AcControlPopup = lazy(() =>
  import("./AcControlPopup").then((m) => ({ default: m.AcControlPopup })),
);

interface ClimateSectionProps {
  room: RoomConfig;
  entities: HassEntities;
  acUnits: AcConfig[];
  // Legacy props kept for call-site compatibility — unused in AC-only setups
  climateModeEntity?: string;
  nextTransitionEntity?: string;
}

const HVAC_META: Record<string, { icon: string; color: string; label: string }> = {
  cool:        { icon: "mdi:snowflake",      color: "text-sky-400",        label: "Cool" },
  heat:        { icon: "mdi:fire",           color: "text-accent-warm",    label: "Heat" },
  heat_cool:   { icon: "mdi:autorenew",      color: "text-accent",         label: "Auto" },
  fan_only:    { icon: "mdi:fan",            color: "text-text-secondary", label: "Fan" },
  dry:         { icon: "mdi:water-percent",  color: "text-cyan-400",       label: "Dry" },
  off:         { icon: "mdi:power",          color: "text-text-dim",       label: "Off" },
  unavailable: { icon: "mdi:help-circle",    color: "text-text-dim",       label: "—" },
};

const ACTION_COLOR: Record<string, string> = {
  cooling: "text-sky-400",
  heating: "text-accent-warm",
  fan:     "text-text-secondary",
  drying:  "text-cyan-400",
};

export function ClimateSection({ room, entities, acUnits }: ClimateSectionProps) {
  const [acPopup, setAcPopup] = useState<AcConfig | null>(null);

  const roomAcUnits = (room.climate ?? [])
    .map((id) => acUnits.find((ac) => ac.entity === id))
    .filter((ac): ac is AcConfig => ac !== undefined);

  const unmapped = (room.climate ?? []).filter(
    (id) => !acUnits.some((ac) => ac.entity === id),
  );

  if (roomAcUnits.length === 0 && unmapped.length === 0) return null;

  return (
    <Section title="Climate">
      <div className="space-y-2">
        {roomAcUnits.map((ac) => (
          <AcRow key={ac.entity} ac={ac} entities={entities} onTap={() => setAcPopup(ac)} />
        ))}
        {unmapped.map((id) => (
          <BasicClimateRow key={id} entityId={id} entities={entities} />
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
    </Section>
  );
}

function AcRow({
  ac,
  entities,
  onTap,
}: {
  ac: AcConfig;
  entities: HassEntities;
  onTap: () => void;
}) {
  const connection = useHass((s) => s.connection);
  const entity = entities[ac.entity];
  const mode = entity?.state ?? "unavailable";
  const hvacAction = entity?.attributes?.hvac_action as string | undefined;
  const currentTemp = parseNumericState(entity?.attributes?.current_temperature as string | undefined);
  const targetTemp = parseNumericState(entity?.attributes?.temperature as string | undefined);

  const isOff = mode === "off" || mode === "unavailable";
  const isCoolingDown = mode === "fan_only";
  const isOn = !isOff && !isCoolingDown;

  const meta = HVAC_META[mode] ?? HVAC_META.unavailable;
  const activeAction = hvacAction && hvacAction !== "idle" && hvacAction !== "off" ? hvacAction : null;
  const iconColor = activeAction ? (ACTION_COLOR[activeAction] ?? meta.color) : meta.color;

  const powerControl = useControlCommit<boolean>(
    !isOff,
    (on) => {
      if (!connection) return;
      callService(connection, "climate", on ? "turn_on" : "turn_off", {}, { entity_id: ac.entity });
    },
    { debounceMs: 200 },
  );

  const handlePowerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (powerControl.phase !== "idle") return;
    powerControl.set(isOff);
    powerControl.commit();
  };

  const statusColor = powerControl.phase !== "idle"
    ? (powerControl.displayValue ? "text-sky-400" : "text-yellow-400")
    : isOn ? "text-sky-400"
    : isCoolingDown ? "text-yellow-400"
    : "text-text-dim";

  const statusLabel = powerControl.phase !== "idle"
    ? (powerControl.displayValue ? "Turning on" : "Turning off")
    : isOn ? "On"
    : isCoolingDown ? "Turning off"
    : "Off";

  return (
    <div
      onClick={onTap}
      className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-bg-elevated p-3 hover:bg-white/8 active:bg-white/8"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={handlePowerToggle}
          className={`relative shrink-0 rounded-full p-1 -m-1 transition-colors after:absolute after:content-[''] after:-inset-2 ${powerControl.phase !== "idle" ? "pointer-events-none animate-pulse" : "hover:bg-white/10 active:bg-white/10 active:scale-95"}`}
        >
          <Icon icon={meta.icon} width={15} className={iconColor} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{ac.label}</span>
            {activeAction && (
              <span className={`text-xs capitalize ${iconColor}`}>{activeAction}</span>
            )}
          </div>
          <div className={`mt-0.5 text-xs ${statusColor}`}>{statusLabel}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {currentTemp !== null && (
          <span className="tabular-nums text-sm">{currentTemp.toFixed(1)}°</span>
        )}
        {!isOff && targetTemp !== null && (
          <div className="tabular-nums text-xs text-text-dim">{targetTemp.toFixed(0)}° target</div>
        )}
        <Icon icon="mdi:chevron-right" width={16} className="text-text-dim" />
      </div>
    </div>
  );
}

function BasicClimateRow({
  entityId,
  entities,
}: {
  entityId: string;
  entities: HassEntities;
}) {
  const entity = entities[entityId];
  const mode = entity?.state ?? "unavailable";
  const meta = HVAC_META[mode] ?? HVAC_META.unavailable;
  const name = entity?.attributes?.friendly_name as string | undefined ?? entityId.split(".")[1];

  return (
    <div className="flex items-center justify-between rounded-xl bg-bg-elevated p-3">
      <div className="flex items-center gap-2">
        <Icon icon={meta.icon} width={15} className={meta.color} />
        <span className="text-sm">{name}</span>
      </div>
      <span className={`text-xs capitalize ${meta.color}`}>{meta.label}</span>
    </div>
  );
}
