import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import type { PaseoApi } from "@getpaseo/client";
import type { ProjectChoice } from "../shared/settings";
import { loadProjects } from "./projects";
import { Action, Copy } from "./ui";

type ProjectList = { status: "loading" } | { status: "ready"; projects: ProjectChoice[] } | { status: "error"; error: string };

// Popover content sits outside the settings screen's query client, so load directly.
function useProjects(paseo: PaseoApi, hostId: string): ProjectList {
  const [list, setList] = useState<ProjectList>({ status: "loading" });
  useEffect(() => {
    let live = true;
    const load = () => loadProjects(paseo, hostId).then(
      (projects) => { if (live) setList({ status: "ready", projects }); },
      () => { if (live) setList({ status: "error", error: "Could not load projects for this host." }); });
    void load();
    const unsubscribe = paseo.projects.subscribe(() => { void load(); });
    return () => { live = false; unsubscribe(); };
  }, [paseo, hostId]);
  return list;
}

export function ProjectPicker({ theme, paseo, hostId, currentProjectId, disabled, onOpen, onBack }: {
  theme: PluginTheme; paseo: PaseoApi; hostId: string; currentProjectId?: string; disabled: boolean;
  onOpen(project: ProjectChoice): void; onBack(): void;
}) {
  const list = useProjects(paseo, hostId);
  const [search, setSearch] = useState("");
  const query = search.toLocaleLowerCase();
  const shown = list.status === "ready" ? list.projects.filter((p) => `${p.name} ${p.path}`.toLocaleLowerCase().includes(query)) : [];
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Action theme={theme} label="Back" onPress={onBack} />
      <Text style={{ flex: 1, color: theme.colors.foreground, fontSize: 14, fontWeight: "600" }}>Open a project in a new window</Text>
    </View>
    <TextInput accessibilityLabel="Search projects" value={search} onChangeText={setSearch} autoFocus
      placeholder="Find a project…" placeholderTextColor={theme.colors.foregroundMuted} autoCorrect={false}
      style={{ color: theme.colors.foreground, backgroundColor: theme.colors.surface0, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13 }} />
    <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
      {list.status === "loading" && <Copy theme={theme} muted>Loading projects…</Copy>}
      {list.status === "error" && <Copy theme={theme} error>{list.error}</Copy>}
      {shown.map((project) => <Pressable key={project.id} accessibilityRole="button" accessibilityLabel={`Open ${project.name}`}
        accessibilityState={{ disabled }} disabled={disabled} onPress={() => onOpen(project)}
        style={({ pressed }) => ({ padding: 10, borderRadius: 8, gap: 2, backgroundColor: pressed ? theme.colors.surface2 : "transparent", opacity: disabled ? 0.45 : 1 })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, color: theme.colors.foreground, fontSize: 14 }}>{project.name}</Text>
          {project.id === currentProjectId && <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>Current</Text>}
        </View>
        <Text numberOfLines={1} style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{project.path}</Text>
      </Pressable>)}
      {list.status === "ready" && !shown.length && <Copy theme={theme} muted>{list.projects.length ? "No matching projects." : "No projects on this host yet."}</Copy>}
    </ScrollView>
  </View>;
}
