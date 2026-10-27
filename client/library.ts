import { useEffect, useRef } from "react";
import { useSettings } from "@getpaseo/plugin/client";
import { importLegacyWindows, preferences, windowPreferences } from "../shared/settings";

// All surfaces share one revision-protected document. Import the legacy standalone
// windows once, using compare-and-swap so simultaneous clients cannot duplicate them.
export function useLibrary(hostId: string) {
  const settings = useSettings(preferences);
  const legacy = useSettings(windowPreferences);
  const attempted = useRef<string | null>(null);
  useEffect(() => { attempted.current = null; }, [hostId]);
  const needsImport = settings.status === "ready" && !settings.values.legacyWindowsImported;
  useEffect(() => {
    if (!needsImport || settings.status !== "ready" || legacy.status !== "ready" || settings.saving) return;
    if (attempted.current === settings.revision) return;
    attempted.current = settings.revision;
    void settings.save(importLegacyWindows(settings.values, legacy.values.windows), settings.revision);
  }, [settings, legacy, needsImport]);
  if (!needsImport) return settings;
  return {
    ...settings,
    status: settings.saveError || legacy.status === "invalid" || legacy.status === "error" ? "error" as const : "loading" as const,
    error: settings.saveError || (legacy.status === "invalid" || legacy.status === "error" ? legacy.error : "Importing saved windows…"),
    reload: async () => { attempted.current = null; await legacy.reload(); await settings.reload(); },
  };
}
