import type { PluginButtonContentProps, PluginButtonRegistration, PluginClientContext, PluginSurfaceProps } from "@getpaseo/plugin/client";
import { createLauncher, startWindowReceiver } from "./client/web";
import { WindowMenu } from "./client/menu";
import { WindowSettings } from "./client/settings";

export default function contribute(client: PluginClientContext) {
  const stopReceiver = startWindowReceiver();
  const launcher = createLauncher();
  let stopped = false;
  const buttons = new Map<string, PluginButtonRegistration>();
  let release: (() => Promise<void>) | undefined;

  function Setup(props: PluginSurfaceProps) { return <WindowSettings {...props} launcher={launcher} />; }
  function Menu(props: PluginButtonContentProps) {
    return <WindowMenu {...props} launcher={launcher} openSetup={() => { props.close(); client.openSettings("sessions"); }} />;
  }
  client.addSettingsScreen({ id: "sessions", title: "Window Manager", icon: "PanelsTopLeft", Component: Setup });
  client.addCommandCenterItem({ id: "window-manager-setup", title: "Window Manager: settings", icon: "PanelsTopLeft", context: "global", onSelect() { client.openSettings("sessions"); } });

  function add(workspaceId: string) {
    if (stopped || buttons.has(workspaceId)) return;
    buttons.set(workspaceId, client.addHeaderButton({
      id: "window-manager", workspaceId,
      button: { title: "Window Manager", icon: "PanelsTopLeft", behavior: { kind: "popover", Content: Menu } },
    }));
  }
  void (async () => {
    const result = await client.paseo.workspaces.list({ subscribe: {}, page: { limit: 200 } });
    release = () => result.subscription.release();
    if (stopped) { await release(); return; }
    for (const workspace of result.entries) add(workspace.id);
    result.subscription.subscribe({
      snapshot: (snapshot) => { for (const workspace of snapshot.entries) add(workspace.id); },
      update: (message) => {
        if (message.type !== "workspace_update") return;
        const update = message.payload;
        if (update.kind === "upsert") add(update.workspace.id);
        else { buttons.get(update.id)?.remove(); buttons.delete(update.id); }
      },
    });
    let cursor = result.pageInfo.nextCursor;
    while (cursor && !stopped) {
      const page = await client.paseo.workspaces.list({ page: { limit: 200, cursor } });
      for (const workspace of page.entries) add(workspace.id);
      cursor = page.pageInfo.nextCursor;
    }
  })().catch((error: unknown) => { if (!stopped) console.error("[Window Manager] Could not register workspace buttons", error); });

  return async () => {
    stopped = true; stopReceiver(); launcher.dispose();
    for (const button of buttons.values()) button.remove();
    buttons.clear();
    await release?.();
  };
}
