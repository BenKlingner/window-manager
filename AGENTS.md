# Window Manager development

Follow the parent workspace guidance and the `paseo-plugin` skill.

## Desktop compatibility

This plugin currently targets Paseo 0.13.2–0.13.x. It uses the public SDK for
projects, workspaces, settings, and header contributions. Window creation and
sidebar bootstrapping use undocumented desktop behavior isolated in `client/web.ts`
and `client/launch.ts`. Check Paseo source before widening the version range.

Paseo's `sidebar-view` persistence format is version 8. The plugin's `sidebarSchema` in
`client/launch.ts` mirrors `SidebarViewPersistedStateSchema` in Paseo's
`packages/app/src/stores/sidebar-view-store.ts`, including the legacy `label` mode,
`hostFilter`, and `groupModeByServerId` fields Paseo still accepts on read. Re-compare the two
whenever the supported Paseo range changes. A new window hydrates the
shared preference into its own store. The launcher journals and temporarily primes
that preference plus `paseo:last-workspace-route-selection`, then restores them.
Web Locks serialize launches; a new window acknowledges its startup route.

Do not remove the storage write guard without replacing it. Paseo's no-op
`reconcileLabelFilter` and `reconcileHostFilters` calls still persist the entire
sidebar snapshot. Another window can therefore overwrite a launch in progress.
The guard defers writes to just the two launch-related keys and preserves actual
changes afterward. All other storage operations retain their normal behavior.

Refreshing a window does not retain its independent filter. This is documented in
the UI and overview. Saved window names do not set native window titles.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run test:ui` (install Playwright Chromium or set `CHROMIUM_PATH`, for example to
  `/usr/bin/brave-browser` on this machine)
- Live Paseo: launch a session containing a two-project window followed by a
  single-project window. Verify both sidebar selections, not just the window count.

The UI tests use actual components and a simulated SDK. They do not prove native
window behavior. Native launching has been exercised on Linux/X11 (Zorin OS 18, GNOME); macOS, Windows, and
Wayland still require native validation. README.md, OVERVIEW.md, and SECURITY.md state this;
update all three when a platform is verified.

**Never use Escape to dismiss menus during live agent testing.** Paseo maps Escape
to `agent.interrupt`; it can cancel the agent performing the test. Click outside
menus instead. Preserve the user's original windows, and remove temporary test
sessions after checking persistence and launch behavior.

Use `paseo plugin reload window-manager`, not a daemon restart. If a `paseo` command
points directly to an AppImage and opens a window instead of running the CLI, use
the running desktop application's bundled `resources/bin/paseo` launcher.

## Shared project groups

`shared/settings.ts` defines the version 2 `sessions` document: canonical
`projectGroups` plus sessions referencing `projectGroupIds`. Save both together
using the original draft revision. Never copy group contents into a session.
Empty sessions are retained after a group is deleted, but cannot launch.

The version 1 `windows` document stays registered only for legacy import.
`useLibrary` imports it once with compare-and-swap and marks
`legacyWindowsImported`; the old document is preserved. Version 1 sessions migrate
on the host, preserving each embedded window as a distinct group. Preserve this
migration when editing settings. New groups created inside session drafts become
saved library groups when the user saves the session.
