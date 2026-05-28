import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import type { HeaderConfig } from "../../lib/entities";
import { formatTemp } from "../../lib/format";

interface HeaderProps {
  config: HeaderConfig;
}

export function Header({ config }: HeaderProps) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const outdoorTemp = entities[config.outdoorTemp]?.state;
  const weather = entities[config.weather]?.state;

  return (
    <header className="sticky top-0 z-30 flex min-w-0 items-center justify-end gap-2 bg-bg-primary/80 px-4 py-2 text-xs backdrop-blur-md">
      {formatTemp(outdoorTemp) && (
        <span className="truncate text-text-secondary">
          {formatTemp(outdoorTemp)}C
          {weather ? ` · ${weather}` : ""}
        </span>
      )}
    </header>
  );
}
