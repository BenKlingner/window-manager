import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import type { PaseoApi } from "@getpaseo/client";
import type { ProjectChoice } from "../shared/settings";
import { loadProjects } from "./projects";
import { Copy, LaunchRow } from "./ui";

type ProjectList = { status: "loading" } | { status: "ready"; projects: ProjectChoice[] } | { status: "error"; error: string };

// Loads directly rather than through the settings screen's query client.
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

export function ProjectPicker({ theme, compact, paseo, hostId, disabled, onOpen }: {
  theme: PluginTheme; compact: boolean; paseo: PaseoApi; hostId: string; disabled: boolean; onOpen(project: ProjectChoice): void;
}) {
  const list = useProjects(paseo, hostId);
  const [search, setSearch] = useState("");
  const query = search.toLocaleLowerCase();
  const shown = list.status === "ready" ? list.projects.filter((p) => `${p.name} ${p.path}`.toLocaleLowerCase().includes(query)) : [];
  return <View style={{ gap: 8 }}>
    <TextInput accessibilityLabel="Search projects" value={search} onChangeText={setSearch}
      placeholder="Find a project…" placeholderTextColor={theme.colors.foregroundMuted} autoCorrect={false}
      style={{ color: theme.colors.foreground, backgroundColor: theme.colors.surface0, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13 }} />
    {list.status === "loading" && <Copy theme={theme} muted>Loading projects…</Copy>}
    {list.status === "error" && <Copy theme={theme} error>{list.error}</Copy>}
    {shown.map((project) => <LaunchRow key={project.id} theme={theme} compact={compact} name={project.name} detail={project.path}
      disabled={disabled} onOpen={() => onOpen(project)} />)}
    {list.status === "ready" && !shown.length && <Copy theme={theme} muted>{list.projects.length ? "No matching projects." : "No projects on this host yet."}</Copy>}
  </View>;
}
