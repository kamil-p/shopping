"use client";

import { WifiIcon, WifiOffIcon } from "lucide-react";

import { useForcedOffline } from "@/lib/offline/use-online";
import { syncNow } from "@/lib/offline/sync";

/**
 * Drawer toggle that forces the offline-simulation flag on/off. Lets anyone flip
 * the whole app into local-first mode (banner, no sync, IndexedDB reads) to test
 * offline behaviour without cutting the real network. Turning it off kicks a sync
 * so the queue drains, just like a real `online` event.
 */
export function OfflineToggle() {
  const [forced, setForced] = useForcedOffline();

  function toggle() {
    const next = !forced;
    setForced(next);
    if (!next) void syncNow();
  }

  return (
    <div className="zk-theme-row">
      {forced ? (
        <WifiOffIcon className="size-[19px]" />
      ) : (
        <WifiIcon className="size-[19px]" />
      )}
      <span>Tryb offline</span>
      <button
        type="button"
        role="switch"
        aria-checked={forced}
        aria-label="Tryb offline"
        className={"zk-toggle-switch" + (forced ? " on" : "")}
        onClick={toggle}
      >
        <span className="knob" />
      </button>
    </div>
  );
}
