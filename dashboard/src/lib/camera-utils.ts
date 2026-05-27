import type { HassEntities } from "home-assistant-js-websocket";

// Builds an image URL from a camera entity's state (entity_picture attribute).
export function buildImageUrl(
  entity: HassEntities[string] | undefined,
): string | null {
  if (!entity) return null;
  const pic = entity.attributes?.entity_picture as string | undefined;
  if (pic) return pic;
  // Fallback: check state for some integrations that store URL there
  if (entity.state && entity.state.startsWith("http")) return entity.state;
  return null;
}
