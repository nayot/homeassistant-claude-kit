import { lazy, Suspense, useState } from "react";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import type { RoomConfig } from "../../lib/areas";
import type { AcConfig } from "../../lib/acUnits";
import { parseNumericState } from "../../lib/format";
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
  const entity = entities[ac.entity];
  const mode = entity?.state ?? "unavailable";
  const hvacAction = entity?.attributes?.hvac_action as string | undefined;
  const currentTemp = parseNumericState(entity?.attributes?.current_temperature as string | undefined);
  const targetTemp = parseNumericState(entity?.attributes?.temperature as string | undefined);
  const toggleOn = ac.manualEntity ? entities[ac.manualEntity]?.state === "on" : false;
  const isTurningOff = !toggleOn && mode !== "off" && mode !== "unavailable";
  const isOff = mode === "off" || mode === "unavailable";

  const meta = HVAC_META[mode] ?? HVAC_META.unavailable;
  const activeAction = hvacAction && hvacAction !== "idle" && hvacAction !== "off" ? hvacAction : null;
  const color = activeAction ? (ACTION_COLOR[activeAction] ?? meta.color) : meta.color;

  return (
    <button
      onClick={onTap}
      className="flex w-full items-center justify-between rounded-xl bg-bg-elevated p-3 text-left hover:bg-white/8 active:bg-white/8"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon icon={meta.icon} width={15} className={color} />
          <span className="text-sm font-medium">{ac.label}</span>
          {activeAction && (
            <span className={`text-xs capitalize ${color}`}>{activeAction}</span>
          )}
        </div>
        <div className={`mt-0.5 text-xs ${toggleOn ? "text-sky-400" : isTurningOff ? "text-accent-warm" : "text-text-dim"}`}>
          {toggleOn ? "On" : isTurningOff ? "Turning off" : "Off"}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {currentTemp !== null && (
          <span className="tabular-nums text-sm">{currentTemp.toFixed(1)}°</span>
        )}
        {!isOff && targetTemp !== null && (
          <div className="text-right">
            <div className="tabular-nums text-xs text-text-dim">{targetTemp.toFixed(0)}° target</div>
          </div>
        )}
        <Icon icon="mdi:chevron-right" width={16} className="text-text-dim" />
      </div>
    </button>
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
