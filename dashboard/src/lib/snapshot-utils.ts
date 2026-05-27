import type { HassEntities } from "home-assistant-js-websocket";

export function getLastPersonTime(
  entities: HassEntities,
  personSensor: string | undefined,
): Date | null {
  if (!personSensor) return null;
  const entity = entities[personSensor];
  if (!entity?.last_changed) return null;
  if (entity.state === "on") return new Date();
  return new Date(entity.last_changed);
}
