# Window Manager for Paseo

![Window Manager for Paseo — three overlapping window outlines on a muted dark gradient](assets/hero.png)

Open your Paseo projects in separate desktop windows. Save the projects for each window as a
project group, combine groups into named sessions, and open a whole session with one click.

Requires **Paseo Desktop 0.13.2 through 0.13.x**. Created by **Ben Klingner**.

## Install

With plugins enabled in Paseo, run:

```sh
paseo plugin add git:BenKlingner/window-manager
```

Plugins run as trusted code on your Paseo host and inside the app. Review the source before installing.
Open **Settings → Plugins → window-manager → Window Manager** to set up project groups and sessions,
or use **Window Manager: settings** in the Command Center. The **Window Manager** button in a
workspace's top-right header opens the current project, a saved group, or a session.

## Features

- Open the current project in its own window.
- Save project groups. Each group opens one window showing only its selected projects.
- Combine shared groups into sessions and open every window in a session at once.
- Edit a group once and every session that uses it is updated.
- Settings are stored on the host and shared with every client connected to it.
- Works in desktop and compact layouts, with colors that follow your Paseo theme.

See [the overview](OVERVIEW.md) for behavior and limitations, and
[the security notes](SECURITY.md) for what the plugin reads and writes.

## Screenshots

The plugin UI below uses fictional demo projects and sessions.

### Project groups

Choose which projects share a window, and see the sessions that use each group.

![Project groups showing Product development and Design & docs, both used by the Daily workspace session](assets/project-groups.png)

### Sessions manager

Combine saved groups into a session and open one window per group.

![Sessions manager showing the Daily workspace session with two project groups and an Open all windows button](assets/sessions.png)

## Platform support

Opening windows works only in Paseo Desktop. The plugin asks the desktop app to create each
window through the same internal call that Paseo's own **Open in new window** project action
uses, then sets up that window's sidebar through the app's local preferences. The plugin
contains no operating-system-specific code, and Paseo creates windows the same way on every
platform, so the expected support is:

| Platform | Status |
| --- | --- |
| Linux, X11 (Zorin OS 18, GNOME) | Tested. All development and live testing happened here. |
| Linux, Wayland | Expected to work. Not yet tested. |
| macOS | Expected to work. Not yet tested. |
| Windows | Expected to work. Not yet tested. |
| iOS, Android, browser | Settings can be edited. Windows cannot be opened. |

If you run the plugin on an untested platform, please [report the result](https://github.com/BenKlingner/window-manager/issues),
whether it worked or not, with your Paseo version and operating system.

Launching depends on desktop behavior that is not part of Paseo's public plugin API, which is why
the supported Paseo range is pinned to 0.13.x. Later releases need a compatibility check before the
range is widened.

## Known limitations

- Each launch creates new windows. It does not focus or close windows that are already open.
- Refreshing a window can reload another window's last saved project filter. Reopen the group or
  session to restore it.
- Group names label your saved setup. They do not change the native window title, and window
  positions and sizes are not saved.
- One launch runs at a time across all Paseo windows. A second launch waits for a clear message.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:ui
```

`npm test` covers the launcher, the storage write guard, settings validation, and migrations with
an in-memory storage. `npm run test:ui` renders the real settings and menu components with
React Native Web and a simulated SDK in headless Chromium, in light and dark themes and in wide
and compact layouts. It uses Playwright's bundled Chromium, or set `CHROMIUM_PATH` to another
Chromium-based browser. Neither suite opens native windows.

For local testing, install the checkout and reload the plugin after source edits:

```sh
paseo plugin install /absolute/path/to/window-manager
paseo plugin reload window-manager
```

Then open a session containing a two-project group followed by a single-project group and check
both windows' sidebar selections, not just the window count. Do not restart the Paseo daemon to
pick up changes.

## Support

[Report a bug or suggest a feature](https://github.com/BenKlingner/window-manager/issues).
For bugs, include your Paseo version, operating system, display server, and steps to reproduce.

## License

[MIT](LICENSE).

Window Manager is an independent plugin and is not affiliated with or endorsed by the Paseo team.
