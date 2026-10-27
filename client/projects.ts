import type { PaseoApi, PaseoProject } from "@getpaseo/client";
import type { ProjectChoice, SavedWindow, WindowLaunch } from "../shared/settings";

// Paseo 0.13.x: unique equivalence keys win; duplicate keys on one host use placement IDs.
export function projectChoices(projects: readonly PaseoProject[], hostId: string): ProjectChoice[] {
  const counts = new Map<string, number>();
  for (const p of projects) if (p.projectKey) counts.set(p.projectKey, (counts.get(p.projectKey) ?? 0) + 1);
  return projects.map((p) => ({
    id: p.projectId,
    name: p.projectCustomName || p.projectDisplayName,
    path: p.projectRootPath,
    viewKey: p.projectKey && counts.get(p.projectKey) === 1 ? p.projectKey : JSON.stringify([hostId, p.projectId]),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadProjects(paseo: PaseoApi, hostId: string) {
  return projectChoices((await paseo.projects.list()).projects, hostId);
}

export async function prepareWindows(
  paseo: PaseoApi,
  hostId: string,
  windows: readonly SavedWindow[],
  currentWorkspaceId?: string,
): Promise<WindowLaunch[]> {
  const projects = await loadProjects(paseo, hostId);
  const byId = new Map(projects.map((p) => [p.id, p]));
  // Validate the entire session before opening or creating anything.
  for (const window of windows) {
    if (!window.projectIds.length) throw new Error(`Choose a project for “${window.name}”.`);
    for (const id of window.projectIds) {
      if (!byId.has(id)) throw new Error(`A project in “${window.name}” is no longer available. Edit this session in setup.`);
    }
  }
  const targets: WindowLaunch[] = [];
  for (const window of windows) {
    const first = byId.get(window.projectIds[0]!)!;
    let workspaceId = currentWorkspaceId;
    if (!workspaceId) {
      const list = await paseo.workspaces.list({ filter: { projectId: first.id }, page: { limit: 1 } });
      workspaceId = list.entries[0]?.id;
      // A registered project may have no workspace yet. Use the normal SDK operation.
      if (!workspaceId) workspaceId = (await paseo.workspaces.open(first.path)).id;
    }
    if (!workspaceId) throw new Error(`Could not open a workspace for “${first.name}”.`);
    targets.push({
      name: window.name, hostId, workspaceId,
      projectKeys: window.projectIds.map((id) => byId.get(id)!.viewKey),
    });
  }
  return targets;
}
