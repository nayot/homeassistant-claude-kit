import { useEffect, useState, useRef } from "react";
import { useHass } from "@hakit/core";
import { WEATHER_FORECAST } from "../lib/entities";

export interface ForecastEntry {
  datetime: string;
  condition: string;
  temperature: number;
  precipitation: number;
  precipitation_probability?: number;
  wind_speed: number;
  wind_bearing: number;
  humidity?: number;
  cloud_coverage?: number;
  uv_index?: number;
}

const POLL_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Fetches hourly weather forecast via `weather.get_forecasts` service call.
 * Falls back gracefully when no data is available.
 */
export function useWeatherForecast(): ForecastEntry[] {
  const connection = useHass((s) => s.connection);
  const [forecast, setForecast] = useState<ForecastEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!connection) return;

    let cancelled = false;

    async function fetch() {
      if (!connection || cancelled) return;
      try {
        const result = await connection.sendMessagePromise<{
          response: Record<string, { forecast: ForecastEntry[] }>;
        }>({
          type: "call_service",
          domain: "weather",
          service: "get_forecasts",
          service_data: { type: "hourly" },
          target: { entity_id: WEATHER_FORECAST },
          return_response: true,
        });
        if (!cancelled) {
          const entries = result?.response?.[WEATHER_FORECAST]?.forecast ?? [];
          setForecast(entries);
        }
      } catch {
        if (!cancelled) setForecast([]);
      }
      if (!cancelled) {
        timerRef.current = setTimeout(fetch, POLL_INTERVAL_MS);
      }
    }

    fetch();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [connection]);

  return forecast;
}
