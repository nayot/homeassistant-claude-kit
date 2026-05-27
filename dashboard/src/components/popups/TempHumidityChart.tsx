import { useMemo } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import type { RoomConfig } from "../../lib/areas";
import { useMultiHistory } from "../../hooks/useHistory";
import type { HistoryPoint } from "../../hooks/useHistory";
import { parseNumericState } from "../../lib/format";
import { Sparkline } from "../charts/Sparkline";
import { Section } from "./RoomPopupShared";

const H24 = 24 * 60 * 60 * 1000;

interface TempHumidityChartProps {
  room: RoomConfig;
}

export function TempHumidityChart({ room }: TempHumidityChartProps) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const sensors = useMemo(
    () =>
      [room.temperatureSensor, room.humiditySensor].filter(
        (s): s is string => !!s,
      ),
    // Stable key so re-subscriptions only happen when sensors actually change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.temperatureSensor, room.humiditySensor],
  );

  const startTime = useMemo(
    () => new Date(Date.now() - H24).toISOString(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sensors.join(",")],
  );

  const history = useMultiHistory(sensors, startTime);

  if (sensors.length === 0) return null;

  const tempPoints = room.temperatureSensor
    ? (history[room.temperatureSensor] ?? [])
    : [];
  const humPoints = room.humiditySensor
    ? (history[room.humiditySensor] ?? [])
    : [];

  const currentTemp = room.temperatureSensor
    ? parseNumericState(entities[room.temperatureSensor]?.state)
    : null;
  const currentHum = room.humiditySensor
    ? parseNumericState(entities[room.humiditySensor]?.state)
    : null;

  const hasAnyData = tempPoints.length > 1 || humPoints.length > 1;

  return (
    <Section title="Environment">
      <div className="rounded-2xl bg-bg-elevated overflow-hidden">
        {room.temperatureSensor && (
          <ChartRow
            label="Temperature"
            value={currentTemp !== null ? `${currentTemp.toFixed(1)}°` : "—"}
            points={tempPoints}
            color="var(--color-accent-warm)"
            formatVal={(v) => `${v.toFixed(1)}°`}
            loading={!hasAnyData}
            divider={!!(room.humiditySensor)}
          />
        )}
        {room.humiditySensor && (
          <ChartRow
            label="Humidity"
            value={currentHum !== null ? `${Math.round(currentHum)}%` : "—"}
            points={humPoints}
            color="var(--color-accent)"
            formatVal={(v) => `${Math.round(v)}%`}
            loading={!hasAnyData}
            divider={false}
          />
        )}
      </div>
    </Section>
  );
}

interface ChartRowProps {
  label: string;
  value: string;
  points: HistoryPoint[];
  color: string;
  formatVal: (v: number) => string;
  loading: boolean;
  divider: boolean;
}

function ChartRow({ label, value, points, color, formatVal, loading, divider }: ChartRowProps) {
  const minVal = points.length > 0 ? Math.min(...points.map((p) => p.value)) : null;
  const maxVal = points.length > 0 ? Math.max(...points.map((p) => p.value)) : null;

  return (
    <div className={`px-4 pt-3 pb-3 ${divider ? "border-b border-white/6" : ""}`}>
      {/* Header row: label + current value */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs text-text-dim">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>

      {/* Sparkline or loading state */}
      {loading ? (
        <div className="h-10 flex items-center justify-center">
          <span className="text-xs text-text-dim">Loading…</span>
        </div>
      ) : points.length > 1 ? (
        <>
          <Sparkline data={points} color={color} height={40} />
          {/* Min / max annotation */}
          {minVal !== null && maxVal !== null && (
            <div className="flex justify-between mt-1">
              <span className="text-[10px] tabular-nums text-text-dim">
                {formatVal(minVal)}
              </span>
              <span className="text-[10px] text-text-dim">24h</span>
              <span className="text-[10px] tabular-nums text-text-dim">
                {formatVal(maxVal)}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="h-10 flex items-center justify-center">
          <span className="text-xs text-text-dim">No data</span>
        </div>
      )}
    </div>
  );
}
