import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePaseo, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { windowSchema, type SavedWindow, type Preferences } from "../shared/settings";
import { desktopUnavailableReason, newId, type Launcher } from "./web";
import { loadProjects, prepareWindows } from "./projects";
import { Action, Card, Copy, Divider } from "./ui";
import { useLibrary } from "./library";
import { WindowEditor } from "./window-editor";

interface Draft { window: SavedWindow; base: Preferences; revision: string }

export function ProjectGroups({ theme, host, layout, launcher, onEditSession }: PluginSurfaceProps & { launcher: Launcher; onEditSession(id: string): void }) {
  const settings = useLibrary(host.id);
  const paseo = usePaseo();
  const queryClient = useQueryClient();
  const projects = useQuery({ queryKey: ["window-manager-projects", host.id], queryFn: () => loadProjects(paseo, host.id) });
  useEffect(() => paseo.projects.subscribe(() => {
    void queryClient.invalidateQueries({ queryKey: ["window-manager-projects", host.id] });
  }), [paseo, queryClient, host.id]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const launch = useSyncExternalStore(launcher.subscribe, launcher.getSnapshot);
  const unavailable = desktopUnavailableReason();
  const busy = settings.saving || launch.busy;
  useEffect(() => { setDraft(null); setError(null); setDeleting(null); }, [host.id]);
  function edit(window: SavedWindow) {
    if (settings.status !== "ready") return;
    setDraft({ window: { ...window, projectIds: [...window.projectIds] }, base: settings.values, revision: settings.revision });
    setDeleting(null); setError(null);
  }
  async function save() {
    if (!draft) return;
    const result = windowSchema.safeParse(draft.window);
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Check the window details."); return; }
    if (result.data.projectIds.some((id) => !projects.data?.some((p) => p.id === id))) {
      setError("Choose available projects before saving."); return;
    }
    if (draft.base.projectGroups.find((g) => g.id === result.data.id)?.name !== result.data.name && draft.base.projectGroups.some((w) => w.id !== result.data.id && w.name.toLocaleLowerCase() === result.data.name.toLocaleLowerCase())) {
      setError("A project group already uses this name. Choose a different name."); return;
    }
    const exists = draft.base.projectGroups.some((w) => w.id === result.data.id);
    const windows = exists ? draft.base.projectGroups.map((w) => w.id === result.data.id ? result.data : w) : [...draft.base.projectGroups, result.data];
    if (await settings.save({ ...draft.base, projectGroups: windows }, draft.revision)) { setDraft(null); setError(null); }
  }
  function open(window: SavedWindow) { void launcher.run(() => prepareWindows(paseo, host.id, [window])); }

  return <View style={{ gap: 20, paddingVertical: 8 }}>
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.colors.foreground, fontSize: layout.compact ? 22 : 26, fontWeight: "700" }}>Project groups</Text>
      <Copy theme={theme} muted>Each project group opens one window with its selected projects. Add the same group to sessions; edits apply everywhere it is used.</Copy>
    </View>
    {unavailable && <Card theme={theme}><Copy theme={theme} muted>{unavailable}</Copy></Card>}
    {launch.message && <Copy theme={theme}>{launch.message}</Copy>}
    {launch.error && <Copy theme={theme} error>{launch.error}</Copy>}
    {settings.status === "loading" && <Copy theme={theme} muted>Loading project groups…</Copy>}
    {(settings.status === "error" || settings.status === "invalid") && <Card theme={theme}>
      <Copy theme={theme} error>{settings.error}</Copy>
      <Action theme={theme} label="Retry loading project groups" onPress={() => { void settings.reload(); }} />
    </Card>}
    {settings.status === "ready" && !draft && <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Copy theme={theme} muted>{settings.values.projectGroups.length} project group{settings.values.projectGroups.length === 1 ? "" : "s"} · {host.label}</Copy>
        <Action theme={theme} primary label="New project group" disabled={busy || settings.values.projectGroups.length >= 400}
          onPress={() => edit({ id: newId(), name: "", projectIds: [] })} />
      </View>
      {!settings.values.projectGroups.length && <Card theme={theme}>
        <Text style={{ color: theme.colors.foreground, fontSize: 17, fontWeight: "600" }}>One window, your projects</Text>
        <Copy theme={theme} muted>Create a project group such as “Website and design”, select its projects, and open it with one click.</Copy>
      </Card>}
      {settings.values.projectGroups.map((window) => <Card key={window.id} theme={theme}>
        <Text style={{ color: theme.colors.foreground, fontSize: 18, fontWeight: "600" }}>{window.name}</Text>
        <Copy theme={theme} muted>Projects: {window.projectIds.map((id) => projects.data?.find((p) => p.id === id)?.name ?? (projects.isPending ? "Loading…" : "Unavailable project")).join(" · ")}</Copy>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 4 }}>
          <Copy theme={theme} muted>Sessions:</Copy>
          {settings.values.sessions.filter((s) => s.projectGroupIds.includes(window.id)).map((s, index, sessions) => <View key={s.id} style={{ flexDirection: "row", alignItems: "baseline", flexShrink: 1 }}>
            <Pressable accessibilityRole="link" accessibilityLabel={s.name} accessibilityState={{ disabled: busy }}
              disabled={busy} onPress={() => onEditSession(s.id)} style={({ pressed }) => ({ flexShrink: 1, opacity: busy ? 0.5 : pressed ? 0.75 : 1 })}>
              <Text style={{ color: theme.colors.accent, fontSize: 13, lineHeight: 20, textDecorationLine: "underline" }}>{s.name}</Text>
            </Pressable>
            {index < sessions.length - 1 && <Copy theme={theme} muted>,</Copy>}
          </View>)}
          {!settings.values.sessions.some((s) => s.projectGroupIds.includes(window.id)) && <Copy theme={theme} muted>Not in any session</Copy>}
        </View>
        <Divider theme={theme} />
        {deleting === window.id ? <View style={{ gap: 10 }}>
          <Copy theme={theme}>Delete “{window.name}” and remove it from all sessions? Open windows and projects will be kept.</Copy>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Action theme={theme} danger label="Delete project group" disabled={busy} onPress={() => { void settings.save({ ...settings.values, projectGroups: settings.values.projectGroups.filter((w) => w.id !== window.id), sessions: settings.values.sessions.map((s) => ({ ...s, projectGroupIds: s.projectGroupIds.filter((id) => id !== window.id) })) }, settings.revision).then((ok) => { if (ok) setDeleting(null); }); }} />
            <Action theme={theme} label="Keep project group" disabled={busy} onPress={() => setDeleting(null)} />
          </View>
        </View> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Action theme={theme} primary label="Open window" disabled={busy || !!unavailable} onPress={() => open(window)} />
          <Action theme={theme} label="Edit project group" disabled={busy} onPress={() => edit(window)} />
          <Action theme={theme} danger label="Delete project group" disabled={busy} onPress={() => setDeleting(window.id)} />
        </View>}
      </Card>)}
    </>}
    {draft && <View style={{ gap: 16 }}>
      <Copy theme={theme} muted>Used in: {draft.base.sessions.filter((s) => s.projectGroupIds.includes(draft.window.id)).map((s) => s.name).join(", ") || "No sessions yet"}. Saving updates this group in every session.</Copy>
      {settings.status === "ready" && settings.revision !== draft.revision && <Copy theme={theme} error>Project groups or sessions changed in another window. Your draft is kept. Cancel and reopen the editor to use the latest version.</Copy>}
      {projects.isPending && <Copy theme={theme} muted>Loading projects…</Copy>}
      {projects.isError && <View style={{ gap: 8 }}><Copy theme={theme} error>Could not load projects. Check this host’s connection.</Copy><Action theme={theme} label="Retry projects" onPress={() => { void projects.refetch(); }} /></View>}
      {projects.data && <WindowEditor theme={theme} window={draft.window} index={0} projects={projects.data}
        onChange={(window) => { if (!busy) { setDraft({ ...draft, window }); setError(null); } }} />}
      {error && <Copy theme={theme} error>{error}</Copy>}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Action theme={theme} variant="filled" label={settings.saving ? "Saving…" : "Save project group"} disabled={busy || !projects.data || projects.isError || settings.status !== "ready" || settings.revision !== draft.revision} onPress={() => { void save(); }} />
        <Action theme={theme} label="Cancel" disabled={settings.saving} onPress={() => { setDraft(null); setError(null); }} />
      </View>
    </View>}
    {settings.saveError && <Copy theme={theme} error>{settings.saveError}</Copy>}
  </View>;
}
