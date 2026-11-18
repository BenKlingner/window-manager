import { useState, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";
import { usePaseo, type PluginHostProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import { sessionWindows } from "../shared/settings";
import { useLibrary } from "./library";
import { prepareWindows } from "./projects";
import { desktopCompatibilityNotice, desktopUnavailableReason, type Launcher } from "./web";
import { ProjectPicker } from "./project-picker";
import { Copy, LaunchRow, TabBar } from "./ui";

const tabs = [{ name: "Projects", icon: "Folder" }, { name: "Window groups", icon: "Layers" }, { name: "Project groups", icon: "PanelsTopLeft" }] as const;
type Tab = typeof tabs[number]["name"];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function WindowMenu({ theme, host, layout, launcher, openSettings }: PluginHostProps & { launcher: Launcher; openSettings(): void }) {
  const library = useLibrary(host.id);
  const paseo = usePaseo();
  const launch = useSyncExternalStore(launcher.subscribe, launcher.getSnapshot);
  const unavailable = desktopUnavailableReason();
  const untested = desktopCompatibilityNotice();
  const [tab, setTab] = useState<Tab>("Projects");
  const blocked = !!unavailable || launch.busy;
  const { compact } = layout;
  const values = library.status === "ready" ? library.values : null;
  const groupNames = new Map(values?.projectGroups.map((group) => [group.id, group.name]));

  return <View style={{ gap: compact ? 12 : 16, width: "100%", maxWidth: 760, alignSelf: "center" }}>
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
      <TabBar theme={theme} compact={compact} tabs={tabs} value={tab} onChange={setTab} />
      <Pressable accessibilityRole="button" accessibilityLabel="Window Manager settings" onPress={openSettings}
        style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", width: compact ? 40 : 34, height: compact ? 40 : 34,
          borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface1, opacity: pressed ? 0.75 : 1 })}>
        <Icon name="Settings" size={16} color={theme.colors.foregroundMuted} />
      </Pressable>
    </View>
    {unavailable && <Copy theme={theme} muted>{unavailable}</Copy>}
    {untested && <Copy theme={theme} muted>{untested}</Copy>}
    {launch.message && <Copy theme={theme}>{launch.message}</Copy>}
    {launch.error && <Copy theme={theme} error>{launch.error}</Copy>}

    {tab === "Projects" && <ProjectPicker theme={theme} compact={compact} paseo={paseo} hostId={host.id} disabled={blocked}
      onOpen={(picked) => { void launcher.run(() => prepareWindows(paseo, host.id, [{ id: "picked", name: picked.name.slice(0, 80), projectIds: [picked.id] }])); }} />}

    {tab !== "Projects" && library.status === "loading" && <Copy theme={theme} muted>Loading…</Copy>}
    {tab !== "Projects" && (library.status === "invalid" || library.status === "error") && <Copy theme={theme} error>{library.error}</Copy>}

    {tab === "Window groups" && values && <View style={{ gap: 8 }}>
      {values.sessions.length ? values.sessions.map((session) => <LaunchRow key={session.id} theme={theme} compact={compact} name={session.name}
        detail={session.projectGroupIds.length ? session.projectGroupIds.map((id) => groupNames.get(id) ?? "Missing group").join(", ") : "No project groups"}
        disabled={blocked || !session.projectGroupIds.length}
        onOpen={() => { void launcher.run(() => prepareWindows(paseo, host.id, sessionWindows(values, session))); }} />)
        : <Copy theme={theme} muted>No window groups yet. Create one in settings.</Copy>}
    </View>}

    {tab === "Project groups" && values && <View style={{ gap: 8 }}>
      {values.projectGroups.length ? values.projectGroups.map((group) => <LaunchRow key={group.id} theme={theme} compact={compact} name={group.name}
        detail={plural(group.projectIds.length, "project")} disabled={blocked}
        onOpen={() => { void launcher.run(() => prepareWindows(paseo, host.id, [group])); }} />)
        : <Copy theme={theme} muted>No project groups yet. Create one in settings.</Copy>}
    </View>}
  </View>;
}
