import { useEffect, useState, useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePaseo, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { preferencesSchema, sessionWindows, type Preferences, type SavedSession, type SavedWindow } from "../shared/settings";
import { desktopUnavailableReason, newId, type Launcher } from "./web";
import { loadProjects, prepareWindows } from "./projects";
import { Action, Card, Copy, Divider } from "./ui";
import { Field, WindowEditor } from "./window-editor";
import { useLibrary } from "./library";

interface Draft { session: SavedSession; base: Preferences; groups: SavedWindow[]; revision: string }
export function SessionSettings({ theme, host, layout, launcher, sessionRequest }: PluginSurfaceProps & {
  launcher: Launcher; sessionRequest: { id: string } | null;
}) {
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
  const [picking, setPicking] = useState(false);
  const [pendingSession, setPendingSession] = useState<string | null>(null);
  const launch = useSyncExternalStore(launcher.subscribe, launcher.getSnapshot);
  const unavailable = desktopUnavailableReason();
  const busy = settings.saving || launch.busy;
  useEffect(() => { setDraft(null); setError(null); setDeleting(null); setPicking(false); setPendingSession(null); }, [host.id]);
  function edit(session: SavedSession) {
    if (settings.status !== "ready") return;
    setDraft({ session: { ...session, projectGroupIds: [...session.projectGroupIds] }, base: settings.values,
      groups: settings.values.projectGroups.map((g) => ({ ...g, projectIds: [...g.projectIds] })), revision: settings.revision });
    setDeleting(null); setError(null); setPicking(false); setPendingSession(null);
  }
  useEffect(() => {
    if (!sessionRequest || settings.status !== "ready") return;
    if (draft) { if (draft.session.id !== sessionRequest.id) setPendingSession(sessionRequest.id); return; }
    const session = settings.values.sessions.find((s) => s.id === sessionRequest.id);
    if (session) edit(session);
    // Requests are explicit navigation events. Do not reopen on settings changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRequest]);
  function update(next: Draft) { if (!busy) { setDraft(next); setError(null); } }
  function open(groups: SavedWindow[]) { void launcher.run(() => prepareWindows(paseo, host.id, groups)); }
  async function save() {
    if (!draft) return;
    const exists = draft.base.sessions.some((s) => s.id === draft.session.id);
    const sessions = exists ? draft.base.sessions.map((s) => s.id === draft.session.id ? draft.session : s) : [...draft.base.sessions, draft.session];
    const result = preferencesSchema.safeParse({ ...draft.base, projectGroups: draft.groups, sessions });
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Check the session details."); return; }
    if (!draft.session.projectGroupIds.length) { setError("Add at least one project group."); return; }
    if (draft.base.sessions.some((s) => s.id !== draft.session.id && s.name.toLocaleLowerCase() === draft.session.name.trim().toLocaleLowerCase())) {
      setError("A session already uses this name. Choose a different name."); return;
    }
    for (const group of result.data.projectGroups) {
      if (draft.base.projectGroups.find((g) => g.id === group.id)?.name === group.name) continue;
      if (result.data.projectGroups.some((g) => g.id !== group.id && g.name.toLocaleLowerCase() === group.name.toLocaleLowerCase())) {
        setError("A project group already uses this name. Choose a different name."); return;
      }
    }
    const selected = sessionWindows(result.data, draft.session);
    if (selected.some((g) => g.projectIds.some((id) => !projects.data?.some((p) => p.id === id)))) {
      setError("Choose available projects for every group before saving."); return;
    }
    if (await settings.save(result.data, draft.revision)) { setDraft(null); setError(null); setPicking(false); }
  }
  const draftGroups = draft ? draft.session.projectGroupIds.map((id) => draft.groups.find((g) => g.id === id)!) : [];
  return <View style={{ gap: 20, paddingVertical: 8 }}>
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.colors.foreground, fontSize: layout.compact ? 22 : 26, fontWeight: "700" }}>Sessions manager</Text>
      <Copy theme={theme} muted>Combine project groups into a session. Each group opens its own window. Editing a group here updates it everywhere it is used.</Copy>
    </View>
    {unavailable && <Card theme={theme}><Copy theme={theme} muted>{unavailable}</Copy></Card>}
    {launch.message && <Copy theme={theme}>{launch.message}</Copy>}
    {launch.error && <Copy theme={theme} error>{launch.error}</Copy>}
    {settings.status === "loading" && <Copy theme={theme} muted>Loading saved sessions…</Copy>}
    {(settings.status === "error" || settings.status === "invalid") && <Card theme={theme}>
      <Copy theme={theme} error>{settings.error}</Copy>
      <Action theme={theme} label="Retry loading sessions" onPress={() => { void settings.reload(); }} />
    </Card>}
    {settings.status === "ready" && !draft && <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Copy theme={theme} muted>{settings.values.sessions.length} saved session{settings.values.sessions.length === 1 ? "" : "s"} · {host.label}</Copy>
        <Action theme={theme} primary label="New session" disabled={busy || settings.values.sessions.length >= 30}
          onPress={() => edit({ id: newId(), name: "", projectGroupIds: [] })} />
      </View>
      {!settings.values.sessions.length && <Card theme={theme}>
        <Text style={{ color: theme.colors.foreground, fontSize: 17, fontWeight: "600" }}>Your workspace, one click away</Text>
        <Copy theme={theme} muted>Create a session such as “Main”, then add the project groups you want to open together.</Copy>
      </Card>}
      {settings.values.sessions.map((session) => <Card key={session.id} theme={theme}>
        <Text style={{ color: theme.colors.foreground, fontSize: 18, fontWeight: "600" }}>{session.name}</Text>
        <Copy theme={theme} muted>{session.projectGroupIds.length} project group{session.projectGroupIds.length === 1 ? "" : "s"} · one window per group</Copy>
        {!session.projectGroupIds.length && <Copy theme={theme} muted>Add a project group to launch this session.</Copy>}
        {sessionWindows(settings.values, session).map((group) => <View key={group.id} style={{ gap: 3 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: 14, fontWeight: "500" }}>{group.name}</Text>
          <Copy theme={theme} muted>{group.projectIds.map((id) => projects.data?.find((p) => p.id === id)?.name ?? (projects.isPending ? "Loading…" : "Unavailable project")).join(" · ")}</Copy>
        </View>)}
        <Divider theme={theme} />
        {deleting === session.id ? <View style={{ gap: 10 }}>
          <Copy theme={theme}>Delete “{session.name}”? Its project groups and open windows will be kept.</Copy>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Action theme={theme} danger label="Delete session" disabled={busy} onPress={() => {
              void settings.save({ ...settings.values, sessions: settings.values.sessions.filter((s) => s.id !== session.id) }, settings.revision).then((ok) => { if (ok) setDeleting(null); });
            }} />
            <Action theme={theme} label="Keep session" onPress={() => setDeleting(null)} disabled={busy} />
          </View>
        </View> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Action theme={theme} primary label="Open all windows" disabled={busy || !!unavailable || !session.projectGroupIds.length}
            onPress={() => open(sessionWindows(settings.values, session))} />
          <Action theme={theme} label="Edit session" disabled={busy} onPress={() => edit(session)} />
          <Action theme={theme} danger label="Delete" disabled={busy} onPress={() => setDeleting(session.id)} />
        </View>}
      </Card>)}
    </>}
    {draft && <View style={{ gap: 16 }}>
      {pendingSession && settings.status === "ready" && <Card theme={theme}>
        <Copy theme={theme}>You have an open session draft. Keep editing it or discard it to open the other session.</Copy>
        <Action theme={theme} label="Discard draft and switch session" disabled={busy} onPress={() => {
          const session = settings.values.sessions.find((s) => s.id === pendingSession); if (session) edit(session);
        }} />
        <Action theme={theme} label="Keep editing" onPress={() => setPendingSession(null)} />
      </Card>}
      <Field theme={theme} label="Session name" value={draft.session.name} placeholder="e.g. Main" onChangeText={(name) => update({ ...draft, session: { ...draft.session, name } })} />
      {settings.status === "ready" && settings.revision !== draft.revision && <Copy theme={theme} error>Project groups or sessions changed in another editor. Your draft is kept. Cancel and reopen the editor to use the latest version.</Copy>}
      <Copy theme={theme} muted>Save session applies group edits to every session using them. New groups also appear in Project groups. Cancel discards these edits.</Copy>
      {projects.isPending && <Copy theme={theme} muted>Loading projects…</Copy>}
      {projects.isError && <View style={{ gap: 8 }}><Copy theme={theme} error>Could not load projects. Check this host’s connection.</Copy><Action theme={theme} label="Retry projects" onPress={() => { void projects.refetch(); }} /></View>}
      {projects.data && draftGroups.map((group, index) => <View key={group.id} style={{ gap: 8 }}>
        <WindowEditor theme={theme} window={group} index={index} projects={projects.data}
          onChange={(next) => update({ ...draft, groups: draft.groups.map((g) => g.id === group.id ? next : g) })}
          onRemove={() => update({ ...draft, session: { ...draft.session, projectGroupIds: draft.session.projectGroupIds.filter((id) => id !== group.id) },
            groups: draft.base.projectGroups.some((g) => g.id === group.id) ? draft.groups : draft.groups.filter((g) => g.id !== group.id) })} />
      </View>)}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Action theme={theme} label="Add new project group" disabled={busy || draft.session.projectGroupIds.length >= 12 || draft.groups.length >= 400} onPress={() => {
          const group = { id: newId(), name: "", projectIds: [] };
          update({ ...draft, groups: [...draft.groups, group], session: { ...draft.session, projectGroupIds: [...draft.session.projectGroupIds, group.id] } });
        }} />
        <Action theme={theme} label="Add existing project group" disabled={busy || draft.session.projectGroupIds.length >= 12} onPress={() => setPicking(!picking)} />
      </View>
      {picking && <Card theme={theme}>
        <Copy theme={theme}>Choose a project group</Copy>
        {draft.groups.filter((g) => !draft.session.projectGroupIds.includes(g.id)).map((group) => <Action key={group.id} theme={theme} label={`Add ${group.name}`} disabled={busy || draft.session.projectGroupIds.length >= 12}
          onPress={() => { update({ ...draft, session: { ...draft.session, projectGroupIds: [...draft.session.projectGroupIds, group.id] } }); setPicking(false); }} />)}
        {!draft.groups.some((g) => !draft.session.projectGroupIds.includes(g.id)) && <Copy theme={theme} muted>No other project groups available. Create a new project group.</Copy>}
      </Card>}
      {error && <Copy theme={theme} error>{error}</Copy>}
      <Divider theme={theme} />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Action theme={theme} variant="filled" label={settings.saving ? "Saving…" : "Save session"} disabled={busy || !projects.data || projects.isError || settings.status !== "ready" || settings.revision !== draft.revision} onPress={() => { void save(); }} />
        <Action theme={theme} label="Cancel" disabled={settings.saving} onPress={() => { setDraft(null); setError(null); setPicking(false); setPendingSession(null); }} />
      </View>
    </View>}
    {settings.saveError && <Copy theme={theme} error>{settings.saveError}</Copy>}
    <Divider theme={theme} />
    <Copy theme={theme} muted>Sessions are shared by clients connected to {host.label}. Opening a session creates new windows each time.</Copy>
  </View>;
}
