import { useSyncExternalStore } from "react";
import { ScrollView, Text, View } from "react-native";
import { useWorkspace, usePaseo, type PluginButtonContentProps } from "@getpaseo/plugin/client";
import { sessionWindows } from "../shared/settings";
import { useLibrary } from "./library";
import { prepareWindows } from "./projects";
import { desktopUnavailableReason, type Launcher } from "./web";
import { Action, Copy, Divider } from "./ui";

export function WindowMenu({ theme, host, workspaceId, launcher, openSetup }: PluginButtonContentProps & { launcher: Launcher; openSetup(): void }) {
  const settings = useLibrary(host.id);
  const windows = settings;
  const paseo = usePaseo();
  const project = useWorkspace(workspaceId, (w) => ({ id: w.projectId, name: w.projectDisplayName }));
  const launch = useSyncExternalStore(launcher.subscribe, launcher.getSnapshot);
  const unavailable = desktopUnavailableReason();
  return <View style={{ gap: 10, minWidth: 260, maxWidth: 420 }}>
    <Action theme={theme} label="Open this project in its own window" disabled={!!unavailable || !project || launch.busy}
      onPress={() => { if (project) void launcher.run(() => prepareWindows(paseo, host.id, [{ id: "current", name: project.name.slice(0, 80), projectIds: [project.id] }], workspaceId)); }} />
    {project && <Copy theme={theme} muted>{project.name}</Copy>}
    <Divider theme={theme} />
    <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 10 }}>
    <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.7 }}>SAVED SESSIONS</Text>
    {settings.status === "loading" && <Copy theme={theme} muted>Loading sessions…</Copy>}
    {(settings.status === "invalid" || settings.status === "error") && <Copy theme={theme} error>{settings.error}</Copy>}
    {settings.status === "ready" && (settings.values.sessions.length ? settings.values.sessions.map((session) =>
      <Action key={session.id} theme={theme} label={session.name} disabled={!!unavailable || launch.busy || !session.projectGroupIds.length}
          onPress={() => { void launcher.run(() => prepareWindows(paseo, host.id, sessionWindows(settings.values, session))); }} />
      ) : <Copy theme={theme} muted>No saved sessions yet. Create one in setup.</Copy>)}
    <Divider theme={theme} />
    <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.7 }}>PROJECT GROUPS</Text>
    {windows.status === "loading" && <Copy theme={theme} muted>Loading project groups…</Copy>}
    {(windows.status === "invalid" || windows.status === "error") && <Copy theme={theme} error>{windows.error}</Copy>}
    {windows.status === "ready" && (windows.values.projectGroups.length ? windows.values.projectGroups.map((window) =>
      <Action key={window.id} theme={theme} label={window.name} disabled={!!unavailable || launch.busy}
          onPress={() => { void launcher.run(() => prepareWindows(paseo, host.id, [window])); }} />
      ) : <Copy theme={theme} muted>No project groups yet. Create one in setup.</Copy>)}
    </ScrollView>
    {unavailable && <Copy theme={theme} muted>{unavailable}</Copy>}
    {launch.message && <Copy theme={theme}>{launch.message}</Copy>}
    {launch.error && <Copy theme={theme} error>{launch.error}</Copy>}
    <Divider theme={theme} />
    <Action theme={theme} label="Set up project groups and sessions" onPress={openSetup} />
  </View>;
}
