import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import type { ProjectChoice, SavedWindow } from "../shared/settings";
import { Action, Card, Copy } from "./ui";

export function Field({ theme, label, value, placeholder, onChangeText }: {
  theme: PluginTheme; label: string; value: string; placeholder: string; onChangeText(value: string): void;
}) {
  return <View style={{ gap: 6 }}>
    <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor={theme.colors.foregroundMuted} maxLength={80} autoCorrect={false}
      style={{ color: theme.colors.foreground, backgroundColor: theme.colors.surface0, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14 }} />
  </View>;
}

export function WindowEditor({ theme, window, index, projects, onChange, onRemove }: {
  theme: PluginTheme; window: SavedWindow; index: number; projects: ProjectChoice[];
  onChange(next: SavedWindow): void; onRemove?(): void;
}) {
  const [search, setSearch] = useState("");
  const selected = new Set(window.projectIds);
  const missing = window.projectIds.filter((id) => !projects.some((p) => p.id === id));
  const shown = projects.filter((p) => `${p.name} ${p.path}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <Card theme={theme}>
    {onRemove && <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.7 }}>Window {index + 1}</Text>
      <Action theme={theme} label={`Remove project group ${index + 1}`} onPress={onRemove} />
    </View>}
    <Field theme={theme} label="Project group name" value={window.name} placeholder="e.g. Website and design" onChangeText={(name) => onChange({ ...window, name })} />
    <Copy theme={theme} muted>Only the selected projects will appear in this window.</Copy>
    <TextInput accessibilityLabel={`Search projects for window ${index + 1}`} value={search} onChangeText={setSearch}
      placeholder="Find a project…" placeholderTextColor={theme.colors.foregroundMuted}
      style={{ color: theme.colors.foreground, backgroundColor: theme.colors.surface0, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13 }} />
    <ScrollView style={{ maxHeight: 232 }} nestedScrollEnabled>
      {shown.map((project) => <Pressable key={project.id} accessibilityRole="checkbox"
        accessibilityLabel={project.name} accessibilityState={{ checked: selected.has(project.id) }}
        onPress={() => onChange({ ...window, projectIds: selected.has(project.id) ? window.projectIds.filter((id) => id !== project.id) : [...window.projectIds, project.id] })}
        style={({ pressed }) => ({ flexDirection: "row", gap: 12, padding: 10, borderRadius: 8, backgroundColor: selected.has(project.id) ? theme.colors.surface2 : pressed ? theme.colors.surface0 : "transparent", alignItems: "center" })}>
        <View style={{ width: 21, height: 21, borderRadius: 5, borderWidth: 1, borderColor: selected.has(project.id) ? theme.colors.accent : theme.colors.border, backgroundColor: selected.has(project.id) ? theme.colors.accent : theme.colors.surface0, alignItems: "center", justifyContent: "center" }}>
          {selected.has(project.id) && <Text style={{ color: theme.colors.accentForeground, fontSize: 14 }}>✓</Text>}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>{project.name}</Text>
          <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{project.path}</Text>
        </View>
      </Pressable>)}
      {!shown.length && <Copy theme={theme} muted>{projects.length ? "No matching projects." : "No projects on this host yet."}</Copy>}
    </ScrollView>
    {missing.length > 0 && <View style={{ gap: 8 }}>
      <Copy theme={theme} error>{missing.length} selected project{missing.length === 1 ? " is" : "s are"} unavailable. Remove the missing selection or reconnect its host.</Copy>
      <Action theme={theme} label="Remove missing projects" onPress={() => onChange({ ...window, projectIds: window.projectIds.filter((id) => !missing.includes(id)) })} />
    </View>}
    <Copy theme={theme} muted>{window.projectIds.length} project{window.projectIds.length === 1 ? "" : "s"} selected</Copy>
  </Card>;
}

