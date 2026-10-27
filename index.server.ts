import type { PluginServerContext } from "@getpaseo/plugin/server";
import { preferences, windowPreferences } from "./shared/settings";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(preferences);
  server.registerSettings(windowPreferences);
  return () => {};
}
