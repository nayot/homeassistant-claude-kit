import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";

// Returns the current state string for an entity, or "" if unavailable/not found.
export function useEntityState(entityId: string): string {
  const state = useHass((s) => (s.entities as HassEntities)[entityId]?.state);
  return state ?? "";
}
