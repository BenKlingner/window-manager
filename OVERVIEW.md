# Window Manager

Window Manager opens projects in separate Paseo Desktop windows. Save the projects for each window as a project group, then combine project groups into named window groups.

Open Window Manager from the sidebar header or the Command Center. Its **Projects**, **Window groups**, and **Project groups** tabs list everything you can launch, each with its own button to open it in a new window. Projects are searchable.

The settings button opens three tabs:

- **Window groups**: create a window group such as “Main” and add up to 12 project groups. Create a new project group or add an existing one, and edit its name and projects directly in the window group.
- **Project groups**: create, rename, edit, or delete a group of projects. Each project group opens exactly one window. See which window groups use it and jump to edit those window groups.
- **About**: usage, desktop compatibility, and current limitations.

Project groups are shared, so saving edits in either tab updates every window group that uses them. Saving a window group also saves its new project groups to Project groups. Removing a project group from a window group keeps the saved project group. Deleting a window group keeps its project groups; deleting a project group removes it from all window groups. Window groups left empty cannot launch until you add a project group.

Switching tabs preserves unfinished drafts. Cancel discards unsaved edits, including project groups created inside a window group draft. If another editor saves changes while a draft is open, cancel and reopen that draft before saving. Settings are stored on the selected host and shared with its connected clients. Existing workspace windows become project groups, and sessions saved by earlier versions become window groups whose windows are kept as project groups. Settings are also available under **Settings → Plugins → window-manager → Window Manager** and through the Command Center.

Launching requires Paseo Desktop 0.13.2 or later. Editing works on other clients, but they cannot create desktop windows. The launcher uses desktop functionality that is not part of the public plugin API, so each Paseo release is verified separately. It has been verified with 0.13.2 to 0.16.x. A newer release keeps working, but the plugin shows a notice until that release has been verified. Window launching has been tested on Linux with X11. The plugin has no operating-system-specific code and Paseo creates windows the same way everywhere, so macOS, Windows, and Linux with Wayland are expected to work, but they have not been tested yet.

Each launch creates new windows; it does not switch to or close existing ones. The launcher temporarily changes local sidebar and startup preferences, waits for each window to load, and restores the previous preferences. During a launch, it narrowly intercepts writes to those two storage keys so Paseo’s background reconciliation cannot overwrite the next window’s selection; actual preference edits are deferred and preserved afterward. Open windows keep independent project selections. Saved group edits apply on the next launch. Refreshing a window can reload another window’s last saved filter; reopen it from the project group or window group when needed. Names label the saved setup, not the operating system’s title bar. Window positions and sizes are not saved.

Window Manager reads the selected host’s project and workspace lists. If a selected project has no workspace, it opens one through Paseo. It does not launch agents or send project data to external services.
