import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import type { Launcher } from "./web";
import { ProjectGroups } from "./project-groups";
import { SessionSettings } from "./sessions";
import { Card, Copy, SettingsButtonLayout } from "./ui";

const tabs = ["Project groups", "Sessions manager", "About"] as const;
type Tab = typeof tabs[number];
const tabIcons: Record<Tab, string> = { "Project groups": "PanelsTopLeft", "Sessions manager": "Layers", About: "Info" };

export function WindowSettings(props: PluginSurfaceProps & { launcher: Launcher }) {
  const [tab, setTab] = useState<Tab>("Project groups");
  const [sessionRequest, setSessionRequest] = useState<{ id: string } | null>(null);
  const { theme, layout } = props;
  return <SettingsButtonLayout.Provider value={{ compact: layout.compact }}><View style={{ gap: layout.compact ? 16 : 20 }}>
    <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {tabs.map((name) => <Pressable key={name} accessibilityRole="tab" accessibilityLabel={name}
        accessibilityState={{ selected: name === tab }} onPress={() => setTab(name)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6,
          paddingVertical: layout.compact ? 10 : 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1,
          borderColor: name === tab ? theme.colors.accent : theme.colors.border,
          backgroundColor: name === tab ? theme.colors.accent : theme.colors.surface1 }}>
        <Icon name={tabIcons[name]} size={14} color={name === tab ? theme.colors.accentForeground : theme.colors.foregroundMuted} />
        <Text style={{ color: name === tab ? theme.colors.accentForeground : theme.colors.foreground, fontSize: 13, fontWeight: name === tab ? "500" : "400" }}>{name}</Text>
      </Pressable>)}
    </View>
    {/* Keep editors mounted so tab changes preserve unsaved drafts. */}
    <View style={{ display: tab === "Project groups" ? "flex" : "none" }}><ProjectGroups {...props} onEditSession={(id) => { setSessionRequest({ id }); setTab("Sessions manager"); }} /></View>
    <View style={{ display: tab === "Sessions manager" ? "flex" : "none" }}><SessionSettings {...props} sessionRequest={sessionRequest} /></View>
    <View style={{ display: tab === "About" ? "flex" : "none", gap: 16 }}>
      <Text style={{ color: theme.colors.foreground, fontSize: layout.compact ? 22 : 26, fontWeight: "700" }}>About Window Manager</Text>
      <Copy theme={theme}>Keep your projects arranged for the way you work.</Copy>
      <Card theme={theme}>
        <Text style={{ color: theme.colors.foreground, fontSize: 17, fontWeight: "600" }}>Two ways to open your work</Text>
        <Copy theme={theme}>Each project group opens one window showing its selected projects.</Copy>
        <Copy theme={theme}>Sessions contain shared project groups and open one window per group. Create a new group or add an existing one from Sessions manager.</Copy>
        <Copy theme={theme}>Edit a project group in either tab to update every session that uses it. Deleting a session keeps its groups; deleting a group removes it from all sessions.</Copy>
      </Card>
      <Card theme={theme}>
        <Text style={{ color: theme.colors.foreground, fontSize: 17, fontWeight: "600" }}>Opening windows</Text>
        <Copy theme={theme}>Launching requires Paseo Desktop 0.13.2–0.13.x. You can edit saved windows and sessions on other clients. Each launch creates new windows.</Copy>
        <Copy theme={theme}>Refreshing a window may reset its project selection. Reopen your saved window or session to restore it. Names label your saved setup; window positions, sizes, and native titles are not saved.</Copy>
        <Copy theme={theme} muted>Desktop launching uses Paseo functionality outside its public plugin API. Linux/X11 has been tested; macOS and Windows still need native testing.</Copy>
      </Card>
      <Copy theme={theme} muted>Settings are saved on the selected host and shared with its connected clients. Window Manager does not start agents or send project data to external services.</Copy>
    </View>
  </View></SettingsButtonLayout.Provider>;
}
