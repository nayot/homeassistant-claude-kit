import { useState } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { AnimatePresence, motion } from "framer-motion";
import { ROOMS, type RoomConfig } from "../lib/areas";
import {
  CONTEXT_CONFIG,
  QUICK_ACTIONS_CONFIG,
  ACTIVE_AUTOMATIONS_CONFIG,
} from "../lib/entities";
import { ContextCard } from "../components/cards/ContextCard";
import { EnergyCard } from "../components/cards/EnergyCard";
import { QuickActions } from "../components/cards/QuickActions";
import { RoomCard } from "../components/cards/RoomCard";
import { ActiveAutomations } from "../components/cards/ActiveAutomations";
import { MediaPlayerCard } from "../components/cards/MediaPlayerCard";
import { RoomPopup } from "../components/popups/RoomPopup";

export function HomeView() {
  const entities = useHass((s) => s.entities) as HassEntities;
  const [selectedRoom, setSelectedRoom] = useState<RoomConfig | null>(null);

  // Find rooms with active TVs (remote or media player is "on")
  const activeMediaRooms = ROOMS.flatMap((room) => {
    if (!room.remoteEntity || !room.mediaPlayers?.length) return [];
    const remoteBase = room.remoteEntity.split(".")[1];
    const tvPlayer =
      room.mediaPlayers.find((id) => id.endsWith(remoteBase)) ??
      room.mediaPlayers[0];
    const remoteState = entities[room.remoteEntity]?.state;
    const playerState = entities[tvPlayer]?.state;
    const isOn =
      remoteState === "on" ||
      playerState === "on" ||
      playerState === "playing" ||
      playerState === "paused";
    if (!isOn) return [];
    return [{ room, mediaPlayerId: tvPlayer }];
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <ContextCard config={CONTEXT_CONFIG} />
      <QuickActions config={QUICK_ACTIONS_CONFIG} />

      {/* Now Playing — active TVs */}
      <AnimatePresence>
        {activeMediaRooms.map(({ room, mediaPlayerId }) => (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <MediaPlayerCard
              mediaPlayerId={mediaPlayerId}
              room={room}
              entities={entities}
              roomLabel={room.name}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Room cards — ordered as defined in areas.ts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROOMS.map((room, i) => (
          <motion.div
            key={room.id}
            className="h-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
          >
            <RoomCard
              room={room}
              onTap={() => setSelectedRoom(room)}
            />
          </motion.div>
        ))}
      </div>

      <ActiveAutomations config={ACTIVE_AUTOMATIONS_CONFIG} />
      <EnergyCard config={CONTEXT_CONFIG} />

      <RoomPopup
        room={selectedRoom}
        open={selectedRoom !== null}
        onClose={() => setSelectedRoom(null)}
      />
    </div>
  );
}
