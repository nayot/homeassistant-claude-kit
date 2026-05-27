const CONDITION_MAP: Record<string, { day: string; night: string; label: string }> = {
  "clear-night":      { day: "meteocons:clear-day",        night: "meteocons:clear-night",     label: "Clear" },
  cloudy:             { day: "meteocons:cloudy",            night: "meteocons:cloudy",           label: "Cloudy" },
  exceptional:        { day: "meteocons:not-available",     night: "meteocons:not-available",    label: "Exceptional" },
  fog:                { day: "meteocons:fog",               night: "meteocons:fog-night",        label: "Foggy" },
  hail:               { day: "meteocons:hail",              night: "meteocons:hail",             label: "Hail" },
  lightning:          { day: "meteocons:thunderstorms",     night: "meteocons:thunderstorms-night", label: "Thunder" },
  "lightning-rainy":  { day: "meteocons:thunderstorms-rain", night: "meteocons:thunderstorms-rain-night", label: "Thunder & Rain" },
  partlycloudy:       { day: "meteocons:partly-cloudy-day", night: "meteocons:partly-cloudy-night", label: "Partly Cloudy" },
  pouring:            { day: "meteocons:rain",              night: "meteocons:rain",             label: "Pouring" },
  rainy:              { day: "meteocons:drizzle",           night: "meteocons:drizzle-night",    label: "Rainy" },
  snowy:              { day: "meteocons:snow",              night: "meteocons:snow-night",       label: "Snowy" },
  "snowy-rainy":      { day: "meteocons:sleet",             night: "meteocons:sleet-night",      label: "Sleet" },
  sunny:              { day: "meteocons:clear-day",         night: "meteocons:clear-night",      label: "Sunny" },
  windy:              { day: "meteocons:wind",              night: "meteocons:wind",             label: "Windy" },
  "windy-variant":    { day: "meteocons:wind",              night: "meteocons:wind",             label: "Windy" },
};

export function weatherIcon(condition: string, isNight = false): string {
  const entry = CONDITION_MAP[condition];
  if (!entry) return isNight ? "meteocons:clear-night" : "meteocons:clear-day";
  return isNight ? entry.night : entry.day;
}

export function conditionLabel(condition: string): string {
  return CONDITION_MAP[condition]?.label ?? "";
}
