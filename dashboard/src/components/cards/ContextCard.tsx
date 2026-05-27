import { useRef, useState, useEffect } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import type { ContextConfig } from "../../lib/entities";
import { parseNumericState } from "../../lib/format";
import { weatherIcon, conditionLabel } from "../../lib/weatherIcons";
import { useWeatherForecast, type ForecastEntry } from "../../hooks/useWeatherForecast";
import { useMinuteTick } from "../../hooks/useMinuteTick";

export function ContextCard({ config }: { config: ContextConfig }) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const now = useMinuteTick(true);

  const timeOfDay = entities[config.timeOfDay]?.state ?? "day";
  const isNight = timeOfDay === "night" || timeOfDay === "evening";

  const weatherState = entities[config.weather]?.state ?? "sunny";
  const weatherAttrs = entities[config.weather]?.attributes ?? {};
  const outdoorTemp = parseNumericState(entities[config.outdoorTemp]?.state);
  const humidity = parseNumericState(entities[config.outdoorHumidity]?.state);
  const windSpeed = weatherAttrs.wind_speed as number | undefined;
  const windBearing = weatherAttrs.wind_bearing as number | undefined;
  const pressure = parseNumericState(entities[config.indoorPressure]?.state);

  const forecast = useWeatherForecast();
  // 3-hour intervals: take every 3rd hourly entry, up to 48 h
  const forecast3h = forecast.filter((_, i) => i % 3 === 0).slice(0, 16);

  const nowDate = new Date(now);
  const dateLabel = nowDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const timeLabel = nowDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-5">
      {/* Date & time */}
      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-sm font-medium text-text-secondary">{dateLabel}</span>
        <span className="text-2xl font-light tabular-nums text-text-primary">{timeLabel}</span>
      </div>

      {/* Main weather row */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: current temperature */}
        <div>
          <div className="text-5xl font-light tabular-nums leading-none">
            {outdoorTemp !== null ? `${outdoorTemp.toFixed(1)}°` : "—"}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
            {humidity !== null && (
              <span className="flex items-center gap-1">
                <Icon icon="meteocons:humidity" width={16} />
                {Math.round(humidity)}%
              </span>
            )}
            {windSpeed != null && (
              <span className="flex items-center gap-1">
                <Icon icon="meteocons:wind" width={16} />
                {Math.round(windSpeed)} km/h
                {windBearing != null && (
                  <Icon
                    icon="mdi:navigation"
                    width={11}
                    className="text-text-dim"
                    style={{ transform: `rotate(${windBearing}deg)` }}
                  />
                )}
              </span>
            )}
            {pressure !== null && (
              <span className="flex items-center gap-1">
                <Icon icon="meteocons:barometer" width={16} />
                {Math.round(pressure)} hPa
              </span>
            )}
          </div>
        </div>

        {/* Right: weather icon + condition */}
        <div className="flex flex-col items-center gap-1">
          <Icon icon={weatherIcon(weatherState, isNight)} width={64} />
          <span className="text-xs text-text-secondary">{conditionLabel(weatherState)}</span>
        </div>
      </div>

      {/* 3-hour forecast strip */}
      {forecast3h.length > 0 && (
        <HourlyForecast entries={forecast3h} />
      )}
    </div>
  );
}

function HourlyForecast({ entries }: { entries: ForecastEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [entries.length]);

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  return (
    <div className="relative mt-4 -mx-1">
      {canScrollLeft && (
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-0 bottom-0 z-10 flex w-7 items-center justify-center bg-linear-to-r from-bg-card to-transparent"
        >
          <Icon icon="mdi:chevron-left" width={18} className="text-text-dim" />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto px-1 scrollbar-none"
      >
        {entries.map((entry) => {
          const date = new Date(entry.datetime);
          const hour = date.getHours();
          const isToday = date.toDateString() === new Date().toDateString();
          const entryIsNight = hour >= 21 || hour < 6;
          const timeLabel = hour === 0 && !isToday
            ? date.toLocaleDateString(undefined, { weekday: "short" })
            : `${hour.toString().padStart(2, "0")}:00`;

          return (
            <div
              key={entry.datetime}
              className="flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-xs min-w-[64px]"
            >
              <span className="text-text-dim font-medium">{timeLabel}</span>
              <Icon icon={weatherIcon(entry.condition, entryIsNight)} width={32} />
              <span className="font-semibold tabular-nums">{Math.round(entry.temperature)}°</span>
              {entry.wind_speed > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-text-dim tabular-nums">
                  <Icon icon="mdi:weather-windy" width={11} />
                  {Math.round(entry.wind_speed)}
                </span>
              )}
              {(entry.precipitation ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-blue-400 tabular-nums">
                  <Icon icon="mdi:water" width={10} />
                  {entry.precipitation!.toFixed(1)}
                </span>
              )}
              {entry.humidity != null && (
                <span className="text-[10px] text-text-dim tabular-nums">
                  {Math.round(entry.humidity)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-0 bottom-0 z-10 flex w-7 items-center justify-center bg-linear-to-l from-bg-card to-transparent"
        >
          <Icon icon="mdi:chevron-right" width={18} className="text-text-dim" />
        </button>
      )}
    </div>
  );
}
