import type { Connection } from "home-assistant-js-websocket";

const MEDIA_PREFIX = "media-source://media_source/local/snapshots";

export type SnapshotSource = "person" | "motion" | "face" | "scheduled" | "stream" | "unknown";

export interface SnapshotEntry {
  filename: string;
  time: string; // "HH:MM:SS"
  timestamp: Date;
  source: SnapshotSource;
  mediaId: string;
}

interface BrowseMediaChild {
  title: string;
  media_class: string;
  media_content_id: string;
  media_content_type: string | null;
  can_play: boolean;
  can_expand: boolean;
  thumbnail: string | null;
  children_media_class: string | null;
}

interface BrowseMediaResult {
  title: string;
  media_class: string;
  media_content_id: string;
  can_expand: boolean;
  children: BrowseMediaChild[];
}

export async function listMediaDirs(
  connection: Connection,
  path: string = "",
): Promise<string[]> {
  const mediaId = path ? `${MEDIA_PREFIX}/${path}` : MEDIA_PREFIX;
  try {
    const result = await connection.sendMessagePromise<BrowseMediaResult>({
      type: "media_source/browse_media",
      media_content_id: mediaId,
    });
    return (result.children ?? [])
      .filter((c) => c.can_expand)
      .map((c) => c.title);
  } catch {
    return [];
  }
}

export async function listSnapshots(
  connection: Connection,
  cameraId: string,
  date: string,
): Promise<SnapshotEntry[]> {
  const [year, month] = date.split("-");
  const datePrefix = date.replace(/-/g, "");
  const mediaId = `${MEDIA_PREFIX}/${year}/${month}/${cameraId}`;

  try {
    const result = await connection.sendMessagePromise<BrowseMediaResult>({
      type: "media_source/browse_media",
      media_content_id: mediaId,
    });

    const snapshots: SnapshotEntry[] = [];
    for (const child of result.children ?? []) {
      if (child.can_expand || !child.title.endsWith(".jpg")) continue;
      if (!child.title.startsWith(datePrefix)) continue;

      const parsed = parseSnapshotFilename(child.title);
      if (parsed) {
        snapshots.push({ ...parsed, mediaId: child.media_content_id });
      }
    }

    snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return snapshots;
  } catch {
    return [];
  }
}

export async function listAllSnapshotsForDate(
  connection: Connection,
  date: string,
): Promise<Map<string, SnapshotEntry[]>> {
  const [year, month] = date.split("-");
  const cameraIds = await listMediaDirs(connection, `${year}/${month}`);

  const results = new Map<string, SnapshotEntry[]>();
  await Promise.all(
    cameraIds.map(async (camId) => {
      const snaps = await listSnapshots(connection, camId, date);
      if (snaps.length > 0) results.set(camId, snaps);
    }),
  );
  return results;
}

export async function listAvailableMonths(
  connection: Connection,
): Promise<string[]> {
  const years = await listMediaDirs(connection, "");
  const months: string[] = [];
  for (const year of years) {
    if (!/^\d{4}$/.test(year)) continue;
    const monthDirs = await listMediaDirs(connection, year);
    for (const month of monthDirs) {
      if (/^\d{2}$/.test(month)) months.push(`${year}-${month}`);
    }
  }
  return months.sort().reverse();
}

export async function resolveMediaUrl(
  connection: Connection,
  mediaContentId: string,
): Promise<string | null> {
  try {
    const result = await connection.sendMessagePromise<{ url: string; mime_type: string }>({
      type: "media_source/resolve_media",
      media_content_id: mediaContentId,
    });
    return result.url;
  } catch {
    return null;
  }
}

function parseSnapshotFilename(filename: string): Omit<SnapshotEntry, "mediaId"> | null {
  const match = filename.match(
    /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_(person|motion|face|scheduled|stream))?\.jpg$/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s, src] = match;
  const source: SnapshotSource = (src as SnapshotSource) ?? "unknown";
  const timestamp = new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return { filename, time: `${h}:${mi}:${s}`, timestamp, source };
}
