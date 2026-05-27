// HA icon names like "mdi:lightbulb" are already in Iconify format.
// This converts legacy prefixes (e.g. "hass:") to their Iconify equivalents.
export function haIconToIconify(haIcon: string): string {
  if (!haIcon) return "mdi:lightbulb";
  if (haIcon.startsWith("hass:")) return `mdi:${haIcon.slice(5)}`;
  return haIcon;
}
