# Window Manager

Window Manager opens projects in separate Paseo Desktop windows. Save the projects for each window as a Project Group, then combine groups into named sessions.

Use the Window Manager button in a workspace’s top-right header to open that project in its own window, open a saved project group, or launch all groups in a session. On narrow layouts, find the button in the workspace menu.

Choose **Set up project groups and sessions** to open three tabs:

- **Project groups**: create, rename, edit, or delete a group of projects. Each group opens exactly one window. See which sessions use it and jump to edit those sessions.
- **Sessions manager**: create a session such as “Main” and add up to 12 project groups. Create a new group or add an existing one, and edit its name and projects directly in the session.
- **About**: usage, desktop compatibility, and current limitations.

Groups are shared, so saving edits in either tab updates every session that uses that group. Saving a session also saves its new groups to Project groups. Removing a group from a session keeps the saved group. Deleting a session keeps its groups; deleting a group removes it from all sessions. Sessions left empty cannot launch until you add a group.

Switching tabs preserves unfinished drafts. Cancel discards unsaved edits, including groups created inside a session draft. If another editor saves changes while a draft is open, cancel and reopen that draft before saving. Settings are stored on the selected host and shared with its connected clients. Existing workspace windows become project groups, and existing sessions retain their windows as project groups. Settings are also available under **Settings → Plugins → window-manager → Window Manager** and through the Command Center.

Launching requires Paseo Desktop 0.13.2 to 0.13.x. Editing works on other clients, but they cannot create desktop windows. The launcher uses desktop functionality that is not part of the public plugin API, so compatibility is intentionally limited to this release series. Window launching has been tested on Linux with X11. The plugin has no operating-system-specific code and Paseo creates windows the same way everywhere, so macOS, Windows, and Linux with Wayland are expected to work, but they have not been tested yet.

Each launch creates new windows; it does not switch to or close existing ones. The launcher temporarily changes local sidebar and startup preferences, waits for each window to load, and restores the previous preferences. During a launch, it narrowly intercepts writes to those two storage keys so Paseo’s background reconciliation cannot overwrite the next window’s selection; actual preference edits are deferred and preserved afterward. Open windows keep independent project selections. Saved group edits apply on the next launch. Refreshing a window can reload another window’s last saved filter; reopen it from the group or session when needed. Group names label the saved setup, not the operating system’s title bar. Window positions and sizes are not saved.

Window Manager reads the selected host’s project and workspace lists. If a selected project has no workspace, it opens one through Paseo. It does not launch agents or send project data to external services.
