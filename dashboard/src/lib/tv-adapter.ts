import type { HassEntities } from "home-assistant-js-websocket";

// Directional + media transport actions for TV remotes
export type RemoteAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "ok"
  | "back"
  | "home"
  | "menu"
  | "play_pause"
  | "previous"
  | "next"
  | "rewind"
  | "fast_forward"
  | "volume_up"
  | "volume_down"
  | "mute";

export interface AppDefinition {
  name: string;
  icon: string;
  color: string;
  // App identifiers used by specific adapters
  appId?: string;
  sourceId?: string;
}

// Global app definitions shown in the AppStrip
export const APP_DEFINITIONS: AppDefinition[] = [
  { name: "Netflix", icon: "simple-icons:netflix", color: "#E50914", appId: "netflix" },
  { name: "YouTube", icon: "simple-icons:youtube", color: "#FF0000", appId: "youtube" },
  { name: "Spotify", icon: "simple-icons:spotify", color: "#1DB954", appId: "spotify" },
  { name: "Prime Video", icon: "simple-icons:primevideo", color: "#00A8E0", appId: "primevideo" },
];

export interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
  target: Record<string, unknown>;
}

export interface TvAdapter {
  platform: string;
  supportedActions: Set<RemoteAction>;
  keyCode: (action: RemoteAction) => string;
  getCurrentApp: (
    entities: HassEntities,
    remoteEntityId: string,
    mediaPlayerId: string,
  ) => AppDefinition | undefined;
  launchApp: (app: AppDefinition, mediaPlayerId: string) => ServiceCall;
}

// Android TV / Google TV adapter (for Xiaomi TV Box, etc.)
const androidTvAdapter: TvAdapter = {
  platform: "androidtv",
  supportedActions: new Set([
    "up", "down", "left", "right", "ok",
    "back", "home", "menu",
    "play_pause", "previous", "next", "rewind", "fast_forward",
    "volume_up", "volume_down", "mute",
  ]),
  keyCode: (action) => {
    const map: Record<RemoteAction, string> = {
      up: "KEYCODE_DPAD_UP",
      down: "KEYCODE_DPAD_DOWN",
      left: "KEYCODE_DPAD_LEFT",
      right: "KEYCODE_DPAD_RIGHT",
      ok: "KEYCODE_DPAD_CENTER",
      back: "KEYCODE_BACK",
      home: "KEYCODE_HOME",
      menu: "KEYCODE_MENU",
      play_pause: "KEYCODE_MEDIA_PLAY_PAUSE",
      previous: "KEYCODE_MEDIA_PREVIOUS",
      next: "KEYCODE_MEDIA_NEXT",
      rewind: "KEYCODE_MEDIA_REWIND",
      fast_forward: "KEYCODE_MEDIA_FAST_FORWARD",
      volume_up: "KEYCODE_VOLUME_UP",
      volume_down: "KEYCODE_VOLUME_DOWN",
      mute: "KEYCODE_VOLUME_MUTE",
    };
    return map[action] ?? action;
  },
  getCurrentApp: (entities, _remoteId, mediaPlayerId) => {
    const appName = entities[mediaPlayerId]?.attributes?.app_name as string | undefined;
    if (!appName) return undefined;
    return APP_DEFINITIONS.find(
      (a) => appName.toLowerCase().includes(a.name.toLowerCase()),
    );
  },
  launchApp: (app, mediaPlayerId) => ({
    domain: "media_player",
    service: "select_source",
    data: { source: app.name },
    target: { entity_id: mediaPlayerId },
  }),
};

// Lookup map for adapters by platform name
const ADAPTERS: Record<string, TvAdapter> = {
  androidtv: androidTvAdapter,
  "android_tv": androidTvAdapter,
};

// Returns an adapter for the given platform, or null if unsupported
export async function getAdapter(platform: string): Promise<TvAdapter | null> {
  return ADAPTERS[platform.toLowerCase()] ?? null;
}

// Returns an AppDefinition that matches an app name string (from media player state)
export function getAppIcon(appName: string | undefined): AppDefinition | undefined {
  if (!appName) return undefined;
  return APP_DEFINITIONS.find(
    (a) => appName.toLowerCase().includes(a.name.toLowerCase()),
  );
}
