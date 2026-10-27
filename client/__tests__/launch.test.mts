import test from 'node:test';
import assert from 'node:assert/strict';
import { launchWindows, primeSidebar, SIDEBAR_KEY, ROUTE_KEY, PENDING_KEY, type LaunchPort, type StoragePort } from '../launch';
import { projectChoices } from '../projects';
import { legacySessionSchema as sessionSchema } from '../../shared/settings';

class Memory implements StoragePort {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const sidebar = JSON.stringify({ version: 8, state: { groupMode: 'status', workspaceSort: 'manual', hostFilters: [], projectFilters: ['original'], labelFilter: { labels: ['work'] }, showBackground: true } });
const target = { name: 'Website', hostId: 'host', projectKeys: ['website'], workspaceId: 'workspace' };
function fixture() {
  const storage = new Memory();
  storage.setItem(SIDEBAR_KEY, sidebar);
  storage.setItem(ROUTE_KEY, 'old route');
  const seen: unknown[] = [];
  const port: LaunchPort = {
    storage, windowId: 'parent', uuid: () => 'ticket', now: () => 1,
    openWindow: async () => { seen.push(JSON.parse(storage.getItem(SIDEBAR_KEY)!)); },
    waitForReady: async () => {}, exclusive: async (op) => op(),
  };
  return { port, storage, seen };
}

test('opens each group with its own filters and restores both shared preferences', async () => {
  const { port, storage, seen } = fixture();
  await launchWindows(port, [target, { ...target, projectKeys: ['code', 'design'] }], new AbortController().signal);
  assert.deepEqual(seen.map((s: any) => s.state.projectFilters), [['website'], ['code', 'design']]);
  assert.deepEqual(seen.map((s: any) => s.state.labelFilter), [{ labels: [] }, { labels: [] }]);
  assert.equal(storage.getItem(SIDEBAR_KEY), sidebar);
  assert.equal(storage.getItem(ROUTE_KEY), 'old route');
  assert.equal(storage.getItem(PENDING_KEY), null);
});
test('waits for a ready window before opening the next', async () => {
  const { port, seen } = fixture();
  let acknowledge: () => void;
  port.waitForReady = () => new Promise<void>((resolve) => { acknowledge = resolve; });
  const running = launchWindows(port, [target, target], new AbortController().signal);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(seen.length, 1);
  acknowledge!();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(seen.length, 2);
  acknowledge!();
  await running;
});
test('restores temporary filters after IPC rejection', async () => {
  const { port, storage } = fixture();
  port.openWindow = async () => { throw new Error('IPC unavailable'); };
  await assert.rejects(launchWindows(port, [target], new AbortController().signal), /IPC unavailable/);
  assert.equal(storage.getItem(SIDEBAR_KEY), sidebar);
  assert.equal(storage.getItem(ROUTE_KEY), 'old route');
  assert.equal(storage.getItem(PENDING_KEY), null);
});
test('stops after timeout and reports the already opened window', async () => {
  const { port, storage, seen } = fixture();
  port.waitForReady = async () => { throw new Error('timed out'); };
  await assert.rejects(launchWindows(port, [target, target], new AbortController().signal), /1 window opened.*timed out/);
  assert.equal(seen.length, 1);
  assert.equal(storage.getItem(SIDEBAR_KEY), sidebar);
});
test('does not overwrite a concurrent sidebar edit', async () => {
  const { port, storage } = fixture();
  port.waitForReady = async () => { storage.setItem(SIDEBAR_KEY, 'a newer preference'); };
  await launchWindows(port, [target], new AbortController().signal);
  assert.equal(storage.getItem(SIDEBAR_KEY), 'a newer preference');
});
test('cancellation leaves preferences untouched', async () => {
  const { port, storage, seen } = fixture();
  const signal = AbortSignal.abort();
  await assert.rejects(launchWindows(port, [target], signal), /cancelled/);
  assert.equal(seen.length, 0);
  assert.equal(storage.getItem(SIDEBAR_KEY), sidebar);
});
test('refuses unknown or corrupted sidebar formats before opening a window', async () => {
  for (const value of ['bad json', '{"version":9,"state":{}}', '{"version":8,"state":{"unexpected":true}}']) {
    const { port, storage, seen } = fixture();
    storage.setItem(SIDEBAR_KEY, value);
    await assert.rejects(launchWindows(port, [target], new AbortController().signal));
    assert.equal(seen.length, 0);
    assert.equal(storage.getItem(SIDEBAR_KEY), value);
  }
});
test('accepts legacy sidebar fields that Paseo still reads, and drops them when priming', async () => {
  const legacy = JSON.stringify({ version: 8, state: { groupMode: 'label', hostFilter: 'old-host', groupModeByServerId: { h: 'status' }, projectFilters: [] } });
  const primed = JSON.parse(primeSidebar(legacy, target));
  assert.equal(primed.state.groupMode, 'project');
  assert.equal('hostFilter' in primed.state, false);
  assert.equal('groupModeByServerId' in primed.state, false);
  const { port, storage, seen } = fixture();
  storage.setItem(SIDEBAR_KEY, legacy);
  await launchWindows(port, [target], new AbortController().signal);
  assert.equal(seen.length, 1);
  assert.equal(storage.getItem(SIDEBAR_KEY), legacy, 'the untouched legacy snapshot is restored verbatim');
});
test('first-run defaults create a complete supported sidebar shape', () => {
  const result = JSON.parse(primeSidebar(null, target));
  assert.equal(result.state.workspaceSort, 'created');
  assert.deepEqual(result.state.hostFilters, ['host']);
});
test('duplicate repository keys on one host use placement IDs', () => {
  const projects = [
    { projectId: 'a', projectKey: 'same', projectDisplayName: 'A', projectRootPath: '/a', projectKind: 'git' as const },
    { projectId: 'b', projectKey: 'same', projectDisplayName: 'B', projectRootPath: '/b', projectKind: 'git' as const },
    { projectId: 'c', projectKey: 'unique', projectDisplayName: 'C', projectRootPath: '/c', projectKind: 'git' as const },
  ];
  assert.deepEqual(projectChoices(projects, 'host').map(p => p.viewKey), ['["host","a"]', '["host","b"]', 'unique']);
});
test('sessions require named windows and nonempty unique project selections', () => {
  assert.equal(sessionSchema.safeParse({ id: 'a', name: 'Session', windows: [] }).success, false);
  assert.equal(sessionSchema.safeParse({ id: 'a', name: 'Session', windows: [{ id: 'b', name: 'Window', projectIds: ['a', 'a'] }] }).success, false);
});

test('no-op reconciliation in another window cannot replace the next launch selection', async () => {
  const { createLaunchWriteGuard } = await import('../storage-guard');
  const { port, storage } = fixture();
  const guard = createLaunchWriteGuard(storage, () => 1);
  port.openWindow = async () => {
    guard.write(SIDEBAR_KEY, sidebar); // An existing window reconciles its unchanged labels.
    assert.deepEqual(JSON.parse(storage.getItem(SIDEBAR_KEY)!).state.projectFilters, ['website']);
  };
  await launchWindows(port, [target], new AbortController().signal);
  guard.flush();
  assert.equal(storage.getItem(SIDEBAR_KEY), sidebar);
});
test('real user preference edits during launch are deferred, then preserved', async () => {
  const { createLaunchWriteGuard } = await import('../storage-guard');
  const { port, storage } = fixture();
  const guard = createLaunchWriteGuard(storage, () => 1);
  const edited = JSON.stringify({...JSON.parse(sidebar),state:{...JSON.parse(sidebar).state,workspaceSort:'lastPrompt'}});
  port.openWindow = async () => {
    guard.write(SIDEBAR_KEY, edited);
    guard.flush();
    assert.deepEqual(JSON.parse(storage.getItem(SIDEBAR_KEY)!).state.projectFilters, ['website']);
  };
  await launchWindows(port, [target], new AbortController().signal);
  guard.flush();
  assert.equal(storage.getItem(SIDEBAR_KEY), edited);
});

test('legacy windows migrate without merging unrelated groups or losing selections', async () => {
  const { migrateSessions, importLegacyWindows, sessionWindows, preferencesSchema } = await import('../../shared/settings');
  const old = {sessions:[
    {id:'daily',name:'Daily',windows:[{id:'code',name:'Code',projectIds:['repo']}]},
    {id:'other',name:'Other',windows:[{id:'code',name:'Code',projectIds:['design']}]},
  ]};
  const migrated = importLegacyWindows(migrateSessions(old), [{id:'migrated-session-0-window-0',name:'Code',projectIds:['web']}]);
  assert.equal(new Set(migrated.projectGroups.map(g => g.id)).size, 3);
  assert.deepEqual(sessionWindows(migrated, migrated.sessions[0]!).map(g => g.projectIds), [['repo']]);
  assert.deepEqual(sessionWindows(migrated, migrated.sessions[1]!).map(g => g.projectIds), [['design']]);
  assert.deepEqual(importLegacyWindows(migrated, [{id:'new',name:'Ignore',projectIds:['new']}]), migrated);
  assert.equal(preferencesSchema.safeParse({...migrated,sessions:[{id:'bad',name:'Bad',projectGroupIds:['missing']}]}).success,false);
  assert.equal(preferencesSchema.safeParse({...migrated,sessions:[{id:'bad',name:'Bad',projectGroupIds:[migrated.projectGroups[0]!.id,migrated.projectGroups[0]!.id]}]}).success,false);
  assert.equal(preferencesSchema.safeParse({...migrated,sessions:[{id:'empty',name:'Empty',projectGroupIds:[]}]}).success,true);
  assert.throws(() => migrateSessions({sessions:[{id:'broken',name:'Broken',windows:[{id:'w',name:'W',projectIds:[]}]}]}));
});
