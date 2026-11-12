import { useState } from "react";
import { Text, View } from "react-native";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import type { Launcher } from "./web";
import { ProjectGroups } from "./project-groups";
import { SessionSettings } from "./sessions";
import { Card, Copy, SettingsButtonLayout, TabBar } from "./ui";
import { VERIFIED_LABEL } from "./compat";

const tabs = [{ name: "Window groups", icon: "Layers" }, { name: "Project groups", icon: "PanelsTopLeft" }, { name: "About", icon: "Info" }] as const;
type Tab = typeof tabs[number]["name"];

export function WindowSettings(props: PluginSurfaceProps & { launcher: Launcher }) {
  const [tab, setTab] = useState<Tab>("Window groups");
  const [sessionRequest, setSessionRequest] = useState<{ id: string } | null>(null);
  const { theme, layout } = props;
  return <SettingsButtonLayout.Provider value={{ compact: layout.compact }}><View style={{ gap: layout.compact ? 16 : 20 }}>
    <View style={{ flexDirection: "row" }}><TabBar theme={theme} compact={layout.compact} tabs={tabs} value={tab} onChange={setTab} /></View>
    {/* Keep editors mounted so tab changes preserve unsaved drafts. */}
    <View style={{ display: tab === "Project groups" ? "flex" : "none" }}><ProjectGroups {...props} onEditSession={(id) => { setSessionRequest({ id }); setTab("Window groups"); }} /></View>
    <View style={{ display: tab === "Window groups" ? "flex" : "none" }}><SessionSettings {...props} sessionRequest={sessionRequest} /></View>
    <View style={{ display: tab === "About" ? "flex" : "none", gap: 16 }}>
      <Text style={{ color: theme.colors.foreground, fontSize: layout.compact ? 22 : 26, fontWeight: "700" }}>About Window Manager</Text>
      <Copy theme={theme}>Keep your projects arranged for the way you work.</Copy>
      <Card theme={theme}>
        <Text style={{ color: theme.colors.foreground, fontSize: 17, fontWeight: "600" }}>Two ways to open your work</Text>
        <Copy theme={theme}>Each project group opens one window showing its selected projects.</Copy>
        <Copy theme={theme}>Window groups contain shared project groups and open one window per project group. Create a new project group or add an existing one from the Window groups tab.</Copy>
        <Copy theme={theme}>Edit a project group in either tab to update every window group that uses it. Deleting a window group keeps its project groups; deleting a project group removes it from all window groups.</Copy>
      </Card>
      <Card theme={theme}>
        <Text style={{ color: theme.colors.foreground, fontSize: 17, fontWeight: "600" }}>Opening windows</Text>
        <Copy theme={theme}>Launching requires Paseo Desktop 0.13.2 or later and has been verified with {VERIFIED_LABEL}. A newer Paseo release still works but shows a notice until it has been verified. You can edit project groups and window groups on other clients. Each launch creates new windows.</Copy>
        <Copy theme={theme}>Refreshing a window may reset its project selection. Reopen your saved project group or window group to restore it. Names label your saved setup; window positions, sizes, and native titles are not saved.</Copy>
        <Copy theme={theme} muted>Desktop launching uses Paseo functionality outside its public plugin API. Linux/X11 has been tested; macOS and Windows still need native testing.</Copy>
      </Card>
      <Copy theme={theme} muted>Settings are saved on the selected host and shared with its connected clients. Window Manager does not start agents or send project data to external services.</Copy>
    </View>
  </View></SettingsButtonLayout.Provider>;
}
