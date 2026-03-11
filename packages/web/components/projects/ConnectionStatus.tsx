"use client";

import { userIDToColor } from "@/lib/utils";

/** Status variants for the real-time connection indicator. */
type ConnectionStatusType = "connected" | "disconnected" | "syncing";

interface PresenceEntry {
  userID: string;
  userName: string;
  status: "ACTIVE" | "IDLE";
}

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  presenceUsers: PresenceEntry[];
}

const STATUS_CONFIG: Record<
  ConnectionStatusType,
  { color: string; text: string }
> = {
  connected: { color: "bg-green-500", text: "Connected" },
  syncing: { color: "bg-yellow-500", text: "Syncing..." },
  disconnected: { color: "bg-red-500", text: "Disconnected" },
};

/** Maximum number of presence avatars shown before a "+N" overflow badge. */
const MAX_VISIBLE_AVATARS = 5;

/**
 * Displays the real-time connection status and a row of presence avatars.
 *
 * Renders up to {@link MAX_VISIBLE_AVATARS} user avatars with a "+N" overflow
 * indicator. Each avatar shows the user's first initial on a deterministic
 * background color derived from their user ID.
 */
export default function ConnectionStatus({
  status,
  presenceUsers,
}: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg border border-gray-200">
      {presenceUsers.length > 0 && (
        <div className="flex -space-x-2 mr-2">
          {presenceUsers.slice(0, MAX_VISIBLE_AVATARS).map((user) => (
            <div
              key={user.userID}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white ${user.status === "IDLE" ? "opacity-50" : ""}`}
              style={{ backgroundColor: userIDToColor(user.userID) }}
              title={`${user.userName}${user.status === "IDLE" ? " (idle)" : ""}`}
            >
              {user.userName.charAt(0).toUpperCase()}
            </div>
          ))}
          {presenceUsers.length > MAX_VISIBLE_AVATARS && (
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600 bg-gray-200 border-2 border-white">
              +{presenceUsers.length - MAX_VISIBLE_AVATARS}
            </div>
          )}
        </div>
      )}
      <div
        className={`w-2 h-2 rounded-full ${config.color} ${status === "syncing" ? "animate-pulse" : ""}`}
      />
      <span className="text-sm font-medium text-gray-700">{config.text}</span>
    </div>
  );
}
