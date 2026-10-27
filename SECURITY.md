# Security scope

Window Manager is a trusted local Paseo plugin. Its server entry only registers two settings
documents. All other code runs inside the Paseo app. There are no plugin RPCs, no Node APIs,
no filesystem or shell access, no network requests, and no credentials or secret storage.

## What the plugin reads and writes

- **Host settings.** Project groups and sessions are stored through Paseo's plugin settings
  API on the selected host and validated with Zod on every read and write. Names are capped at
  80 characters, groups at 400, sessions at 30, and groups per session at 12. Saves use
  compare-and-swap revisions so one client cannot overwrite another's edits.
- **Paseo project and workspace lists.** Read through the public SDK to resolve saved project
  IDs. When a selected project has no workspace, the plugin opens one with the public
  `workspaces.open` call using the path Paseo reported for that project. It never passes a
  user-typed path.
- **Desktop window creation.** The plugin calls the same renderer bridge that Paseo's own
  "Open in new window" project menu item uses. It passes no arguments to that call.
- **Local browser storage in the desktop app.** During a launch, the plugin temporarily
  rewrites two of Paseo's own `localStorage` preferences, `sidebar-view` and
  `paseo:last-workspace-route-selection`, so the new window hydrates the intended projects. It
  journals the original values first, restores them when the window acknowledges its route or
  after a 30-second timeout, and recovers the journal on the next start if the app crashed
  mid-launch. Edits made by another window during a launch are preserved, not discarded.
- **Per-window storage.** A random window ID in `sessionStorage` lets a new window acknowledge
  a launch without an existing or reloaded window claiming it.

## Boundaries and controls

- The sidebar preference is parsed against the same shape Paseo's own store accepts. Any other
  shape aborts the launch before a window is opened, so an unrecognized Paseo release cannot
  have its preferences corrupted.
- While a launch is active, the plugin patches the renderer's `Storage.prototype` so that
  writes to those two keys from Paseo's background reconciliation are deferred rather than
  racing the launch. The patch applies only to `localStorage`, only to those two keys, and is
  removed once no launch is active and the plugin is unloaded. Every other key behaves normally.
- Web Locks serialize launches across windows. A journal left by a crashed launcher is only
  restored by a window that can take that lock, which proves no launcher is running.
- Launch tickets and acknowledgements are stored in the app's own origin. Another renderer in
  the same origin could already do anything this plugin does, so they are not a new trust
  boundary. Values are schema-checked and size-capped before use.
- Group and session names are rendered with React Native text. There is no HTML, no code
  evaluation, no URL built from user input, and nothing is sent to external services.
- Fallback record IDs on non-desktop clients use `Math.random`. They identify UI records only
  and never gate a permission or launch.

## Verification and remaining release checks

`npm test` exercises the launcher, journal restore after failure, timeout, cancellation,
concurrent edits, the write guard, schema rejection, and settings migration. `npm run test:ui`
renders the actual components in headless Chromium. `npm run typecheck` validates the plugin
against the pinned `@getpaseo/plugin` 0.13.2 contract. The plugin has no runtime npm
dependencies; `npm audit --omit=dev` reports none.

Native window launching has been exercised on Linux with X11 only. macOS, Windows, and
Wayland still need a live check, and the Paseo version range must be re-verified before it
is widened past 0.13.x.
